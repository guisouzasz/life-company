import { useQuery } from '@tanstack/react-query';
import { treinosService } from './treinos.service';
import { queryKeys } from '../../lib/query-keys';

/** Treinos do aluno logado. */
export function useMeusTreinos() {
  return useQuery({ queryKey: queryKeys.treinosMeus, queryFn: treinosService.meus });
}

/** Treinos do dia de hoje das aulas do aluno logado (Funcional). */
export function useMeuTreinoDia() {
  return useQuery({ queryKey: queryKeys.treinoDiaMeu, queryFn: treinosService.diaMeu });
}

/** Treino do dia da modalidade do professor para uma data. */
export function useTreinoDia(data?: string) {
  return useQuery({
    queryKey: queryKeys.treinoDia(data),
    queryFn: () => treinosService.diaVer(data!),
    enabled: !!data,
  });
}

/** Treinos de um aluno (professor/admin). */
export function useTreinosDoAluno(alunoId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.treinosAluno(alunoId),
    queryFn: () => treinosService.doAluno(alunoId!),
    enabled: enabled && !!alunoId,
  });
}
