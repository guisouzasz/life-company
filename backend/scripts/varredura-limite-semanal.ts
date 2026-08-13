/**
 * Varredura: alunos com mais aulas numa semana do que o plano permite.
 *
 * Nasceu da correção do limite semanal (as marcações simultâneas furavam a
 * verificação). Serve para achar o que já entrou errado no banco antes da
 * correção — a correção impede novos casos, mas não desfaz os antigos.
 *
 * Só LÊ o banco: não altera nem apaga nada.
 *
 * Como rodar, apontando para o banco que se quer auditar:
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/varredura-limite-semanal.ts
 */
import '../src/timezone'; // fixa o fuso do estúdio antes de qualquer Date
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Segunda-feira da semana de uma data, no fuso do estúdio. */
function segundaDaSemana(data: Date): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  const diaIso = ((d.getDay() + 6) % 7) + 1; // 1 = segunda
  d.setDate(d.getDate() - (diaIso - 1));
  return d;
}

const ptBr = (d: Date) => d.toLocaleDateString('pt-BR');

async function main() {
  const alunos = await prisma.usuario.findMany({
    where: { tipoUsuario: 'ALUNO', NOT: { cpf: { startsWith: 'REMOVIDO-' } } },
    select: {
      id: true,
      nome: true,
      usuarioPlanos: {
        select: { vigenciaInicio: true, vigenciaFim: true, plano: { select: { nome: true, aulasSemanais: true } } },
      },
      agendamentos: {
        where: { status: { in: ['CONFIRMADO', 'REALIZADO'] } },
        select: { dataAula: true, reposicao: true },
      },
    },
    orderBy: { nome: 'asc' },
  });

  const estouros: {
    aluno: string; semana: Date; normais: number; reposicoes: number; limite: number; plano: string;
  }[] = [];
  const comReposicao: typeof estouros = [];
  let semanasVistas = 0;
  let semPlano = 0;

  for (const aluno of alunos) {
    // Agrupa as aulas do aluno por semana
    const porSemana = new Map<number, { normais: number; reposicoes: number }>();
    for (const ag of aluno.agendamentos) {
      const chave = segundaDaSemana(ag.dataAula).getTime();
      const atual = porSemana.get(chave) ?? { normais: 0, reposicoes: 0 };
      if (ag.reposicao) atual.reposicoes++;
      else atual.normais++;
      porSemana.set(chave, atual);
    }

    for (const [chave, contagem] of porSemana) {
      semanasVistas++;
      const inicio = new Date(chave);
      const fim = new Date(chave);
      fim.setDate(fim.getDate() + 6);
      fim.setHours(23, 59, 59, 999);

      // Plano vigente NAQUELA semana (o aluno pode ter trocado de plano depois).
      // Havendo mais de um, vale o que começou por último.
      const vigentes = aluno.usuarioPlanos
        .filter((p) => p.vigenciaInicio <= fim && (p.vigenciaFim === null || p.vigenciaFim >= inicio))
        .sort((a, b) => b.vigenciaInicio.getTime() - a.vigenciaInicio.getTime());
      const plano = vigentes[0];
      if (!plano) { semPlano++; continue; }

      const limite = plano.plano.aulasSemanais;
      const registro = {
        aluno: aluno.nome, semana: inicio, normais: contagem.normais,
        reposicoes: contagem.reposicoes, limite, plano: plano.plano.nome,
      };
      // Estouro de verdade: aulas normais acima da cota.
      if (contagem.normais > limite) estouros.push(registro);
      // Caso previsto em regra: cota cheia + aula de reposição na mesma semana.
      else if (contagem.normais + contagem.reposicoes > limite) comReposicao.push(registro);
    }
  }

  console.log(`\nVarredura de limite semanal`);
  console.log(`${alunos.length} alunos, ${semanasVistas} semanas com aula analisadas.\n`);

  console.log('── Semanas ACIMA do plano (o que a correção passou a impedir) ──');
  if (estouros.length === 0) {
    console.log('  Nenhuma. Nenhum aluno marcou mais aulas do que o plano permite.\n');
  } else {
    estouros
      .sort((a, b) => a.aluno.localeCompare(b.aluno) || a.semana.getTime() - b.semana.getTime())
      .forEach((e) => {
        console.log(`  ${e.aluno} — semana de ${ptBr(e.semana)}: ${e.normais} aulas, plano ${e.plano} (limite ${e.limite})`);
      });
    console.log(`  Total: ${estouros.length} semana(s).\n`);
  }

  console.log('── Semanas com cota cheia + reposição (permitido pela regra atual) ──');
  if (comReposicao.length === 0) {
    console.log('  Nenhuma.\n');
  } else {
    comReposicao
      .sort((a, b) => a.aluno.localeCompare(b.aluno) || a.semana.getTime() - b.semana.getTime())
      .forEach((e) => {
        console.log(`  ${e.aluno} — semana de ${ptBr(e.semana)}: ${e.normais} da cota + ${e.reposicoes} de reposição, plano ${e.plano}`);
      });
    console.log(`  Total: ${comReposicao.length} semana(s). Não é erro: crédito de reposição não consome a cota.\n`);
  }

  if (semPlano > 0) {
    console.log(`Obs.: ${semPlano} semana(s) com aula sem plano vigente no período — não dá para avaliar o limite.\n`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
