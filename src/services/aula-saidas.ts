import { useCallback, useEffect, useState } from 'react';
import { Storage } from './storage';

/**
 * Quem o professor já viu sair da sala depois do fim da aula.
 *
 * A turma que acabou continua na tela por 15 minutos (use-aula-agora.ts) —
 * aluno atrasa, termina a última série. Mas quem já foi embora ficava ali
 * misturado com a turma nova até o relógio virar. Pedido da dona: o
 * professor de musculação tira da tela quem saiu.
 *
 * Como os encaixes (aula-extras.ts), é só o que ESTE professor enxerga, no
 * próprio aparelho: não mexe em agenda, presença, cota nem crédito.
 */

const CHAVE = 'professor:aula-saidas';

/** "AAAA-MM-DD|horarioId" → ids de quem saiu. O dia na frente para a limpeza ser comparação de texto. */
type Mapa = Record<string, string[]>;

const chaveDaAula = (data: string, horarioId: string) => `${data}|${horarioId}`;

/** Descarta dias anteriores — senão o registro cresce para sempre. */
function limpar(mapa: Mapa, hoje: string): Mapa {
  const limpo: Mapa = {};
  for (const [k, v] of Object.entries(mapa)) {
    if (k.slice(0, 10) >= hoje && Array.isArray(v) && v.length > 0) limpo[k] = v;
  }
  return limpo;
}

async function ler(hoje: string): Promise<Mapa> {
  const bruto = await Storage.get(CHAVE);
  if (!bruto) return {};
  try {
    const mapa = JSON.parse(bruto) as Mapa;
    return limpar(mapa && typeof mapa === 'object' ? mapa : {}, hoje);
  } catch {
    // Conteúdo corrompido não pode derrubar a sala: começa vazio.
    return {};
  }
}

export function useSaidasDaSala(data?: string) {
  const [mapa, setMapa] = useState<Mapa>({});

  useEffect(() => {
    if (!data) return;
    let vivo = true;
    ler(data).then((m) => {
      if (!vivo) return;
      setMapa(m);
      void Storage.set(CHAVE, JSON.stringify(m)); // grava já limpo
    });
    return () => {
      vivo = false;
    };
  }, [data]);

  /** Ids de quem já saiu da aula `horarioId` hoje. */
  const sairam = useCallback(
    (horarioId?: string): Set<string> => new Set(data && horarioId ? mapa[chaveDaAula(data, horarioId)] ?? [] : []),
    [data, mapa],
  );

  /** Marca que estes alunos saíram da sala (um ou vários de uma vez). */
  const marcarSaida = useCallback(
    (horarioId: string, alunoIds: string[]) => {
      if (!data || alunoIds.length === 0) return;
      const chave = chaveDaAula(data, horarioId);
      setMapa((atual) => {
        const proximo = { ...atual, [chave]: [...new Set([...(atual[chave] ?? []), ...alunoIds])] };
        void Storage.set(CHAVE, JSON.stringify(proximo));
        return proximo;
      });
    },
    [data],
  );

  return { sairam, marcarSaida };
}
