import { useQuery } from '@tanstack/react-query';
import { treinosService } from './treinos.service';
import { queryKeys } from '../../lib/query-keys';

/** Treinos do aluno logado. */
export function useMeusTreinos() {
  return useQuery({ queryKey: queryKeys.treinosMeus, queryFn: treinosService.meus });
}

/** Treinos de um aluno (professor/admin). */
export function useTreinosDoAluno(alunoId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.treinosAluno(alunoId),
    queryFn: () => treinosService.doAluno(alunoId!),
    enabled: enabled && !!alunoId,
  });
}
