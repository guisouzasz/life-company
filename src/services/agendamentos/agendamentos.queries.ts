import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { agendamentosService } from './agendamentos.service';
import { queryKeys } from '../../lib/query-keys';

export function useMeusAgendamentos() {
  return useQuery({
    queryKey: queryKeys.meusAgendamentos,
    queryFn: agendamentosService.meus,
  });
}

/**
 * Quantas aulas o backend devolve por página (agendamentos.service: take).
 * Espelha aquele número — se um mudar, o outro tem de mudar junto, senão o
 * "carregar mais" some cedo demais ou tenta buscar uma página vazia.
 */
export const HISTORICO_POR_PAGINA = 20;

/**
 * Histórico com "carregar mais".
 *
 * Antes a tela pedia só a primeira página e não havia como pedir a próxima:
 * o aluno enxergava as 20 aulas mais recentes e o resto sumia sem aviso —
 * quem treina 3x por semana perde tudo o que passa de sete semanas.
 */
export function useHistoricoPaginado() {
  return useInfiniteQuery({
    queryKey: [...queryKeys.historico, 'paginado'],
    queryFn: ({ pageParam }) => agendamentosService.historico(pageParam),
    initialPageParam: 1,
    // Página cheia significa que provavelmente há mais; página curta é o fim.
    getNextPageParam: (ultima, todas) =>
      ultima.length === HISTORICO_POR_PAGINA ? todas.length + 1 : undefined,
  });
}

export function useHistorico(page = 1) {
  return useQuery({
    queryKey: [...queryKeys.historico, page],
    queryFn: () => agendamentosService.historico(page),
  });
}

/** Alunos agendados num horário em uma data (admin). */
/** Próximas aulas de um aluno (admin). */
export function useAgendamentosDoAluno(usuarioId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agendamentosDoAluno(usuarioId ?? ''),
    queryFn: () => agendamentosService.listarDoAluno(usuarioId!),
    enabled: enabled && !!usuarioId,
  });
}

export function useAgendamentosDoHorario(horarioId?: string, data?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agendamentosDoHorario(horarioId ?? '', data ?? ''),
    queryFn: () => agendamentosService.listarPorHorario(horarioId!, data!),
    enabled: enabled && !!horarioId && !!data,
  });
}
