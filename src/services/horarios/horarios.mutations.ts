import { useMutation, useQueryClient } from '@tanstack/react-query';
import { horariosService } from './horarios.service';
import { queryKeys } from '../../lib/query-keys';
import type { AtualizarHorarioPayload, CriarHorarioPayload } from './horarios.types';

function useInvalidarHorarios() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.horarios });
}

export function useBloquearHorario() {
  const invalidar = useInvalidarHorarios();
  return useMutation({
    mutationFn: (id: string) => horariosService.bloquear(id),
    onSuccess: invalidar,
  });
}

export function useCriarHorario() {
  const invalidar = useInvalidarHorarios();
  return useMutation({
    mutationFn: (payload: CriarHorarioPayload) => horariosService.criar(payload),
    onSuccess: invalidar,
  });
}

export function useAtualizarHorario() {
  const invalidar = useInvalidarHorarios();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AtualizarHorarioPayload }) =>
      horariosService.atualizar(id, payload),
    onSuccess: invalidar,
  });
}

export function useExcluirHorario() {
  const invalidar = useInvalidarHorarios();
  return useMutation({
    mutationFn: (id: string) => horariosService.excluir(id),
    onSuccess: invalidar,
  });
}
