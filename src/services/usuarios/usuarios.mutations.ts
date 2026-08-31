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
    // ['usuarios'] e não ['usuarios','alunos']: a mesma rota edita professor
    // (ativar/desativar), e a lista deles precisa acompanhar.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
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

/**
 * Define a senha de um aluno/professor. Invalida a lista de professores
 * porque isso também ativa a conta — o status na tela muda junto.
 */
export function useDefinirSenha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, senha }: { id: string; senha: string }) => usuariosService.definirSenha(id, senha),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

/**
 * Apaga o aluno de vez.
 *
 * Separada de qualquer mutation de edição de propósito: desativar e excluir
 * não podem compartilhar caminho, porque só uma delas tem volta.
 */
export function useExcluirAlunoDefinitivamente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usuariosService.excluirDefinitivamente(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      qc.invalidateQueries({ queryKey: ['agendamentos'] });
      qc.invalidateQueries({ queryKey: ['horarios'] });
      qc.invalidateQueries({ queryKey: ['horarios-fixos'] });
      qc.invalidateQueries({ queryKey: ['financeiro'] });
    },
  });
}
