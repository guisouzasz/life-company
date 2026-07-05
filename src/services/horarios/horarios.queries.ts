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

/** Grade completa de horários ativos (admin e modais). */
export function useHorarios(modalidadeId?: string) {
  return useQuery({
    queryKey: [...queryKeys.horarios, modalidadeId ?? 'all'],
    queryFn: () => horariosService.listar(modalidadeId),
  });
}

/** Todos os horários, inclusive inativos — tela de gestão do admin. */
export function useHorariosAdmin() {
  return useQuery({
    queryKey: [...queryKeys.horarios, 'admin-todos'],
    queryFn: () => horariosService.listar(undefined, true),
  });
}
