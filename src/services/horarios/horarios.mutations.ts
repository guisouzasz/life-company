import { useMutation, useQueryClient } from '@tanstack/react-query';
import { horariosService } from './horarios.service';
import { queryKeys } from '../../lib/query-keys';

export function useBloquearHorario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => horariosService.bloquear(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.horarios }),
  });
}
