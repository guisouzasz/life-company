import { useQuery } from '@tanstack/react-query';
import { logsService } from './logs.service';
import { queryKeys } from '../../lib/query-keys';
import type { FiltrosDeLog } from './logs.types';

/**
 * O registro não fica em cache por muito tempo: quem abre esta tela está
 * investigando algo que acabou de acontecer, e ver dado velho aí é pior do
 * que esperar meio segundo.
 */
export function useLogs(filtros: FiltrosDeLog, enabled = true) {
  return useQuery({
    queryKey: queryKeys.logs(filtros),
    queryFn: () => logsService.listar(filtros),
    enabled,
    staleTime: 0,
  });
}

export function useAutoresDeLog(enabled = true) {
  return useQuery({ queryKey: queryKeys.logsAutores, queryFn: logsService.autores, enabled });
}
