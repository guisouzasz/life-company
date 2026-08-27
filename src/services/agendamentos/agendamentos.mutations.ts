import { useMutation, useQueryClient } from '@tanstack/react-query';
import { agendamentosService } from './agendamentos.service';
import { queryKeys } from '../../lib/query-keys';
import type { CriarAgendamentoPayload } from './agendamentos.types';

/** Revalida agenda, saldo e vagas após qualquer mudança em agendamentos. */
function useInvalidarAgenda() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.meusAgendamentos });
    qc.invalidateQueries({ queryKey: queryKeys.historico });
    qc.invalidateQueries({ queryKey: queryKeys.saldo });
    qc.invalidateQueries({ queryKey: ['horarios'] });
    qc.invalidateQueries({ queryKey: ['creditos'] });
  };
}

export function useCriarAgendamento() {
  const invalidar = useInvalidarAgenda();
  return useMutation({
    mutationFn: (payload: CriarAgendamentoPayload) => agendamentosService.criar(payload),
    onSuccess: invalidar,
  });
}

export function useCancelarAgendamento() {
  const invalidar = useInvalidarAgenda();
  return useMutation({
    mutationFn: (id: string) => agendamentosService.cancelar(id),
    onSuccess: invalidar,
  });
}

/** Cancelamento pelo admin — o aluno recebe crédito de reposição. */
/** Desmarca sem crédito — usado na arrumação da agenda do aluno. */
export function useDesmarcarAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => agendamentosService.desmarcar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agendamentos'] });
      qc.invalidateQueries({ queryKey: ['horarios'] });
    },
  });
}

export function useCancelarAgendamentoAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => agendamentosService.cancelarAdmin(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agendamentos'] });
      qc.invalidateQueries({ queryKey: ['horarios'] });
      qc.invalidateQueries({ queryKey: ['creditos'] });
    },
  });
}
