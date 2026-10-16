import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { diasFechadosService } from './dias-fechados.service';

export function useDiasFechados(de?: string, ate?: string) {
  return useQuery({
    queryKey: ['dias-fechados', de, ate],
    queryFn: () => diasFechadosService.listar(de!, ate!),
    enabled: !!de && !!ate,
  });
}

/** Fechar ou reabrir mexe na agenda inteira: aulas, vagas, saldo e créditos. */
function useInvalidarTudo() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['dias-fechados'] });
    qc.invalidateQueries({ queryKey: ['horarios'] });
    qc.invalidateQueries({ queryKey: ['agendamentos'] });
    qc.invalidateQueries({ queryKey: ['creditos'] });
    qc.invalidateQueries({ queryKey: ['relatorios'] });
  };
}

export function useFecharDia() {
  const invalidar = useInvalidarTudo();
  return useMutation({
    mutationFn: ({ data, motivo, recesso }: { data: string; motivo: string; recesso?: boolean }) =>
      diasFechadosService.fechar(data, motivo, recesso),
    onSuccess: invalidar,
  });
}

export function useReabrirDia() {
  const invalidar = useInvalidarTudo();
  return useMutation({ mutationFn: (id: string) => diasFechadosService.reabrir(id), onSuccess: invalidar });
}
