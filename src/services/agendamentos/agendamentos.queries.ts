import { useQuery } from '@tanstack/react-query';
import { agendamentosService } from './agendamentos.service';
import { queryKeys } from '../../lib/query-keys';

export function useMeusAgendamentos() {
  return useQuery({
    queryKey: queryKeys.meusAgendamentos,
    queryFn: agendamentosService.meus,
  });
}

export function useHistorico(page = 1) {
  return useQuery({
    queryKey: [...queryKeys.historico, page],
    queryFn: () => agendamentosService.historico(page),
  });
}

/** Alunos agendados num horário em uma data (admin). */
export function useAgendamentosDoHorario(horarioId?: string, data?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agendamentosDoHorario(horarioId ?? '', data ?? ''),
    queryFn: () => agendamentosService.listarPorHorario(horarioId!, data!),
    enabled: enabled && !!horarioId && !!data,
  });
}
