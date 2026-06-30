import { useQuery } from '@tanstack/react-query';
import { modalidadesService } from './modalidades.service';
import { queryKeys } from '../../lib/query-keys';

export function useModalidades() {
  return useQuery({
    queryKey: queryKeys.modalidades,
    queryFn: modalidadesService.listar,
    staleTime: 10 * 60_000,
  });
}
