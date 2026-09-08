const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
require('../dist/src/timezone');
require('reflect-metadata');
const dayjs = require('dayjs');
const { DiagnosticoService } = require('../dist/src/diagnostico/diagnostico.service');
const { UsuariosService } = require('../dist/src/usuarios/usuarios.service');
const { HorariosService } = require('../dist/src/horarios/horarios.service');
const { HorariosFixosService } = require('../dist/src/horarios-fixos/horarios-fixos.service');
const { AgendamentosService } = require('../dist/src/agendamentos/agendamentos.service');
const { AutoAgendamentoService } = require('../dist/src/auto-agendamento/auto-agendamento.service');
const { varrerHorariosFixos } = require('../dist/src/diagnostico/varredura-horarios-fixos');
const { corrigirMatricula } = require('../dist/src/prisma/corrigir-matricula');

test('reinicio do servidor preserva inativacao de aluno sem primeiro acesso', async () => {
  let filtro;
  await corrigirMatricula({ usuario: { count: async args => { filtro = args.where; return 1; } } });
  assert.equal(filtro.ativo, false);
  assert.equal(filtro.senhaHash, null);
  assert.ok(filtro.NOT);
});

function ambiente() {
  const writes = [];
  const locks = [];
  const aluno = { id: 'aluno', nome: 'Aluno Teste', ativo: true, tipoUsuario: 'ALUNO' };
  const plano = { id: 'plano', nome: '3x', aulasSemanais: 3 };
  const vinculo = { id: 'vinculo', vigenciaFim: null, plano };
  const turma = { id: 'turma', ativo: true, diaSemana: 'SEGUNDA', horaInicio: '08:00', horaFim: '08:55', capacidadeMaxima: 3, modalidade: { nome: 'Pilates' }, _count: { agendamentos: 1, horariosFixos: 1 } };
  const fixo = { id: 'fixo', usuarioId: aluno.id, horarioId: turma.id, ativo: true, dataInicio: new Date(2026, 0, 1), dataFim: null, horario: turma };
  const write = (kind) => async (args) => { writes.push({ kind, args }); return { ...args.data, id: args.where?.id ?? kind, count: 2 }; };
  const db = {
    usuario: { findUnique: async () => aluno, update: write('usuario') },
    usuarioPlano: { findFirst: async () => vinculo, findUnique: async () => vinculo, update: write('encerrar-plano'), create: write('plano') },
    plano: { findUnique: async () => plano },
    horario: { findUnique: async () => turma, update: write('turma'), delete: write('excluir-turma') },
    horarioFixo: { findUnique: async () => fixo, count: async () => 1, create: write('fixo'), update: write('fixo'), updateMany: write('fixos') },
    agendamento: { findFirst: async () => null, count: async () => 0, create: write('aula'), update: write('aula'), updateMany: write('cancelar-aulas') },
    $queryRaw: async (parts) => { locks.push(parts.join('?')); return []; },
  };
  db.$transaction = async (fn) => fn(db);
  return { db, writes, locks, aluno, plano, vinculo, turma, fixo };
}

/*
  A devolução voltou a existir, mas ESCOLHIDA. A propriedade que o teste
  anterior guardava continua guardada aqui: nada é restaurado sem alguém
  apontar exatamente o quê.
*/
test('devolucao restaura somente os ids pedidos, e nada alem deles', async () => {
  const a = ambiente();
  let filtro;
  a.db.horarioFixo.findMany = async (args) => {
    filtro = args.where;
    return [{
      ...a.fixo, id: 'pedido', ativo: false,
      usuario: { ...a.aluno, usuarioPlanos: [a.vinculo], horariosFixos: [] },
      horario: a.turma,
    }];
  };
  const gerou = [];
  const auto = { gerarAgendamentosFixosNoPeriodo: async () => { gerou.push(1); return { criados: 4 }; } };

  const r = await new DiagnosticoService(a.db, auto).restaurarHorariosFixos({ ids: ['pedido'] });

  assert.deepEqual(filtro.id, { in: ['pedido'] }, 'só busca o que foi pedido');
  assert.equal(filtro.ativo, false, 'e só entre os desligados');
  assert.equal(r.devolvidos, 1);
  assert.equal(r.aulasRemarcadas, 4);
  assert.deepEqual(a.writes.map((w) => w.kind), ['fixo']);
  assert.equal(a.writes[0].args.where.id, 'pedido');
  assert.equal(gerou.length, 1, 'remarca, para a conferência seguinte vir limpa');
});

