import { useMutation, useQueryClient } from '@tanstack/react-query';
import { treinosService } from './treinos.service';
import type { SalvarTreinoDiaPayload, SalvarTreinoPayload } from './treinos.types';

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

export function useDefinirStatusTreino() {
  const invalidar = useInvalidarTreinos();
  return useMutation({
    mutationFn: ({ id, concluido }: { id: string; concluido: boolean }) =>
      treinosService.definirStatus(id, concluido),
    onSuccess: invalidar,
  });
}

/** Salva (upsert) o treino do dia da modalidade do professor. */
export function useSalvarTreinoDia() {
  const invalidar = useInvalidarTreinos();
  return useMutation({
    mutationFn: (payload: SalvarTreinoDiaPayload) => treinosService.diaSalvar(payload),
    onSuccess: invalidar,
  });
}

export function useRemoverTreinoDia() {
  const invalidar = useInvalidarTreinos();
  return useMutation({
    mutationFn: (id: string) => treinosService.diaRemover(id),
    onSuccess: invalidar,
  });
}
