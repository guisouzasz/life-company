import { Prisma } from '@prisma/client';

type Banco = Prisma.TransactionClient;

/**
 * Quanto da cota de UMA semana o aluno já usou.
 *
 * Conta as aulas do plano marcadas na semana (reposição não entra: ela gasta
 * crédito, não cota) e mais as aulas que ele cancelou na semana e JÁ repôs
 * com o crédito que o cancelamento gerou. Essas continuam ocupando a semana:
 * a aula perdida voltou como reposição, e liberar a vaga também devolveria a
 * mesma aula duas vezes — era assim que um plano 1x fechava a semana com
 * duas aulas.
 *
 * Mora aqui porque a mesma conta decide se a aula entra (agendamentos) e o
 * que o aluno vê como "aulas usadas" no app (saldo da semana). As duas
 * precisam bater, senão o app mostra vaga que a API recusa.
 *
 * Só os créditos do PRÓPRIO cancelamento contam: crédito dado pelo estúdio
 * (aula que a dona cancelou) é compensação dela e não ocupa a semana.
 *
 * E a aula que caiu num dia FECHADO (feriado, recesso) conta como dada: foi a
 * regra que o estúdio escolheu, a do termo — sem reposição e sem trocar por
 * outro dia da semana.
 */
export async function cotaDaSemana(db: Banco, usuarioId: string, inicio: Date, fim: Date) {
  const marcadas = await db.agendamento.count({
    where: {
      usuarioId,
      dataAula: { gte: inicio, lte: fim },
      status: { in: ['CONFIRMADO', 'REALIZADO'] },
      reposicao: false,
    },
  });
  const fechadas = await db.agendamento.findMany({
    where: {
      usuarioId,
      dataAula: { gte: inicio, lte: fim },
      status: 'CANCELADO',
      reposicao: false,
      diaFechadoId: { not: null },
    },
    select: { dataAula: true, diaFechado: { select: { motivo: true } } },
  });
  const usadas = marcadas + fechadas.length;
  /** Aulas da semana que caíram em dia fechado — contam, e o aviso diz por quê. */
  const emDiaFechado = fechadas.map((f) => ({ dataAula: f.dataAula, motivo: f.diaFechado?.motivo ?? 'Academia fechada' }));

  /**
   * As aulas da semana que geraram crédito do próprio cancelamento — em
   * QUALQUER situação atual da linha, não só as que seguem canceladas.
   *
   * O crédito é a vaga da semana que virou crédito, e isso não muda quando a
   * linha da aula volta a ser usada. Olhando só as canceladas, uma brecha:
   * o aluno de plano 1x cancelava a terça, repunha a MESMA terça com o crédito
   * (a linha volta a CONFIRMADO, como reposição) e a semana ficava zerada — a
   * quinta entrava pelo plano. Um direito, duas aulas. Agora a terça reposta
   * continua ocupando a semana, e um crédito ainda livre de uma aula que
   * voltou como reposição paga com OUTRO crédito continua derrubável.
   */
  const daSemana = await db.agendamento.findMany({
    where: { usuarioId, dataAula: { gte: inicio, lte: fim } },
    select: { id: true, dataAula: true },
  });
  if (daSemana.length === 0) return { usadas, emDiaFechado, repostas: [] as Date[], creditoLivreId: null as string | null };

  const creditos = await db.creditoReposicao.findMany({
    where: {
      usuarioId,
      revogado: false,
      concedidoAdmin: false,
      origemAgendamentoId: { in: daSemana.map((c) => c.id) },
    },
    orderBy: { criadoEm: 'asc' },
    select: { id: true, usado: true, origemAgendamentoId: true },
  });

  return {
    usadas,
    emDiaFechado,
    /** Dias das aulas canceladas cujo crédito já virou reposição. */
    repostas: creditos
      .filter((c) => c.usado)
      .map((c) => daSemana.find((a) => a.id === c.origemAgendamentoId)!.dataAula),
    /** Crédito de um cancelamento da semana que ainda não foi usado. */
    creditoLivreId: creditos.find((c) => !c.usado)?.id ?? null,
  };
}
