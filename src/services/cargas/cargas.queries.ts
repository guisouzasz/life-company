import { useQuery } from '@tanstack/react-query';
import { cargasService } from './cargas.service';
import { queryKeys } from '../../lib/query-keys';

/** Evolução de cargas do aluno logado. */
export function useMinhasCargas() {
  return useQuery({ queryKey: queryKeys.cargasMinhas, queryFn: cargasService.meus });
}

/** Evolução de cargas de um aluno (professor/admin). */
export function useCargasDoAluno(alunoId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cargasAluno(alunoId),
    queryFn: () => cargasService.doAluno(alunoId!),
    enabled: enabled && !!alunoId,
  });
}
