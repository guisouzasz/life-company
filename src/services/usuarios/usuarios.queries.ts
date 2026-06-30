import { useQuery } from '@tanstack/react-query';
import { usuariosService } from './usuarios.service';
import { queryKeys } from '../../lib/query-keys';

export function useSaldo() {
  return useQuery({
    queryKey: queryKeys.saldo,
    queryFn: usuariosService.saldo,
  });
}

/** Lista de alunos (admin), com busca opcional. */
export function useAlunos(busca?: string) {
  return useQuery({
    queryKey: ['usuarios', 'alunos', busca ?? ''],
    queryFn: () => usuariosService.listar(busca),
  });
}
