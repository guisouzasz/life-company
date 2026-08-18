import { useEffect, useMemo, useState } from 'react';
import type { HorarioVaga } from '../services/horarios/horarios.types';

/**
 * Qual aula o professor tem em mãos neste momento.
 *
 * Em sala ele não quer escolher dia nem horário: ou a aula está rolando, ou
 * é a próxima. Por isso a escolha é feita pelo relógio, e reavaliada sozinha —
 * às 08:00 a tela precisa trocar de turma sem ninguém tocar em nada.
 */

/** Minutos desde a meia-noite de "HH:MM". NaN vira -1 para não vencer comparação. */
function emMinutos(hora: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora ?? '');
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Antecedência com que a próxima aula já aparece. O professor chega antes do
 * horário e já quer ver quem vem; 20 minutos cobrem a troca de turma sem
 * mostrar a aula das 10h logo depois da das 7h.
 */
const ANTECEDENCIA_MIN = 20;

/** Quanto tempo a aula continua em foco depois de acabar, para fechar a chamada. */
const TOLERANCIA_FIM_MIN = 10;

export type EstadoAula = 'agora' | 'proxima' | 'encerrando';

export interface AulaAgora {
  aula: HorarioVaga;
  estado: EstadoAula;
}

/**
 * Escolhe a aula em foco entre as aulas de hoje.
 *
 * Função pura, separada do hook, para o comportamento nas viradas de horário
 * poder ser conferido sem montar tela.
 */
export function escolherAulaAgora(aulas: HorarioVaga[], agoraMin: number): AulaAgora | null {
  const ordenadas = [...aulas].sort((a, b) => emMinutos(a.horaInicio) - emMinutos(b.horaInicio));

  // 1) Em andamento — o caso normal, e o que ganha de qualquer outro
  const emAndamento = ordenadas.find(
    (h) => agoraMin >= emMinutos(h.horaInicio) && agoraMin < emMinutos(h.horaFim),
  );
  if (emAndamento) return { aula: emAndamento, estado: 'agora' };

  // 2) Acabou de terminar: ainda é a aula da mão dele por alguns minutos
  const recemEncerrada = ordenadas.find(
    (h) => agoraMin >= emMinutos(h.horaFim) && agoraMin < emMinutos(h.horaFim) + TOLERANCIA_FIM_MIN,
  );
  if (recemEncerrada) return { aula: recemEncerrada, estado: 'encerrando' };

  // 3) Começa logo — já dá para ver quem vem
  const proxima = ordenadas.find((h) => {
    const inicio = emMinutos(h.horaInicio);
    return inicio > agoraMin && inicio - agoraMin <= ANTECEDENCIA_MIN;
  });
  if (proxima) return { aula: proxima, estado: 'proxima' };

  return null;
}

/** Minutos do relógio agora, atualizados de minuto em minuto. */
function useMinutoAtual(): number {
  const calcular = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [minuto, setMinuto] = useState(calcular);

  useEffect(() => {
    // 30s: o pior atraso é meio minuto, e o custo é um setState sem re-render
    // quando o minuto não virou.
    const t = setInterval(() => setMinuto((atual) => {
      const novo = calcular();
      return novo === atual ? atual : novo;
    }), 30_000);
    return () => clearInterval(t);
  }, []);

  return minuto;
}

/** Aula em foco agora, entre as aulas de hoje do professor. */
export function useAulaAgora(aulasDeHoje: HorarioVaga[]): AulaAgora | null {
  const minuto = useMinutoAtual();
  // A dependência é a lista serializada: `aulasDeHoje` costuma ser um array
  // novo a cada render (vem de um .filter), o que anularia o memo.
  const chave = aulasDeHoje.map((h) => `${h.id}:${h.agendados}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => escolherAulaAgora(aulasDeHoje, minuto), [chave, minuto]);
}
