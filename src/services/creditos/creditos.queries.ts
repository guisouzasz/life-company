import { useQuery } from '@tanstack/react-query';
import { creditosService } from './creditos.service';
import { queryKeys } from '../../lib/query-keys';

export function useMeusCreditos() {
  return useQuery({ queryKey: queryKeys.creditosMeus, queryFn: creditosService.meus });
}

export function useSaldoCreditos() {
  return useQuery({ queryKey: queryKeys.creditosSaldo, queryFn: creditosService.saldo });
}

/** Créditos de um aluno (admin). */
export function useCreditosDoAluno(usuarioId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.creditosAdmin(usuarioId),
    queryFn: () => creditosService.listar(usuarioId),
    enabled: enabled && !!usuarioId,
  });
}
