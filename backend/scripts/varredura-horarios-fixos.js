/**
 * Varredura dos horários fixos pela linha de comando — SOMENTE LEITURA.
 *
 *   cd backend && npm run auditoria:fixos
 *
 * O DATABASE_URL vem do ambiente. Para apontar no banco de produção sem a
 * senha passar por lugar nenhum:
 *
 *   railway run npm run auditoria:fixos
 *
 * A conferência em si mora em `src/diagnostico/varredura-horarios-fixos.ts`,
 * a MESMA que a tela de Diagnóstico do painel usa. Aqui só formatamos para o
 * terminal: duas cópias da regra divergiriam, e aí a tela e o comando
 * passariam a discordar sobre o mesmo estúdio.
 */
const path = require('path');
const { PrismaClient } = require('@prisma/client');

let varrerHorariosFixos;
try {
  ({ varrerHorariosFixos } = require(path.join(__dirname, '..', 'dist', 'src', 'diagnostico', 'varredura-horarios-fixos')));
} catch {
  console.error(
    'Não achei a versão compilada da varredura.\n' +
      'Rode `npm run build` na pasta backend antes (o deploy já faz isso).',
  );
  process.exit(1);
}

const prisma = new PrismaClient();
const LARGURA = 64;
const brasileiro = (iso) => {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

(async () => {
  const r = await varrerHorariosFixos(prisma);

  console.log('═'.repeat(LARGURA));
  console.log('VARREDURA DOS HORÁRIOS FIXOS — somente leitura');
  console.log(`rodada em ${brasileiro(r.rodadaEm)}`);
  console.log('═'.repeat(LARGURA));
  console.log(`horários fixos ativos: ${r.resumo.fixosAtivos}`);
  console.log(`turmas cadastradas: ${r.resumo.turmas} (${r.resumo.turmasAtivas} ativas)`);
  console.log();

  if (r.achados.length === 0) {
    console.log('✓ Nenhum problema encontrado. Todo aluno com horário fixo está na turma dele.');
    return;
  }

  for (const a of r.achados) {
    console.log('─'.repeat(LARGURA));
    console.log(`${a.gravidade === 'grave' ? '‼' : '•'} ${a.titulo}`);
    console.log();
    for (const i of a.itens.slice(0, 40)) console.log(`   ${i.texto}`);
    if (a.itens.length > 40) console.log(`   … e mais ${a.itens.length - 40}`);
    console.log();
    console.log(`   → ${a.oQueFazer}`);
  }
  console.log('─'.repeat(LARGURA));
  console.log(`\n${r.resumo.graves} problema(s) grave(s), ${r.resumo.atencao} ponto(s) de atenção.`);
})()
  .catch((e) => {
    console.error('\nA varredura não terminou:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
