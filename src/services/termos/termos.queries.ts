import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meuTermoService, termosService } from './termos.service';
import { queryKeys } from '../../lib/query-keys';

export function useTermo() {
  return useQuery({
    queryKey: queryKeys.termo,
    queryFn: termosService.vigente,
    // Muda quando o estúdio publica outra redação; não precisa refazer a cada
    // foco de tela enquanto o aluno preenche o formulário.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Se o aluno logado ainda deve o aceite do termo vigente.
 *
 * `enabled` fica por conta de quem chama: só faz sentido para ALUNO logado, e
 * disparar isto no login de admin/professor seria uma chamada à toa em toda
 * abertura do painel.
 */
export function useMeuTermo(enabled = true) {
  return useQuery({
    queryKey: queryKeys.meuTermo,
    queryFn: meuTermoService.situacao,
    enabled,
    staleTime: 5 * 60 * 1000,
    // Falha de rede não pode virar bloqueio: sem resposta, o app segue e
    // pergunta de novo na próxima abertura.
    retry: 1,
  });
}

export function useAceitarTermo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versao: string) => meuTermoService.aceitar(versao),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.meuTermo }),
  });
}
