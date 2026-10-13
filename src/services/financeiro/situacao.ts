import type { AlunoFinanceiro } from './financeiro.types';

/**
 * Já passou do dia de vencimento deste mês sem pagamento marcado.
 *
 * Inclui o "Sem registro" — aluno que nunca teve pagamento marcado. O servidor
 * não o chama de atrasado (e o aluno não recebe aviso de atraso no app dele),
 * mas para a dona ele também está devendo: a aluna passava do dia e não
 * aparecia em lugar nenhum. Mora aqui porque o Financeiro e o Início da dona
 * têm de contar igual.
 */
export function passouDoDia(a: AlunoFinanceiro, agora = new Date()): boolean {
  if (a.status === 'ATRASADO') return true;
  if (a.status !== 'SEM_REGISTRO') return false;
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  return new Date(a.vencimento).getTime() < hoje.getTime();
}

export type SituacaoPagamento = 'todos' | 'faltam' | 'passou' | 'aVencer' | 'pagou';

export const naSituacao = (a: AlunoFinanceiro, sit: SituacaoPagamento) =>
  sit === 'todos' ? true
  : sit === 'pagou' ? a.status === 'EM_DIA'
  : sit === 'faltam' ? a.status !== 'EM_DIA'
  : sit === 'passou' ? passouDoDia(a)
  : a.status !== 'EM_DIA' && !passouDoDia(a);
