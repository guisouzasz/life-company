import { useQuery } from '@tanstack/react-query';
import { horariosFixosService } from './horarios-fixos.service';
import { queryKeys } from '../../lib/query-keys';

/** Horários fixos de um aluno (admin). */
export function useHorariosFixosDoAluno(usuarioId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.horariosFixosAdmin(usuarioId),
    queryFn: () => horariosFixosService.listarDoAluno(usuarioId!),
    enabled: enabled && !!usuarioId,
  });
}
