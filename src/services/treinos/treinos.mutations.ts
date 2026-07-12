import { useMutation, useQueryClient } from '@tanstack/react-query';
import { treinosService } from './treinos.service';
import type { SalvarTreinoPayload } from './treinos.types';

function useInvalidarTreinos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['treinos'] });
}

export function useCriarTreino() {
  const invalidar = useInvalidarTreinos();
  return useMutation({
    mutationFn: (payload: SalvarTreinoPayload) => treinosService.criar(payload),
    onSuccess: invalidar,
  });
}

export function useAtualizarTreino() {
  const invalidar = useInvalidarTreinos();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SalvarTreinoPayload }) =>
      treinosService.atualizar(id, payload),
    onSuccess: invalidar,
  });
}

export function useRemoverTreino() {
  const invalidar = useInvalidarTreinos();
  return useMutation({
    mutationFn: (id: string) => treinosService.remover(id),
    onSuccess: invalidar,
  });
}
