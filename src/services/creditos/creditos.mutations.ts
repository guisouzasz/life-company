import { useMutation, useQueryClient } from '@tanstack/react-query';
import { creditosService } from './creditos.service';

function useInvalidarCreditos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['creditos'] });
}

export function useConcederCredito() {
  const invalidar = useInvalidarCreditos();
  return useMutation({
    mutationFn: ({ usuarioId, dias }: { usuarioId: string; dias?: number }) =>
      creditosService.conceder(usuarioId, dias),
    onSuccess: invalidar,
  });
}

export function useAtualizarCredito() {
  const invalidar = useInvalidarCreditos();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { expiraEm?: string; revogado?: boolean } }) =>
      creditosService.atualizar(id, payload),
    onSuccess: invalidar,
  });
}

export function useRevogarCredito() {
  const invalidar = useInvalidarCreditos();
  return useMutation({
    mutationFn: (id: string) => creditosService.revogar(id),
    onSuccess: invalidar,
  });
}
