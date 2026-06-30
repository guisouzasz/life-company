import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usuariosService } from './usuarios.service';
import type { CriarAlunoPayload } from './usuarios.admin.types';

export function useCriarAluno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarAlunoPayload) => usuariosService.criar(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios', 'alunos'] }),
  });
}

export function useGerarLink() {
  return useMutation({
    mutationFn: (id: string) => usuariosService.gerarLink(id),
  });
}
