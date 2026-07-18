import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cargasService } from './cargas.service';
import type { RegistrarCargaPayload } from './cargas.types';

function useInvalidarCargas() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['cargas'] });
}

export function useRegistrarCarga() {
  const invalidar = useInvalidarCargas();
  return useMutation({
    mutationFn: (payload: RegistrarCargaPayload) => cargasService.registrar(payload),
    onSuccess: invalidar,
  });
}

export function useRemoverCarga() {
  const invalidar = useInvalidarCargas();
  return useMutation({
    mutationFn: (id: string) => cargasService.remover(id),
    onSuccess: invalidar,
  });
}
