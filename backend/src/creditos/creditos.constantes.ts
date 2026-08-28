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

/**
 * Teto de reposições que o aluno pode AGENDAR num período corrido.
 *
 * Está no Termo de Normas (termos/termo.ts, seção 3): "até 5 (cinco)
 * reposições a cada 30 dias". Não se confunde com a validade do crédito —
 * são travas diferentes: a validade diz até quando o crédito serve, esta diz
 * quantas reposições cabem na janela. Sem ela, quem junta oito créditos
 * válidos marca as oito de uma vez, e as vagas de quem paga o plano cheio
 * somem.
 *
 * O app mostra o número em texto: ao mudar aqui, ajuste também
 * MAX_REPOSICOES_POR_PERIODO em src/constants/app.ts.
 */
export const MAX_REPOSICOES_POR_PERIODO = 5;
export const DIAS_PERIODO_REPOSICOES = 30;
