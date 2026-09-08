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

/** Professores do estúdio (admin). */
export function useProfessores() {
  return useQuery({
    queryKey: ['usuarios', 'professores'],
    queryFn: usuariosService.listarProfessores,
  });
}

/**
 * Só os nomes, para o professor escolher quem assina a ficha.
 *
 * Rota separada da de cima porque aquela é de admin e traz CPF, e-mail e
 * telefone — dado de cadastro que o colega não precisa ver para preencher uma
 * lista de nomes.
 */
export function useNomesDeProfessores() {
  return useQuery({
    queryKey: ['usuarios', 'professores', 'nomes'],
    queryFn: usuariosService.listarNomesDeProfessores,
    staleTime: 5 * 60 * 1000,
  });
}
