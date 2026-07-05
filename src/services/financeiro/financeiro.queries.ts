import { useQuery } from '@tanstack/react-query';
import { financeiroService } from './financeiro.service';
import { queryKeys } from '../../lib/query-keys';

/** Situação da mensalidade do aluno logado. */
export function useMinhaSituacaoFinanceira() {
  return useQuery({ queryKey: queryKeys.financeiroMeu, queryFn: financeiroService.minhaSituacao });
}

/** Resumo do mês + situação de todos os alunos (admin). */
export function useResumoFinanceiro() {
  return useQuery({ queryKey: queryKeys.financeiroResumo, queryFn: financeiroService.resumo });
}

/** Histórico de pagamentos de um aluno (admin). */
export function useHistoricoFinanceiroAluno(usuarioId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.financeiroAluno(usuarioId),
    queryFn: () => financeiroService.historicoDoAluno(usuarioId!),
    enabled: enabled && !!usuarioId,
  });
}
