import { useQuery } from '@tanstack/react-query';
import { horariosService } from './horarios.service';
import { queryKeys } from '../../lib/query-keys';

/** Vagas de uma modalidade numa data (aluno). */
export function useVagas(modalidadeId?: string, data?: string) {
  return useQuery({
    queryKey: queryKeys.vagas(modalidadeId ?? '', data ?? ''),
    queryFn: () => horariosService.vagas(modalidadeId!, data!),
    enabled: !!modalidadeId && !!data,
  });
}

/** Grade completa de horários (admin). */
export function useHorarios(modalidadeId?: string) {
  return useQuery({
    queryKey: [...queryKeys.horarios, modalidadeId ?? 'all'],
    queryFn: () => horariosService.listar(modalidadeId),
  });
}
