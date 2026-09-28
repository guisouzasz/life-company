const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { TreinosService } = require('../dist/src/treinos/treinos.service');

/*
  A ficha de treino tem dono (professorId) e carimbo (modalidadeId), e o
  carimbo é o que dá ao professor acesso à ficha. Os dois furos abaixo faziam
  o treino sumir para o professor sem aviso — justamente quando a dona começa
  a mexer nos treinos.
*/

const RUBENS = { id: 'rubens', tipoUsuario: 'PROFESSOR', ativo: true, modalidadeProfessorId: 'musculacao' };
const DONA = { id: 'dona', tipo: 'ADMIN' };
const EX = [{ grupo: 'Pernas', nome: 'LEG PRESS 45', series: 4, repeticoes: '12' }];

// Professores de duas modalidades, como a Gabriele e o Vinicius do estúdio.
const GABRIELE = {
  id: 'gabriele', tipoUsuario: 'PROFESSOR', ativo: true, modalidadeProfessorId: 'musculacao',
  modalidadesProfessor: [{ modalidadeId: 'musculacao' }, { modalidadeId: 'funcional' }],
};
const VINICIUS = {
  id: 'vinicius', tipoUsuario: 'PROFESSOR', ativo: true, modalidadeProfessorId: 'funcional',
  modalidadesProfessor: [{ modalidadeId: 'funcional' }, { modalidadeId: 'musculacao' }],
};
const HELENA_PILATES = { id: 'helena', tipoUsuario: 'PROFESSOR', ativo: true, modalidadeProfessorId: 'pilates' };
// Plano vigente de cada aluno: Ana treina musculação, Bia faz funcional.
const PLANOS = [
  { usuarioId: 'ana', modalidadeId: 'musculacao' },
  { usuarioId: 'bia', modalidadeId: 'funcional' },
];

function ambiente(fichaInicial) {
  const gravado = [];
  const ficha = fichaInicial ?? { id: 'ficha', ativo: true, alunoId: 'ana', professorId: 'rubens', modalidadeId: 'musculacao' };
  const db = {
    usuario: {
      findUnique: async ({ where }) => {
        const pessoas = { rubens: RUBENS, gabriele: GABRIELE, vinicius: VINICIUS, helena: HELENA_PILATES };
        if (pessoas[where.id]) return pessoas[where.id];
        if (where.id === 'ana' || where.id === 'bia') return { id: where.id, tipoUsuario: 'ALUNO' };
        return null;
      },
    },
    usuarioPlano: {
      findMany: async ({ where }) =>
        PLANOS.filter((p) => p.usuarioId === where.usuarioId && where.modalidadeId.in.includes(p.modalidadeId)),
    },
    treino: {
      findUnique: async () => ficha,
      create: async (args) => { gravado.push({ tipo: 'criar', data: args.data }); return args.data; },
      update: async (args) => { gravado.push({ tipo: 'editar', data: args.data }); return args.data; },
    },
  };
  return { db, gravado, ficha, servico: new TreinosService(db) };
}

test('a dona editando sem mandar professor nao rouba a ficha do professor', async () => {
  const { servico, gravado } = ambiente();
  // É o que chegava quando ela tocava no nome do professor e ele desmarcava.
  await servico.atualizar('ficha', { alunoId: 'ana', titulo: 'Full Body 1', exercicios: EX }, DONA);

  const e = gravado.find((g) => g.tipo === 'editar').data;
  assert.equal(e.professorId, 'rubens', 'continua assinada pelo Rubens, não pela dona');
  assert.equal(e.modalidadeId, 'musculacao', 'e o carimbo fica: sem ele o Rubens perde o acesso');
});

test('o professor editando sem mandar professor tambem mantem quem assina', async () => {
  const { servico, gravado } = ambiente();
  await servico.atualizar('ficha', { alunoId: 'ana', titulo: 'Full Body 1', exercicios: EX }, { id: 'rubens', tipo: 'PROFESSOR' });
  assert.equal(gravado.find((g) => g.tipo === 'editar').data.professorId, 'rubens');
});

test('trocar o professor de proposito continua valendo', async () => {
  const { servico, gravado, db } = ambiente();
  const HELENA = { id: 'helena', tipoUsuario: 'PROFESSOR', ativo: true, modalidadeProfessorId: 'pilates' };
  const antigo = db.usuario.findUnique;
  db.usuario.findUnique = async (a) => (a.where.id === 'helena' ? HELENA : antigo(a));

  await servico.atualizar('ficha', { alunoId: 'ana', titulo: 'x', exercicios: EX, professorId: 'helena' }, DONA);
  const e = gravado.find((g) => g.tipo === 'editar').data;
  assert.equal(e.professorId, 'helena');
  assert.equal(e.modalidadeId, 'pilates', 'o carimbo acompanha a professora nova');
});

test('a dona nao cria ficha sem dizer de qual professor e', async () => {
  const { servico, gravado } = ambiente();
  await assert.rejects(
    servico.criar(DONA, { alunoId: 'ana', titulo: 'Full Body 3', exercicios: EX }),
    /professor responsável/,
  );
  assert.equal(gravado.length, 0, 'nada gravado: ficha sem carimbo sumiria para todos os professores');
});

