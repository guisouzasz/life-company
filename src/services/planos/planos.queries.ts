import { useQuery } from '@tanstack/react-query';
import { planosService } from './planos.service';
import { queryKeys } from '../../lib/query-keys';

export function usePlanos() {
  return useQuery({
    queryKey: queryKeys.planos,
    queryFn: planosService.listar,
    staleTime: 10 * 60_000,
  });
}
