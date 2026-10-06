const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../dist/src/timezone');
require('reflect-metadata');
const { conferirHorariosFixos } = require('../dist/src/conferencia/conferir-horarios-fixos');
const { ConferenciaService } = require('../dist/src/conferencia/conferencia.service');

/*
  A conferência das 08:00 dos horários fixos. O que mais importa nela é não
  dar alarme falso — alerta que toca à toa vira alerta que ninguém lê:
  aula do fixo que tem QUALQUER linha no dia (o aluno cancelou, a dona tirou,
  a academia fechou) é decisão de alguém e não aparece.
*/

// Segunda, 19/10/2026, 08:00 no fuso do estúdio.
const SEGUNDA_8H = new Date('2026-10-19T08:00:00-03:00');
const meiaNoite = (iso) => new Date(`${iso}T00:00:00-03:00`);

const turma = (id, diaSemana, horaInicio, horaFim, nome = 'Pilates', cap = 3) => ({
  id, diaSemana, horaInicio, horaFim, capacidadeMaxima: cap, ativo: true, modalidade: { nome },
});
const plano2x = { plano: { nome: '2x por semana', aulasSemanais: 2 } };

function banco({ fixos = [], aulas = [], alunos = [] }) {
  return {
    horarioFixo: { findMany: async () => fixos },
    agendamento: { findMany: async () => aulas },
    usuario: { findMany: async () => alunos },
  };
}
const fixoDe = (usuarioId, nome, horario, extra = {}) => ({
  id: `f-${usuarioId}-${horario.id}`, usuarioId, horarioId: horario.id, ativo: true,
  dataInicio: meiaNoite('2026-10-01'), dataFim: null,
  usuario: { id: usuarioId, nome, ativo: true, usuarioPlanos: [plano2x] },
  horario, ...extra,
});
const aula = (usuarioId, nome, horario, dia, status = 'CONFIRMADO', extra = {}) => ({
  usuarioId, horarioId: horario.id, dataAula: meiaNoite(dia), status, reposicao: false, diaFechadoId: null,
  usuario: { nome }, horario, ...extra,
});

const terca8 = turma('pil-TERCA-08:00', 'TERCA', '08:00', '09:00');

test('fixo com a aula marcada: nada a revisar', async () => {
  const r = await conferirHorariosFixos(
    banco({ fixos: [fixoDe('ana', 'ANA LIMA', terca8)], aulas: [aula('ana', 'ANA LIMA', terca8, '2026-10-20')] }),
    SEGUNDA_8H,
  );
  assert.equal(r.pendencias, 0);
  assert.equal(r.de, '2026-10-19');
  assert.equal(r.ate, '2026-10-23');
});

test('fixo sem a aula no dia: aparece, com o dia e a turma', async () => {
  const r = await conferirHorariosFixos(banco({ fixos: [fixoDe('ana', 'ANA LIMA', terca8)] }), SEGUNDA_8H);
  assert.equal(r.pendencias, 1);
  assert.equal(r.pontos[0].tipo, 'fixo-sem-aula');
  assert.match(r.pontos[0].itens[0].texto, /ANA LIMA — terça 20\/10 às 08:00 \(Pilates\)$/);
  assert.equal(r.pontos[0].itens[0].nome, 'ANA LIMA');
});

test('aula cancelada (pelo aluno, pela dona ou dia fechado) NÃO é alarme', async () => {
  for (const extra of [{}, { diaFechadoId: 'feriado' }]) {
    const r = await conferirHorariosFixos(
      banco({ fixos: [fixoDe('ana', 'ANA LIMA', terca8)], aulas: [aula('ana', 'ANA LIMA', terca8, '2026-10-20', 'CANCELADO', extra)] }),
      SEGUNDA_8H,
    );
    assert.equal(r.pendencias, 0, JSON.stringify(extra));
  }
});

test('o motivo vem junto: turma cheia nesse dia', async () => {
  const cheia = ['b', 'c', 'd'].map((u) => aula(u, u.toUpperCase(), terca8, '2026-10-20'));
  const r = await conferirHorariosFixos(banco({ fixos: [fixoDe('ana', 'ANA LIMA', terca8)], aulas: cheia }), SEGUNDA_8H);
  assert.match(r.pontos[0].itens[0].texto, /turma cheia nesse dia \(3\/3\)/);
});

