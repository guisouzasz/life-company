import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conferenciaService } from './conferencia.service';

const CHAVE = ['conferencia', 'hoje'] as const;

/** A conferência de hoje dos horários fixos (o alerta das 08:00). */
export function useConferenciaHoje() {
  return useQuery({ queryKey: CHAVE, queryFn: conferenciaService.hoje });
}

export function useRodarConferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: conferenciaService.rodar,
    onSuccess: (c) => qc.setQueryData(CHAVE, c),
  });
}

export function useMarcarConferenciaRevisada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conferenciaService.marcarRevisada(id),
    onSuccess: (c) => qc.setQueryData(CHAVE, c),
  });
}
