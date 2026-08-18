import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeiroService } from './financeiro.service';
import type { RegistrarPagamentoPayload } from './financeiro.types';

function useInvalidarFinanceiro() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['financeiro'] });
}

export function useRegistrarPagamento() {
  const invalidar = useInvalidarFinanceiro();
  return useMutation({
    mutationFn: (payload: RegistrarPagamentoPayload) => financeiroService.registrar(payload),
    onSuccess: invalidar,
  });
}

export function useDesfazerPagamento() {
  const invalidar = useInvalidarFinanceiro();
  return useMutation({
    mutationFn: (id: string) => financeiroService.desfazer(id),
    onSuccess: invalidar,
  });
}

export function useConfigurarFinanceiroAluno() {
  const invalidar = useInvalidarFinanceiro();
  return useMutation({
    mutationFn: ({
      usuarioId,
      ...config
    }: { usuarioId: string; diaVencimento?: number; valorMensalidade?: number | null }) =>
      financeiroService.configurarAluno(usuarioId, config),
    onSuccess: invalidar,
  });
}
