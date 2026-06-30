import { useQuery } from '@tanstack/react-query';
import { relatoriosService } from './relatorios.service';
import { queryKeys } from '../../lib/query-keys';

export function useRelatorioDashboard() {
  return useQuery({
    queryKey: queryKeys.relatorioDashboard,
    queryFn: relatoriosService.dashboard,
  });
}

export function useRelatorioFrequencia() {
  return useQuery({
    queryKey: queryKeys.relatorioFrequencia,
    queryFn: relatoriosService.frequencia,
  });
}
