import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usuariosService } from './usuarios.service';
import type { AtualizarAlunoPayload, AtualizarPlanoPayload, CriarAlunoPayload } from './usuarios.admin.types';

export function useCriarAluno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarAlunoPayload) => usuariosService.criar(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios', 'alunos'] }),
  });
}

export function useAtualizarAluno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AtualizarAlunoPayload }) =>
      usuariosService.atualizar(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios', 'alunos'] }),
  });
}

export function useAtualizarPlanoAluno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AtualizarPlanoPayload }) =>
      usuariosService.atualizarPlano(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios', 'alunos'] }),
  });
}

export function useGerarLink() {
  return useMutation({
    mutationFn: (id: string) => usuariosService.gerarLink(id),
  });
}
