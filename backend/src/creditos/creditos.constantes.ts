/**
 * Prazo para usar um crédito de reposição, contado a partir da aula que foi
 * cancelada (ou da concessão, quando o admin dá o crédito na mão).
 *
 * Mora aqui porque o mesmo prazo é aplicado em três lugares — cancelamento
 * pelo aluno, cancelamento pelo admin e concessão manual — e antes o número
 * estava repetido em cada um, junto das mensagens que o aluno lê.
 *
 * O app mostra este prazo em texto: ao mudar aqui, ajuste também
 * DIAS_VALIDADE_CREDITO em src/constants/app.ts.
 */
export const DIAS_VALIDADE_CREDITO = 30;
