/** Chaves centralizadas do TanStack Query, evitando strings soltas. */
export const queryKeys = {
  saldo: ['saldo'] as const,
  meusAgendamentos: ['agendamentos', 'meus'] as const,
  historico: ['agendamentos', 'historico'] as const,
  modalidades: ['modalidades'] as const,
  planos: ['planos'] as const,
  vagas: (modalidadeId: string, data: string) => ['horarios', 'vagas', modalidadeId, data] as const,
  horarios: ['horarios'] as const,
  relatorioDashboard: ['relatorios', 'dashboard'] as const,
  relatorioFrequencia: ['relatorios', 'frequencia'] as const,
  creditosMeus: ['creditos', 'meus'] as const,
  creditosSaldo: ['creditos', 'saldo'] as const,
  creditosAdmin: (usuarioId?: string) => ['creditos', 'admin', usuarioId ?? 'all'] as const,
  horariosFixosAdmin: (usuarioId?: string) => ['horarios-fixos', 'admin', usuarioId ?? 'all'] as const,
  agendamentosDoHorario: (horarioId: string, data: string) => ['agendamentos', 'horario', horarioId, data] as const,
};
