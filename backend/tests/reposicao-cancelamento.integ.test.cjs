/**
 * Reposição, cancelamento e cota da semana contra um Postgres DE VERDADE —
 * concorrência não se prova com banco de mentira.
 *
 * Só roda com TEST_DATABASE_URL apontando para um banco LOCAL e descartável
 * (localhost/127.0.0.1), já com o esquema (`npx prisma db push`). Sem isso, os
 * testes são pulados; com um endereço de fora, o arquivo se recusa a rodar.
 * Ele cria os próprios alunos/turmas/planos com um sufixo aleatório e apaga
 * só o que criou.
 *
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/db_teste \
 *     npm run build && node --test tests/reposicao-cancelamento.integ.test.cjs
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const URL_TESTE = process.env.TEST_DATABASE_URL;
const pular = !URL_TESTE && 'defina TEST_DATABASE_URL (Postgres local e descartável) para rodar';
if (URL_TESTE) {
  const host = new URL(URL_TESTE).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(`TEST_DATABASE_URL tem que ser um banco local, não "${host}". Nunca rode isto contra produção.`);
  }
  process.env.DATABASE_URL = URL_TESTE;
}

require('../dist/src/timezone');
require('reflect-metadata');
const dayjs = require('dayjs');
const isoWeek = require('dayjs/plugin/isoWeek');
dayjs.extend(isoWeek);
const { PrismaClient } = require('@prisma/client');
const { AgendamentosService } = require('../dist/src/agendamentos/agendamentos.service');

const SUF = Math.random().toString(36).slice(2, 8);
let db, outra, svc;
const ids = { usuarios: [], horarios: [], planos: {}, modalidade: null };

// Semana que vem + 1: longe do prazo de cancelamento e dentro dos 45 dias.
const seg = dayjs().add(2, 'week').startOf('isoWeek');
const dia = (n) => seg.add(n, 'day').format('YYYY-MM-DD'); // 1 = terça, 2 = quarta, 3 = quinta
const meiaNoite = (iso) => dayjs(iso).startOf('day').toDate();

async function aluno(plano) {
  const n = ids.usuarios.length;
  const u = await db.usuario.create({
    data: { nome: `INTEG ${SUF} ${n}`, cpf: `9${SUF}${String(n).padStart(4, '0')}`.slice(0, 11).padEnd(11, '0'), email: `integ-${SUF}-${n}@t.local`, tipoUsuario: 'ALUNO' },
  });
  ids.usuarios.push(u.id);
  await db.usuarioPlano.create({
    data: { usuarioId: u.id, planoId: ids.planos[plano], modalidadeId: ids.modalidade, vigenciaInicio: new Date('2026-01-01'), semanaReferencia: new Date('2026-01-05') },
  });
  return u.id;
}

/** Turmas novas (3 vagas) para cada teste: um não lota a turma do outro. */
async function turmas() {
  const t = {};
  for (const d of ['TERCA', 'QUARTA', 'QUINTA']) {
    t[d] = (await db.horario.create({ data: { modalidadeId: ids.modalidade, diaSemana: d, horaInicio: '07:00', horaFim: '08:00', capacidadeMaxima: 3 } })).id;
    ids.horarios.push(t[d]);
  }
  return t;
}

