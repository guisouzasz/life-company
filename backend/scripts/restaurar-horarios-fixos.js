/**
 * Devolve os horários fixos que foram desligados junto com a inativação.
 *
 *   cd backend && node scripts/restaurar-horarios-fixos.js            ← só mostra
 *   cd backend && node scripts/restaurar-horarios-fixos.js --aplicar  ← faz
 *
 * POR QUE ISTO EXISTE
 *
 * Marcar um aluno como inativo tira ele dos horários fixos e cancela as aulas
 * futuras dele — é o conserto do problema das turmas lotadas de gente que não
 * treina mais. Mas a volta não existia: reativar o aluno NÃO devolvia os
 * horários. Quem inativou muita gente de uma vez perdeu a grade inteira e
 * teria que remontar aluno por aluno.
 *
 * Nada foi apagado. O horário fixo virou `ativo: false` e as aulas viraram
 * `CANCELADO`; as linhas continuam no banco. Este script liga os horários de
 * volta.
 *
 * O QUE ELE NÃO SABE
 *
 * A tabela não guarda QUANDO um horário fixo foi desligado, então não dá para
 * separar "desligado agora pela inativação" de "removido pela dona há três
 * meses". Por isso o padrão é só LISTAR: leia, confira que os nomes e os dias
 * fazem sentido, e só então rode com --aplicar. O que voltar demais se remove
 * pelo painel, no cadastro do aluno.
 *
 * As aulas não são recriadas aqui: assim que a agenda da semana for aberta —
 * ou no cron das 3h — elas nascem de novo a partir do horário fixo, já
 * respeitando lotação e cota do plano. Recriar na mão furaria essas duas
 * regras.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const DIA = { SEGUNDA: 'segunda', TERCA: 'terça', QUARTA: 'quarta', QUINTA: 'quinta', SEXTA: 'sexta' };

(async () => {
  console.log('═'.repeat(64));
  console.log(APLICAR ? 'RESTAURANDO OS HORÁRIOS FIXOS' : 'O QUE SERIA RESTAURADO (nada muda agora)');
  console.log('═'.repeat(64));

  /*
    Só alunos que estão ATIVOS agora. A dona decide quem volta reativando no
    painel; o script não reativa ninguém por conta própria — devolver acesso a
    quem ela desligou de verdade é decisão dela.
  */
  const desligados = await prisma.horarioFixo.findMany({
    where: { ativo: false, usuario: { ativo: true, tipoUsuario: 'ALUNO' } },
    include: {
      usuario: { select: { id: true, nome: true } },
      horario: { include: { modalidade: true } },
    },
    orderBy: [{ usuario: { nome: 'asc' } }],
  });

  const inativos = await prisma.usuario.count({
    where: { ativo: false, senhaHash: { not: null }, tipoUsuario: 'ALUNO' },
  });

  if (inativos > 0) {
    console.log(
      `\n⚠  ${inativos} aluno(s) ainda estão INATIVOS e por isso ficaram de fora.\n` +
        '   Reative no painel quem deve voltar e rode de novo — o script só mexe em aluno ativo.\n',
    );
  }

  if (desligados.length === 0) {
    console.log('\nNenhum horário fixo desligado para devolver.');
    return;
  }

  const porAluno = new Map();
  for (const f of desligados) {
    if (!porAluno.has(f.usuarioId)) porAluno.set(f.usuarioId, []);
    porAluno.get(f.usuarioId).push(f);
  }

  console.log(`\n${porAluno.size} aluno(s), ${desligados.length} horário(s) fixo(s):\n`);
  for (const [, lista] of porAluno) {
    const nome = lista[0].usuario.nome;
    const quando = lista
      .map((f) => `${DIA[f.horario.diaSemana]} ${f.horario.horaInicio}`)
      .join(', ');
    console.log(`   ${nome} — ${quando}`);
  }

  if (!APLICAR) {
    console.log(
      '\n' + '─'.repeat(64) +
        '\nNada foi alterado. Confira a lista acima e, se estiver certa, rode:\n' +
        '   node scripts/restaurar-horarios-fixos.js --aplicar',
    );
    return;
  }

  const { count } = await prisma.horarioFixo.updateMany({
    where: { id: { in: desligados.map((f) => f.id) } },
    data: { ativo: true },
  });

  console.log(
    '\n' + '─'.repeat(64) +
      `\n✓ ${count} horário(s) fixo(s) religado(s).\n\n` +
      'As aulas voltam sozinhas: abra a Agenda da semana no painel e elas são\n' +
      'criadas na hora, respeitando lotação e cota do plano. O cron das 3h faz\n' +
      'o mesmo para as semanas seguintes.',
  );
})()
  .catch((e) => {
    console.error('\nNão terminou:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
