/**
 * Instância única do QueryClient (TanStack Query).
 * Defaults pensados para um app mobile: revalida ao focar, sem retry
 * agressivo, cache curto para dados de agenda que mudam com frequência.
 */
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../services/http';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // Não insistir em erros de autenticação/permissão.
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
