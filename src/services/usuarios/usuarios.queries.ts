import { useQuery } from '@tanstack/react-query';
import { usuariosService } from './usuarios.service';
import { queryKeys } from '../../lib/query-keys';

export function useSaldo() {
  return useQuery({
    queryKey: queryKeys.saldo,
    queryFn: usuariosService.saldo,
  });
}
