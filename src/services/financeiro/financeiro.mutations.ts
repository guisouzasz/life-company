import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeiroService } from './financeiro.service';
import type { ConfigFinanceiroPayload, RegistrarPagamentoPayload } from './financeiro.types';

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
    mutationFn: ({ usuarioId, payload }: { usuarioId: string; payload: ConfigFinanceiroPayload }) =>
      financeiroService.configurarAluno(usuarioId, payload),
    onSuccess: invalidar,
  });
}

export function useDefinirPrecoPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planoId, precoPadrao }: { planoId: string; precoPadrao: number | null }) =>
      financeiroService.definirPrecoPlano(planoId, precoPadrao),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financeiro'] });
      qc.invalidateQueries({ queryKey: ['planos'] });
    },
  });
}
