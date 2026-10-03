/**
 * Regras de agendamento que já deram problema — cada teste guarda uma.
 * Roda sobre o código compilado: `npm run build && node --test tests/agendamento-regras.test.cjs`.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../dist/src/timezone');
require('reflect-metadata');
const dayjs = require('dayjs');
const { AgendamentosService } = require('../dist/src/agendamentos/agendamentos.service');
const { cotaDaSemana } = require('../dist/src/agendamentos/cota-semanal');

/** Banco de mentira: o suficiente para as regras abaixo. */
function banco(extra = {}) {
  const escritas = [];
  const db = {
    agendamento: {
      findFirst: async () => null,
      findUnique: async () => null,
      findMany: async () => [],
      count: async () => 0,
      update: async (a) => { escritas.push(['aula', a]); return { id: 'nova', ...a.data }; },
      updateMany: async (a) => { escritas.push(['aulas', a]); return { count: 1 }; },
      create: async (a) => { escritas.push(['criar', a]); return { id: 'nova', ...a.data }; },
    },
    creditoReposicao: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async (a) => { escritas.push(['credito', a]); return a.data; },
      update: async (a) => { escritas.push(['credito-up', a]); return a.data; },
      updateMany: async (a) => { escritas.push(['creditos-up', a]); return { count: 1 }; },
    },
    diaFechado: { findUnique: async () => null, findMany: async () => [] },
    $queryRaw: async () => [],
    ...extra,
  };
  db.$transaction = async (fn) => (Array.isArray(fn) ? Promise.all(fn) : fn(db));
  return { db, escritas };
}

const amanha18h = () => ({
  id: 'ag', usuarioId: 'aluno', status: 'CONFIRMADO', reposicao: false,
  dataAula: dayjs().add(2, 'day').startOf('day').toDate(),
  horario: { horaInicio: '18:00', modalidade: { nome: 'Academia' } },
});

test('cancelar duas vezes ao mesmo tempo gera UM crédito só', async () => {
  const { db, escritas } = banco();
  db.agendamento.findFirst = async () => amanha18h();
  // O segundo pedido chega depois do primeiro ter cancelado: o update
  // condicional não acha mais a aula CONFIRMADA.
  let vez = 0;
  db.agendamento.updateMany = async (a) => {
    escritas.push(['aulas', a]);
    assert.equal(a.where.status, 'CONFIRMADO', 'só cancela o que ainda está confirmado');
    return { count: vez++ === 0 ? 1 : 0 };
  };
  const s = new AgendamentosService(db);
  await s.cancelar('ag', 'aluno');
  await assert.rejects(s.cancelar('ag', 'aluno'), /já foi cancelada/);
  assert.equal(escritas.filter(([k]) => k === 'credito').length, 1);
});

test('cota da semana conta a aula cancelada que já virou reposição e a do dia fechado', async () => {
  const { db } = banco();
  db.agendamento.count = async () => 0;
  db.agendamento.findMany = async (a) =>
    a.where.diaFechadoId
      ? [{ dataAula: new Date(2026, 9, 12), diaFechado: { motivo: 'Feriado' } }]
      : [{ id: 'cancelada', dataAula: new Date(2026, 9, 5) }];
  db.creditoReposicao.findMany = async (a) => {
    assert.equal(a.where.concedidoAdmin, false, 'crédito do estúdio não ocupa a semana');
    return [{ id: 'c1', usado: true, origemAgendamentoId: 'cancelada' }];
  };
  const cota = await cotaDaSemana(db, 'aluno', new Date(2026, 9, 5), new Date(2026, 9, 11));
  assert.equal(cota.usadas, 1, 'a do feriado conta');
  assert.equal(cota.repostas.length, 1, 'a reposta conta');
  assert.equal(cota.creditoLivreId, null);
});

test('reposição só usa crédito que vale no DIA DA AULA', async () => {
  const { db } = banco();
  let dia = dayjs().add(3, 'day');
  while (dia.day() !== 1) dia = dia.add(1, 'day');
  db.horario = { findUnique: async () => ({ id: 'h', ativo: true, diaSemana: 'SEGUNDA', horaInicio: '18:00', capacidadeMaxima: 4, modalidade: { nome: 'Academia' } }) };
  db.usuarioPlano = { findFirst: async () => ({ id: 'up', plano: { aulasSemanais: 1 } }), findUnique: async () => ({ id: 'up', vigenciaFim: null }) };
  let filtro;
  db.creditoReposicao.findFirst = async (a) => { filtro = filtro ?? a.where; return null; };
  const s = new AgendamentosService(db);
  await assert.rejects(s.criar('aluno', { horarioId: 'h', dataAula: dia.format('YYYY-MM-DD'), usarCredito: true }));
  assert.ok(filtro.expiraEm.gte, 'filtra pela data da aula');
  assert.equal(dayjs(filtro.expiraEm.gte).format('YYYY-MM-DD'), dia.format('YYYY-MM-DD'));
});

test('dia fechado recusa a aula, mesmo para a dona', async () => {
  const { db } = banco();
  let dia = dayjs().add(3, 'day');
  while (dia.day() !== 1) dia = dia.add(1, 'day');
  db.usuario = { findUnique: async () => ({ id: 'aluno', nome: 'Ana Teste', ativo: true, tipoUsuario: 'ALUNO' }) };
  db.horario = { findUnique: async () => ({ id: 'h', ativo: true, diaSemana: 'SEGUNDA', horaInicio: '18:00', capacidadeMaxima: 4, modalidade: { nome: 'Academia' } }) };
  db.usuarioPlano = { findFirst: async () => ({ id: 'up', plano: { aulasSemanais: 3 } }), findUnique: async () => ({ id: 'up', vigenciaFim: null }) };
  db.diaFechado.findUnique = async () => ({ id: 'f', motivo: 'Feriado' });
  const s = new AgendamentosService(db);
  await assert.rejects(s.criar('aluno', { horarioId: 'h', dataAula: dia.format('YYYY-MM-DD') }), /não abre .*\(Feriado\)/);
  await assert.rejects(s.criarComoAdmin({ usuarioId: 'aluno', horarioId: 'h', dataAula: dia.format('YYYY-MM-DD') }), /não abre/);
});

test('dona desmarca reposição: o crédito volta (o mesmo, sem prazo novo)', async () => {
  const { db, escritas } = banco();
  db.agendamento.findUnique = async () => ({ ...amanha18h(), reposicao: true, creditoId: 'c1' });
  const r = await new AgendamentosService(db).desmarcarSemCredito('ag');
  const devolve = escritas.find(([k]) => k === 'creditos-up');
  assert.ok(devolve, 'devolve o crédito');
  assert.equal(devolve[1].where.id, 'c1');
  assert.equal(devolve[1].data.usado, false);
  assert.equal(devolve[1].data.expiraEm, undefined, 'não mexe na validade');
  assert.match(r.mensagem, /crédito de reposição voltou/);
  assert.equal(escritas.filter(([k]) => k === 'credito').length, 0, 'nenhum crédito novo');
});
