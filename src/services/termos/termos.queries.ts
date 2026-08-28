import { useQuery } from '@tanstack/react-query';
import { termosService } from './termos.service';
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
