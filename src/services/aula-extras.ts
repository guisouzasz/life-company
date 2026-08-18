import { useCallback, useEffect, useState } from 'react';
import { Storage } from './storage';

/**
 * Alunos que o professor coloca na aula "na mão".
 *
 * Acontece o tempo todo: o aluno chega para repor, troca de horário na hora,
 * ou entra junto com o irmão. O professor precisa da ficha dele ali com as
 * outras — mas quem mexe na agenda de verdade é a administração, então isto
 * NÃO cria agendamento nem consome cota. É uma anotação do professor, guardada
 * no próprio aparelho, que só muda o que ele enxerga.
 */

const CHAVE = 'professor:aula-extras';

export interface AlunoExtra {
  id: string;
  nome: string;
}

/** Uma entrada por aula+dia; o dia na frente para a limpeza ser uma comparação de texto. */
type Mapa = Record<string, AlunoExtra[]>;

const chaveDaAula = (data: string, horarioId: string) => `${data}|${horarioId}`;

/** Descarta aulas de dias anteriores — senão o registro cresce para sempre. */
function limpar(mapa: Mapa, hoje: string): Mapa {
  const limpo: Mapa = {};
  for (const [k, v] of Object.entries(mapa)) {
    if (k.slice(0, 10) >= hoje && v.length > 0) limpo[k] = v;
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
    // Conteúdo corrompido não pode derrubar a aula: começa vazio.
    return {};
  }
}

/**
 * Extras de uma aula, com a lista já persistida entre recarregamentos —
 * o professor não pode perder o aluno que acabou de encaixar só porque a
 * página recarregou no meio do treino.
 */
export function useAlunosExtras(data?: string, horarioId?: string) {
  const [mapa, setMapa] = useState<Mapa>({});
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!data) return;
    let vivo = true;
    ler(data).then((m) => {
      if (!vivo) return;
      setMapa(m);
      setCarregado(true);
      void Storage.set(CHAVE, JSON.stringify(m)); // grava já limpo
    });
    return () => {
      vivo = false;
    };
  }, [data]);

  const salvar = useCallback((proximo: Mapa) => {
    setMapa(proximo);
    void Storage.set(CHAVE, JSON.stringify(proximo));
  }, []);

  const chave = data && horarioId ? chaveDaAula(data, horarioId) : null;
  const extras = chave ? mapa[chave] ?? [] : [];

  const adicionar = useCallback(
    (aluno: AlunoExtra) => {
      if (!chave) return;
      const atuais = mapa[chave] ?? [];
      if (atuais.some((a) => a.id === aluno.id)) return;
      salvar({ ...mapa, [chave]: [...atuais, aluno] });
    },
    [chave, mapa, salvar],
  );

  const remover = useCallback(
    (alunoId: string) => {
      if (!chave) return;
      const restantes = (mapa[chave] ?? []).filter((a) => a.id !== alunoId);
      const proximo = { ...mapa };
      if (restantes.length > 0) proximo[chave] = restantes;
      else delete proximo[chave];
      salvar(proximo);
    },
    [chave, mapa, salvar],
  );

  return { extras, adicionar, remover, carregado };
}
