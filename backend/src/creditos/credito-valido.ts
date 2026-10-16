import { Prisma } from '@prisma/client';
import * as dayjs from 'dayjs';

/**
 * Crédito que pode pagar uma aula do dia `dataAula`.
 *
 * - ainda não usado, não retirado;
 * - não venceu hoje e vale até o dia da aula (o termo conta a validade a
 *   partir da aula cancelada — ver agendamentos.service);
 * - e, para o crédito extra do recesso, a aula é a partir de `validoDe`: o
 *   termo diz que ele é usado "conforme a disponibilidade da agenda do
 *   próximo ano".
 *
 * Mora aqui porque a marcação, a pergunta da dona ("é reposição?") e o
 * limite semanal do painel contam o mesmo crédito.
 */
export function creditoQueValeNoDia(usuarioId: string, dataAula: Date, agora = new Date()): Prisma.CreditoReposicaoWhereInput {
  return {
    usuarioId,
    usado: false,
    revogado: false,
    expiraEm: { gt: agora, gte: dataAula },
    OR: [{ validoDe: null }, { validoDe: { lte: dataAula } }],
  };
}

/**
 * Validade do crédito extra do recesso (Termo, seção 4): o ano em que as
 * aulas voltam, inteiro. Recesso de dezembro → o ano seguinte; um dia de
 * recesso que caia em janeiro já é desse "próximo ano".
 */
export function validadeDoCreditoExtra(dataAula: Date) {
  const d = dayjs(dataAula);
  const ano = d.month() === 11 ? d.year() + 1 : d.year();
  return {
    validoDe: dayjs(`${ano}-01-01T00:00:00`).startOf('day').toDate(),
    expiraEm: dayjs(`${ano}-12-31T00:00:00`).endOf('day').toDate(),
  };
}