test('com o professor escolhido, a ficha da dona nasce com o carimbo dele', async () => {
  const { servico, gravado } = ambiente();
  await servico.criar(DONA, { alunoId: 'ana', titulo: 'Full Body 3', exercicios: EX, professorId: 'rubens' });
  const c = gravado.find((g) => g.tipo === 'criar').data;
  assert.equal(c.professorId, 'rubens');
  assert.equal(c.modalidadeId, 'musculacao');
});

test('o professor continua criando sem escolher ninguem: a ficha e dele', async () => {
  const { servico, gravado } = ambiente();
  await servico.criar({ id: 'rubens', tipo: 'PROFESSOR' }, { alunoId: 'ana', titulo: 'Full Body 3', exercicios: EX });
  const c = gravado.find((g) => g.tipo === 'criar').data;
  assert.equal(c.professorId, 'rubens');
  assert.equal(c.modalidadeId, 'musculacao');
});

// ── Professor em mais de uma modalidade ─────────────────────────────────

const GAB = { id: 'gabriele', tipo: 'PROFESSOR' };

test('a Gabriele (musculacao e funcional) monta ficha: o carimbo segue o plano do aluno', async () => {
  const { servico, gravado } = ambiente();
  await servico.criar(GAB, { alunoId: 'ana', titulo: 'A', exercicios: EX });
  await servico.criar(GAB, { alunoId: 'bia', titulo: 'B', conteudo: 'circuito' });
  const [ana, bia] = gravado.filter((g) => g.tipo === 'criar').map((g) => g.data);
  assert.equal(ana.modalidadeId, 'musculacao', 'Ana é da musculação');
  assert.equal(bia.modalidadeId, 'funcional', 'Bia é do funcional');
  assert.equal(bia.professorId, 'gabriele');
});

test('a modalidade pedida vale, se for uma das dela; outra e recusada', async () => {
  const { servico, gravado } = ambiente();
  await servico.criar(GAB, { alunoId: 'ana', titulo: 'A', conteudo: 'x', modalidadeId: 'funcional' });
  assert.equal(gravado[0].data.modalidadeId, 'funcional');
  await assert.rejects(
    servico.criar(GAB, { alunoId: 'ana', titulo: 'A', conteudo: 'x', modalidadeId: 'pilates' }),
    /não dá aula nessa modalidade/,
  );
});

test('a Gabriele abre ficha das duas modalidades; o Rubens (so musculacao) nao abre a do funcional', async () => {
  const funcional = { id: 'f', ativo: true, alunoId: 'bia', professorId: 'vinicius', modalidadeId: 'funcional' };
  const { servico, gravado } = ambiente(funcional);
  await servico.definirStatus('f', true, GAB);
  assert.equal(gravado.length, 1, 'a Gabriele arquivou');
  await assert.rejects(servico.definirStatus('f', true, { id: 'rubens', tipo: 'PROFESSOR' }), /outra modalidade/);
});

test('editar a ficha do funcional sem trocar ninguem nao vira musculacao', async () => {
  const funcional = { id: 'f', ativo: true, alunoId: 'ana', professorId: 'gabriele', modalidadeId: 'funcional' };
  const { servico, gravado } = ambiente(funcional);
  // A tela manda o professor marcado de volta — é o caso de todo salvar.
  await servico.atualizar('f', { alunoId: 'ana', titulo: 'x', conteudo: 'y', professorId: 'gabriele' }, GAB);
  assert.equal(gravado[0].data.modalidadeId, 'funcional', 'mesmo a Ana sendo da musculação');
});

test('a dona passa a ficha da Gabriele para o Vinicius: continua sendo musculacao', async () => {
  const ficha = { id: 'm', ativo: true, alunoId: 'bia', professorId: 'gabriele', modalidadeId: 'musculacao' };
  const { servico, gravado } = ambiente(ficha);
  await servico.atualizar('m', { alunoId: 'bia', titulo: 'x', exercicios: EX, professorId: 'vinicius' }, DONA);
  assert.equal(gravado[0].data.professorId, 'vinicius');
  assert.equal(gravado[0].data.modalidadeId, 'musculacao', 'o Vinicius também é da musculação');
});

test('professor passa ficha para colega so no que os dois tem em comum', async () => {
  const { servico, gravado } = ambiente();
  // Gabriele → Rubens: só musculação em comum, mesmo a Bia sendo do funcional.
  await servico.criar(GAB, { alunoId: 'bia', titulo: 'x', exercicios: EX, professorId: 'rubens' });
  assert.equal(gravado[0].data.modalidadeId, 'musculacao');
  // Gabriele → Helena (pilates): nada em comum.
  await assert.rejects(
    servico.criar(GAB, { alunoId: 'bia', titulo: 'x', conteudo: 'x', professorId: 'helena' }),
    /outra modalidade/,
  );
});
