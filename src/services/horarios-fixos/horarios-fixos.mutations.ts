import { useMutation, useQueryClient } from '@tanstack/react-query';
import { horariosFixosService } from './horarios-fixos.service';
import type { CriarHorarioFixoPayload } from './horarios-fixos.types';

/**
 * Mexer no horário fixo mexe TAMBÉM nas aulas.
 *
 * Criar gera os agendamentos das próximas duas semanas; remover cancela os
 * futuros. Enquanto isto invalidava só `horarios-fixos`, o card do horário
 * aparecia na hora e a lista "Próximas aulas marcadas" logo abaixo continuava
 * com o texto antigo — "Nenhuma aula marcada daqui para frente" — na mesma
 * tela, ao mesmo tempo. Era ler que não tinha funcionado. A grade da aba
 * Agenda ficava igualmente parada até a tela ser reaberta.
 */
function useInvalidarHorariosFixos() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['horarios-fixos'] });
    qc.invalidateQueries({ queryKey: ['agendamentos'] });
    qc.invalidateQueries({ queryKey: ['horarios'] });
    qc.invalidateQueries({ queryKey: ['creditos'] });
  };
}

export function useCriarHorarioFixo() {
  const invalidar = useInvalidarHorariosFixos();
  return useMutation({
    mutationFn: ({ usuarioId, payload }: { usuarioId: string; payload: CriarHorarioFixoPayload }) =>
      horariosFixosService.criar(usuarioId, payload),
    onSuccess: invalidar,
  });
}

export function useRemoverHorarioFixo() {
  const invalidar = useInvalidarHorariosFixos();
  return useMutation({
    mutationFn: (id: string) => horariosFixosService.remover(id),
    onSuccess: invalidar,
  });
}
