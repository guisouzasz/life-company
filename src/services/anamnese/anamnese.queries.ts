import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { anamneseService } from './anamnese.service';
import { queryKeys } from '../../lib/query-keys';
import type { SalvarAnamnesePayload } from './anamnese.types';

/** Ficha do aluno logado. */
export function useMinhaAnamnese() {
  return useQuery({ queryKey: queryKeys.anamneseMinha, queryFn: anamneseService.minha });
}

/** Ficha de um aluno (professor/admin). */
export function useAnamneseDoAluno(alunoId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.anamneseAluno(alunoId),
    queryFn: () => anamneseService.doAluno(alunoId!),
    enabled: enabled && !!alunoId,
  });
}

export function useSalvarAnamnese() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SalvarAnamnesePayload) => anamneseService.salvar(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anamnese'] }),
  });
}