test('devolucao recusa aluno desligado, turma morta e plano completo', async () => {
  for (const [nome, mudaAluno, mudaTurma, esperado] of [
    ['desligado', { ativo: false }, {}, /não treina mais/],
    ['turma morta', {}, { ativo: false }, /turma está desligada/],
  ]) {
    const a = ambiente();
    a.db.horarioFixo.findMany = async () => [{
      ...a.fixo, ativo: false,
      usuario: { ...a.aluno, ...mudaAluno, usuarioPlanos: [a.vinculo], horariosFixos: [] },
      horario: { ...a.turma, ...mudaTurma },
    }];
    const r = await new DiagnosticoService(a.db, {}).restaurarHorariosFixos({ ids: ['fixo'] });
    assert.equal(r.devolvidos, 0, nome);
    assert.equal(a.writes.length, 0, `${nome}: nada foi escrito`);
    assert.match(r.recusados[0].motivo, esperado, nome);
  }

  const a = ambiente();
  a.db.horarioFixo.findMany = async () => [{
    ...a.fixo, ativo: false,
    usuario: { ...a.aluno, usuarioPlanos: [a.vinculo], horariosFixos: [{ id: '1' }, { id: '2' }, { id: '3' }] },
    horario: a.turma,
  }];
  const r = await new DiagnosticoService(a.db, {}).restaurarHorariosFixos({ ids: ['fixo'] });
  assert.equal(r.devolvidos, 0);
  assert.equal(a.writes.length, 0);
  assert.match(r.recusados[0].motivo, /plano 3x já está completo/);
});

test('devolver varios do mesmo aluno respeita a cota somando os que acabaram de entrar', async () => {
  const a = ambiente();
  a.plano.aulasSemanais = 2;
  const desligado = (id) => ({
    ...a.fixo, id, ativo: false,
    usuario: { ...a.aluno, usuarioPlanos: [a.vinculo], horariosFixos: [] },
    horario: a.turma,
  });
  a.db.horarioFixo.findMany = async () => [desligado('a'), desligado('b'), desligado('c')];
  const r = await new DiagnosticoService(a.db, {}).restaurarHorariosFixos({ ids: ['a', 'b', 'c'] });
  assert.equal(r.devolvidos, 2, 'plano 2x recebe dois, não três');
  assert.equal(a.writes.length, 2);
  assert.match(r.recusados[0].motivo, /já está completo/);
});

test('script legado recusa --aplicar antes de conectar ao banco', () => {
  const r = spawnSync(process.execPath, ['scripts/restaurar-horarios-fixos.js', '--aplicar'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'invalid' } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Nenhum dado foi alterado/);
});

test('reativar aluno com seis fixos antigos nao restaura nenhum', async () => {
  const a = ambiente();
  a.aluno.ativo = false;
  a.db.horarioFixo.count = async () => 6;
  const r = await new UsuariosService(a.db, {}).atualizar('aluno', { ativo: true });
  assert.equal(r.horariosFixosDevolvidos, 0);
  assert.equal(r.revisarHorariosFixos, true);
  assert.deepEqual(a.writes.map(w => w.kind), ['usuario']);
});

test('reduzir plano abaixo dos fixos recusa sem encerrar o plano atual', async () => {
  const a = ambiente();
  a.db.horarioFixo.count = async () => 3;
  a.db.plano.findUnique = async () => ({ id: 'novo', aulasSemanais: 2 });
  await assert.rejects(new UsuariosService(a.db, {}).atualizarPlano('aluno', { planoId: 'novo', modalidadeId: 'm' }), /Revise os horários fixos/);
  assert.equal(a.writes.length, 0);
  assert.match(a.locks[1], /usuario_planos/);
});

test('plano que comporta os fixos pode ser alterado', async () => {
  const a = ambiente();
  await new UsuariosService(a.db, {}).atualizarPlano('aluno', { planoId: 'plano', modalidadeId: 'm' });
  assert.deepEqual(a.writes.map(w => w.kind), ['encerrar-plano', 'plano']);
});

