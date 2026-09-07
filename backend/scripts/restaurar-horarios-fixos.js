/**
 * Consulta o histórico desligado, sem restaurar dados.
 * Uso: node scripts/restaurar-horarios-fixos.js
 */
const { PrismaClient } = require('@prisma/client');

if (process.argv.includes('--aplicar')) {
  console.error(
    'Restauração em lote desativada: o histórico inclui horários removidos de propósito. ' +
    'Revise cada aluno em Plano e horários. Nenhum dado foi alterado.',
  );
  process.exit(1);
}

const prisma = new PrismaClient();
(async () => {
  const historicos = await prisma.horarioFixo.count({
    where: { ativo: false, usuario: { ativo: true, tipoUsuario: 'ALUNO' } },
  });
  console.log(`${historicos} horário(s) no histórico desligado de alunos ativos.`);
  console.log('Histórico não significa pendência. Confira os dias atuais no cadastro de cada aluno.');
})()
  .catch((e) => {
    console.error('Consulta não concluída:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