test('turma acima da capacidade e aluno em duas aulas no mesmo horário', async () => {
  const musc8 = turma('aca-TERCA-08:00', 'TERCA', '08:00', '09:00', 'Academia', 4);
  const quatro = ['a', 'b', 'c', 'd'].map((u) => aula(u, u.toUpperCase(), terca8, '2026-10-20'));
  const r = await conferirHorariosFixos(
    banco({ aulas: [...quatro, aula('a', 'A', musc8, '2026-10-20')] }),
    SEGUNDA_8H,
  );
  const tipos = r.pontos.map((p) => p.tipo);
  assert.ok(tipos.includes('turma-acima-da-capacidade'));
  assert.ok(tipos.includes('aluno-em-duas-aulas'));
  const duas = r.pontos.find((p) => p.tipo === 'aluno-em-duas-aulas').itens[0].texto;
  assert.match(duas, /Pilates às 08:00 e Musculação às 08:00/);
});

test('aula de hoje que já começou não é cobrada', async () => {
  const seg7 = turma('pil-SEGUNDA-07:00', 'SEGUNDA', '07:00', '08:00');
  const r = await conferirHorariosFixos(banco({ fixos: [fixoDe('ana', 'ANA LIMA', seg7)] }), SEGUNDA_8H);
  // a de hoje (19/10 às 7h) já passou; a próxima segunda (26/10) fica fora dos 7 dias
  assert.equal(r.pendencias, 0);
});

test('fixo terminando e aluno sem fixo nem aula são só avisos (não acendem o alerta)', async () => {
  const r = await conferirHorariosFixos(
    banco({
      fixos: [fixoDe('ana', 'ANA LIMA', terca8, { dataFim: new Date('2026-10-22T23:59:59-03:00') })],
      aulas: [aula('ana', 'ANA LIMA', terca8, '2026-10-20')],
      alunos: [{ id: 'bia', nome: 'BIA SOUZA', usuarioPlanos: [plano2x] }],
    }),
    SEGUNDA_8H,
  );
  assert.equal(r.pendencias, 0);
  assert.equal(r.avisos, 2);
  assert.deepEqual(r.pontos.map((p) => p.nivel), ['aviso', 'aviso']);
});

// ── O serviço: às 08:00, no fuso do estúdio, e o e-mail só com pendência ──

test('roda todo dia às 08:00 no fuso de São Paulo', () => {
  const opcoes = Reflect.getMetadata('SCHEDULE_CRON_OPTIONS', ConferenciaService.prototype.rodarAgendada);
  assert.equal(opcoes.cronTime, '0 8 * * *');
  assert.equal(opcoes.timeZone, 'America/Sao_Paulo');
});

function servico({ ligado = true, comPendencia = true } = {}) {
  const enviados = [];
  let gravado;
  const prisma = {
    ...banco({ fixos: comPendencia ? [fixoDe('ana', 'ANA LIMA', terca8)] : [] }),
    conferenciaDiaria: {
      upsert: async ({ create }) => (gravado = { id: 'c1', ...create }),
      update: async ({ data }) => (gravado = { ...gravado, ...data }),
      findUnique: async () => gravado ?? null,
    },
  };
  // O mesmo findMany responde à conferência (alunos) e à lista de quem recebe o e-mail.
  prisma.usuario.findMany = async (args) => (args?.where?.tipoUsuario === 'ADMIN' ? [{ email: 'dona@estudio.com' }] : []);
  const email = { ligado, enviar: async (...a) => { enviados.push(a); return true; } };
  return { s: new ConferenciaService(prisma, email), enviados, gravado: () => gravado };
}

test('com pendência e e-mail ligado: manda o e-mail para a dona', async () => {
  const { s, enviados, gravado } = servico();
  await s.rodarAgendada();
  assert.equal(gravado().pendencias, 1);
  assert.equal(enviados.length, 1);
  const [para, assunto, texto] = enviados[0];
  assert.equal(para, 'dona@estudio.com');
  assert.match(assunto, /1 ponto para revisar/);
  // O serviço confere a partir de agora (relógio de verdade): a terça é a próxima que vier.
  assert.match(texto, /ANA LIMA — terça \d\d\/\d\d às 08:00 \(Pilates\)/);
});

test('sem pendência, ou sem e-mail configurado: não manda nada', async () => {
  for (const op of [{ comPendencia: false }, { ligado: false }]) {
    const { s, enviados } = servico(op);
    await s.rodarAgendada();
    assert.equal(enviados.length, 0, JSON.stringify(op));
  }
});

test('marcar como revisada guarda quando e quem', async () => {
  const { s, gravado } = servico();
  await s.rodar();
  const r = await s.marcarRevisada('c1', 'MARIA DONA');
  assert.ok(r.revisadaEm instanceof Date);
  assert.equal(r.revisadaPor, 'MARIA DONA');
  assert.equal(gravado().revisadaPor, 'MARIA DONA');
});