for (const acao of ['bloquear', 'excluir', 'atualizar']) {
  for (const vinculo of ['fixos', 'aulas']) {
    test(`${acao} turma com ${vinculo} pendentes recusa sem alterar dados`, async () => {
      const a = ambiente();
      a.db.horarioFixo.count = async () => vinculo === 'fixos' ? 1 : 0;
      a.db.agendamento.count = async () => vinculo === 'aulas' ? 1 : 0;
      await assert.rejects(new HorariosService(a.db, {})[acao]('turma', { ativo: false }), /Remaneje os alunos/);
      assert.equal(a.writes.length, 0);
      assert.match(a.locks[0], /horarios/);
    });
  }
}

test('turma sem vinculos pode ser desligada', async () => {
  const a = ambiente();
  a.db.horarioFixo.count = async () => 0;
  const r = await new HorariosService(a.db, {}).bloquear('turma');
  assert.equal(r.ativo, false);
});

for (const cota of [1, 2, 3]) {
  test(`plano ${cota}x recusa fixo extra antes de gerar aula`, async () => {
    const a = ambiente();
    a.plano.aulasSemanais = cota;
    a.db.horarioFixo.findUnique = async () => null;
    a.db.horarioFixo.count = async () => cota;
    const auto = { gerarParaHorarioFixoId: async () => { throw Error('Nao deve gerar'); } };
    await assert.rejects(new HorariosFixosService(a.db, auto).criar('aluno', { horarioId: 'turma' }), /Limite de horários fixos/);
    assert.equal(a.writes.length, 0);
  });
}

test('novo fixo valido gera aulas imediatamente', async () => {
  const a = ambiente();
  a.db.horarioFixo.findUnique = async () => null;
  let gerado;
  const auto = { gerarParaHorarioFixoId: async (id) => { gerado = id; return { criados: 8, ignorados: 0, erros: 0, motivos: [], datas: [] }; } };
  const r = await new HorariosFixosService(a.db, auto).criar('aluno', { horarioId: 'turma', dataInicio: '2026-09-07' });
  assert.equal(gerado, 'fixo');
  assert.equal(r.geracao.criados, 8);
  assert.equal(dayjs(a.writes[0].args.data.dataInicio).format('YYYY-MM-DD'), '2026-09-07');
  assert.match(a.locks[0], /horarios/);
});

test('reenvio do mesmo fixo nao cria registro duplicado', async () => {
  const a = ambiente();
  const auto = { gerarParaHorarioFixoId: async () => ({ criados: 0, ignorados: 8, erros: 0, motivos: [], datas: [] }) };
  await new HorariosFixosService(a.db, auto).criar('aluno', { horarioId: 'turma' });
  assert.equal(a.writes.length, 1);
  assert.equal(a.writes[0].args.where.id, 'fixo');
});

test('novo fixo sem nenhuma vaga nao fica ativo', async () => {
  const a = ambiente();
  a.db.horarioFixo.findUnique = async () => null;
  const auto = { gerarParaHorarioFixoId: async () => ({ criados: 0, ignorados: 0, erros: 8, motivos: ['Horário cheio'], datas: [] }) };
  await assert.rejects(new HorariosFixosService(a.db, auto).criar('aluno', { horarioId: 'turma' }), /Horário cheio/);
  assert.equal(a.writes.at(-1).args.data.ativo, false);
});

test('remover fixo desliga e cancela aulas na mesma transacao, preservando reposicoes', async () => {
  const a = ambiente();
  let dentro = false;
  a.db.$transaction = async fn => { dentro = true; try { return await fn(a.db); } finally { dentro = false; } };
  const write = a.db.agendamento.updateMany;
  a.db.agendamento.updateMany = async args => { assert.ok(dentro); return write(args); };
  await new HorariosFixosService(a.db, {}).remover('fixo');
  assert.deepEqual(a.writes.map(w => w.kind), ['fixo', 'cancelar-aulas']);
  assert.equal(a.writes[1].args.where.reposicao, false);
  assert.ok(a.writes[1].args.where.dataAula.gte);
});

