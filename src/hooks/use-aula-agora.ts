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

/**
 * Quanto tempo uma aula continua valendo depois do horário de fim.
 *
 * Aluno atrasa, termina a última série, tira dúvida — ele segue na sala
 * depois das 8h. Se a ficha dele sumisse na virada do relógio, o professor
 * perderia justamente quem ainda está treinando na frente dele.
 */
const MINUTOS_APOS_FIM = 15;

export type EstadoAula = 'agora' | 'proxima' | 'encerrando';

export interface AulaAgora {
  aula: HorarioVaga;
  estado: EstadoAula;
}

export interface FocoDaSala {
  /** Aula que manda na tela: em andamento, encerrando ou prestes a começar. */
  foco: AulaAgora | null;
  /**
   * Turma anterior que acabou há pouco enquanto a próxima já começou. Os
   * alunos dela ainda podem estar na sala, então continuam alcançáveis.
   * Null quando não há sobreposição.
   */
  anterior: HorarioVaga | null;
}

/**
 * Decide o que está na mão do professor agora.
 *
 * Função pura, separada do hook, para o comportamento nas viradas de horário
 * poder ser conferido sem montar tela.
 */
export function escolherAulaAgora(aulas: HorarioVaga[], agoraMin: number): FocoDaSala {
  const ordenadas = [...aulas].sort((a, b) => emMinutos(a.horaInicio) - emMinutos(b.horaInicio));

  /** Aula terminada há menos de MINUTOS_APOS_FIM. */
  const acabouAgorinha = (h: HorarioVaga) =>
    agoraMin >= emMinutos(h.horaFim) && agoraMin < emMinutos(h.horaFim) + MINUTOS_APOS_FIM;

  // 1) Em andamento — o caso normal, e o que ganha de qualquer outro
  const emAndamento = ordenadas.find(
    (h) => agoraMin >= emMinutos(h.horaInicio) && agoraMin < emMinutos(h.horaFim),
  );
  if (emAndamento) {
    // Turmas coladas (7–8h e 8–9h): quem estourou a das 7h ainda está ali.
    const anterior = ordenadas.find((h) => h.id !== emAndamento.id && acabouAgorinha(h)) ?? null;
    return { foco: { aula: emAndamento, estado: 'agora' }, anterior };
  }

  // 2) Acabou de terminar e não emendou outra: segue em foco por si mesma
  const recemEncerrada = ordenadas.find(acabouAgorinha);
  if (recemEncerrada) return { foco: { aula: recemEncerrada, estado: 'encerrando' }, anterior: null };

  // 3) Começa logo — já dá para ver quem vem
  const proxima = ordenadas.find((h) => {
    const inicio = emMinutos(h.horaInicio);
    return inicio > agoraMin && inicio - agoraMin <= ANTECEDENCIA_MIN;
  });
  if (proxima) return { foco: { aula: proxima, estado: 'proxima' }, anterior: null };

  return { foco: null, anterior: null };
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

/** O que está na sala agora, entre as aulas de hoje do professor. */
export function useAulaAgora(aulasDeHoje: HorarioVaga[]): FocoDaSala {
  const minuto = useMinutoAtual();
  // A dependência é a lista serializada: `aulasDeHoje` costuma ser um array
  // novo a cada render (vem de um .filter), o que anularia o memo.
  const chave = aulasDeHoje.map((h) => `${h.id}:${h.agendados}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => escolherAulaAgora(aulasDeHoje, minuto), [chave, minuto]);
}