/** Espera até um pedido estar parado esperando trava no banco. */
async function alguemTravado() {
  for (let i = 0; i < 300; i++) {
    const r = await outra.$queryRawUnsafe(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`);
    if (r[0].n > 0) return true;
    await new Promise((ok) => setTimeout(ok, 20));
  }
  return false;
}

before(async () => {
  if (pular) return;
  db = new PrismaClient();
  outra = new PrismaClient();
  svc = new AgendamentosService(db);
  ids.modalidade = (await db.modalidade.create({ data: { nome: `Integ ${SUF}` } })).id;
  for (const [k, n] of [['1x', 1], ['2x', 2]]) ids.planos[k] = (await db.plano.create({ data: { nome: `Integ ${SUF} ${k}`, aulasSemanais: n } })).id;
});

after(async () => {
  if (pular) return;
  const u = { usuarioId: { in: ids.usuarios } };
  await db.creditoReposicao.deleteMany({ where: u });
  await db.agendamento.deleteMany({ where: u });
  await db.usuarioPlano.deleteMany({ where: u });
  await db.usuario.deleteMany({ where: { id: { in: ids.usuarios } } });
  await db.horario.deleteMany({ where: { id: { in: ids.horarios } } });
  await db.plano.deleteMany({ where: { id: { in: Object.values(ids.planos) } } });
  await db.modalidade.deleteMany({ where: { id: ids.modalidade } });
  await db.$disconnect();
  await outra.$disconnect();
});

let T;
const marcar = (u, d, h, usarCredito) => svc.criar(u, { horarioId: T[h], dataAula: dia(d), ...(usarCredito ? { usarCredito: true } : {}) });

test('caso 1: plano 1x cancela A, repõe A com o próprio crédito — B na mesma semana é recusada', { skip: pular }, async () => {
  T = await turmas();
  const u = await aluno('1x');
  const a = await marcar(u, 1, 'TERCA');
  await svc.cancelar(a.id, u);
  await marcar(u, 1, 'TERCA', true);
  await assert.rejects(marcar(u, 3, 'QUINTA'), /continua contando nesta semana/);
});

test('caso 1: plano 2x — A reposta ocupa uma das duas', { skip: pular }, async () => {
  T = await turmas();
  const u = await aluno('2x');
  const a = await marcar(u, 1, 'TERCA');
  await svc.cancelar(a.id, u);
  await marcar(u, 1, 'TERCA', true);
  await marcar(u, 2, 'QUARTA');
  await assert.rejects(marcar(u, 3, 'QUINTA'), /Limite semanal/);
});

test('caso 1: crédito legítimo de outra semana repõe A — B entra e o crédito de A cai', { skip: pular }, async () => {
  T = await turmas();
  const u = await aluno('1x');
  const longe = await db.agendamento.create({ data: { usuarioId: u, horarioId: T.TERCA, dataAula: meiaNoite(seg.add(15, 'day')), status: 'CANCELADO' } });
  const c0 = await db.creditoReposicao.create({ data: { usuarioId: u, origemAgendamentoId: longe.id, expiraEm: seg.add(1, 'day').endOf('day').toDate() } });
  const a = await marcar(u, 1, 'TERCA');
  await svc.cancelar(a.id, u);
  const r = await marcar(u, 1, 'TERCA', true);
  assert.equal(r.creditoId, c0.id, 'usou o crédito da outra semana');
  await marcar(u, 3, 'QUINTA');
  const doA = await db.creditoReposicao.findFirst({ where: { origemAgendamentoId: a.id } });
  assert.equal(doA.revogado, true, 'o crédito que A gerou caiu: a vaga dele foi usada por B');
});

test('caso 2: cancelamento atrasado não cancela a reposição (intercalação real)', { skip: pular }, async () => {
  T = await turmas();
  const u = await aluno('1x');
  const a = await marcar(u, 1, 'TERCA');
  let atrasado;
  await outra.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT id FROM agendamentos WHERE id = $1 FOR UPDATE', a.id);
    atrasado = svc.cancelar(a.id, u).then(() => 'ok', (e) => e);
    assert.ok(await alguemTravado(), 'o pedido atrasado ficou esperando a trava');
    const c1 = await tx.creditoReposicao.create({ data: { usuarioId: u, origemAgendamentoId: a.id, expiraEm: seg.add(40, 'day').toDate() } });
    await tx.agendamento.update({ where: { id: a.id }, data: { status: 'CONFIRMADO', reposicao: true, creditoId: c1.id } });
    await tx.creditoReposicao.update({ where: { id: c1.id }, data: { usado: true, usadoAgendamentoId: a.id } });
  }, { timeout: 20000 });
  const r = await atrasado;
  assert.match(String(r?.message), /reposição não pode ser cancelada/);
  assert.equal((await db.agendamento.findUnique({ where: { id: a.id } })).status, 'CONFIRMADO');
  assert.equal(await db.creditoReposicao.count({ where: { origemAgendamentoId: a.id } }), 1, 'nenhum crédito a mais');
});

test('caso 2: oito cancelamentos simultâneos da mesma aula geram um crédito', { skip: pular }, async () => {
  T = await turmas();
  const u = await aluno('1x');
  const a = await marcar(u, 1, 'TERCA');
  const rs = await Promise.allSettled(Array.from({ length: 8 }, () => svc.cancelar(a.id, u)));
  assert.equal(rs.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await db.creditoReposicao.count({ where: { origemAgendamentoId: a.id } }), 1);
});

test('corrida pela última vaga: entra um', { skip: pular }, async () => {
  T = await turmas();
  const [x, y] = [await aluno('2x'), await aluno('2x')];
  await marcar(x, 2, 'QUARTA');
  await marcar(y, 2, 'QUARTA');
  const corredores = [];
  for (let i = 0; i < 5; i++) corredores.push(await aluno('2x'));
  const rs = await Promise.allSettled(corredores.map((u) => marcar(u, 2, 'QUARTA')));
  assert.equal(rs.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await db.agendamento.count({ where: { horarioId: T.QUARTA, dataAula: meiaNoite(dia(2)), status: 'CONFIRMADO' } }), 3);
});

test('caso 4: a aula futura cancelada aparece para o aluno, e só para ele', { skip: pular }, async () => {
  T = await turmas();
  const u = await aluno('2x');
  const outro = await aluno('2x');
  const a = await marcar(u, 1, 'TERCA');
  await marcar(u, 3, 'QUINTA');
  await svc.cancelar(a.id, u);
  const lista = await svc.listarCanceladasFuturas(u);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, a.id);
  assert.equal(lista[0].canceladaPor, 'aluno');
  assert.equal(lista[0].credito.situacao, 'disponivel');
  assert.equal((await svc.listarMeus(u)).length, 1, 'as ativas seguem só com a quinta');
  assert.equal((await svc.listarCanceladasFuturas(outro)).length, 0);
});
