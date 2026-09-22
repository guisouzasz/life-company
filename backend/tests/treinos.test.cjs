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

function ambiente() {
  const gravado = [];
  const ficha = { id: 'ficha', ativo: true, alunoId: 'ana', professorId: 'rubens', modalidadeId: 'musculacao' };
  const db = {
    usuario: {
      findUnique: async ({ where }) => {
        if (where.id === 'rubens') return RUBENS;
        if (where.id === 'ana') return { id: 'ana', tipoUsuario: 'ALUNO' };
        return null;
      },
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
