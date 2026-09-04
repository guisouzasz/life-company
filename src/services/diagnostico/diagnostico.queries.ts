import { useMutation, useQuery } from '@tanstack/react-query';
import { diagnosticoService } from './diagnostico.service';
import { queryKeys } from '../../lib/query-keys';

/**
 * A varredura roda no servidor a cada chamada, então não cabe cache: quem
 * abre esta tela quer saber como o estúdio está AGORA, e ver a foto de meia
 * hora atrás depois de arrumar as coisas é pior do que esperar.
 *
 * `enabled` fica com a tela: ela só dispara quando o dono aperta o botão —
 * a conferência varre todos os fixos e todas as aulas de duas semanas, e não
 * é coisa para rodar sozinha toda vez que alguém passa pela aba.
 */
export function useVarreduraDeHorariosFixos(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.diagnosticoHorariosFixos,
    queryFn: diagnosticoService.horariosFixos,
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * Devolve os horários fixos desligados de quem treina. A tela redispara a
 * varredura depois, para o dono ver o resultado em vez de acreditar nele.
 */
export function useRestaurarHorariosFixos() {
  return useMutation({ mutationFn: diagnosticoService.restaurarHorariosFixos });
}
