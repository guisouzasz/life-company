import { useMutation, useQueryClient } from '@tanstack/react-query';
import { horariosFixosService } from './horarios-fixos.service';
import type { CriarHorarioFixoPayload } from './horarios-fixos.types';

function useInvalidarHorariosFixos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['horarios-fixos'] });
}

export function useCriarHorarioFixo() {
  const invalidar = useInvalidarHorariosFixos();
  return useMutation({
    mutationFn: ({ usuarioId, payload }: { usuarioId: string; payload: CriarHorarioFixoPayload }) =>
      horariosFixosService.criar(usuarioId, payload),
    onSuccess: invalidar,
  });
}

export function useRemoverHorarioFixo() {
  const invalidar = useInvalidarHorariosFixos();
  return useMutation({
    mutationFn: (id: string) => horariosFixosService.remover(id),
    onSuccess: invalidar,
  });
}