function proximaSegunda() {
  let d = dayjs().add(1, 'day');
  while (d.day() !== 1) d = d.add(1, 'day');
  return d.format('YYYY-MM-DD');
}

test('geracao com leitura antiga nao recria aula de fixo removido', async () => {
  const a = ambiente();
  a.fixo.ativo = false;
  await assert.rejects(new AgendamentosService(a.db).criarComoAdmin({ usuarioId: 'aluno', horarioId: 'turma', dataAula: proximaSegunda() }, 'fixo'), /fixo foi removido/);
  assert.equal(a.writes.length, 0);
});

test('turma desligada enquanto aguarda trava nao recebe aula', async () => {
  const a = ambiente();
  a.db.$queryRaw = async () => { a.turma.ativo = false; return []; };
  await assert.rejects(new AgendamentosService(a.db).criarComoAdmin({ usuarioId: 'aluno', horarioId: 'turma', dataAula: proximaSegunda() }), /Turma desligada/);
  assert.equal(a.writes.length, 0);
});

test('admin nao marca aula lotada', async () => {
  const a = ambiente();
  a.db.agendamento.count = async () => 3;
  await assert.rejects(new AgendamentosService(a.db).criarComoAdmin({ usuarioId: 'aluno', horarioId: 'turma', dataAula: proximaSegunda() }), /Horário cheio/);
  assert.equal(a.writes.length, 0);
});

test('geracao individual ignora turma desligada', async () => {
  const a = ambiente();
  a.turma.ativo = false;
  const r = await new AutoAgendamentoService(a.db, {}).gerarParaHorarioFixoId('fixo');
  assert.equal(r.criados, 0);
});

/*
  O achado oferece devolução, mas continua sendo REVISÃO: gravidade "atenção",
  e o filtro que separa o acidente do remanejamento segue intacto — quem ainda
  tem um fixo ativo (porque foi remanejado, não apagado) não entra na lista.
*/
test('conferencia trata historico como revisao e so oferece devolucao escolhida', async () => {
  const a = ambiente();
  a.fixo.usuario = { ...a.aluno, usuarioPlanos: [a.vinculo] };
  let filtroHistorico;
  a.db.horarioFixo.findMany = async args => {
    if (args.where.ativo) return [];
    filtroHistorico = args.where;
    return [{ ...a.fixo, ativo: false }];
  };
  a.db.horario.findMany = async () => [a.turma];
  a.db.agendamento.findMany = async () => [];
  const r = await varrerHorariosFixos(a.db);
  assert.equal(r.resumo.graves, 0);
  assert.equal(r.achados[0].gravidade, 'atencao');
  assert.equal(r.achados[0].acao, 'restaurar-horarios-fixos');
  // Sem os ids na linha, a tela não teria o que mandar e a única devolução
  // possível voltaria a ser "todos" — que é justamente o que não se quer.
  assert.deepEqual(r.achados[0].itens[0].horarioFixoIds, ['fixo']);
  assert.deepEqual(filtroHistorico.usuario.horariosFixos, { none: { ativo: true } });
  assert.equal(filtroHistorico.horario.ativo, true);
});

test('conferencia aponta excesso real e turma desligada sem dados de escrita', async () => {
  const a = ambiente();
  a.fixo.usuario = { ...a.aluno, usuarioPlanos: [a.vinculo] };
  const fixos = Array.from({ length: 6 }, (_, i) => ({ ...a.fixo, id: `f${i}`, horarioId: `h${i}`, horario: { ...a.turma, id: `h${i}`, ativo: i !== 0 } }));
  a.db.horarioFixo.findMany = async args => args.where.ativo ? fixos : [];
  a.db.horario.findMany = async () => fixos.map(f => f.horario);
  let consultas = 0;
  a.db.agendamento.findMany = async () => { consultas++; return []; };
  const r = await varrerHorariosFixos(a.db);
  assert.ok(r.achados.some(x => x.tipo === 'fixos-acima-do-plano'));
  assert.ok(r.achados.some(x => x.tipo === 'fixo-em-turma-desligada'));
  assert.equal(consultas, 1);
  assert.equal(a.writes.length, 0);
});
