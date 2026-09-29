import { LC } from '../../constants/theme';
import type { IconName } from '../ui/icon';
import type { ResumoAluno, Treino } from '../../services/treinos/treinos.types';
import type { EvolucaoExercicio } from '../../services/cargas/cargas.types';
import { formatDate } from '../../services/date';

/**
 * Regras que o professor usa para bater o olho num aluno: a ficha dele está
 * em dia? Qual treino é o de hoje? Moram aqui, fora das telas, porque aparecem
 * na aula de agora, na sala e na lista de alunos — e têm que dizer a mesma
 * coisa nos três lugares.
 */

/** "YYYY-MM-DD" de hoje, no fuso do aparelho (o do estúdio). */
export function hojeIso(): string {
  return formatDate(new Date(), 'YYYY-MM-DD');
}

/**
 * O dia (YYYY-MM-DD) de uma data que veio da API, no fuso do aparelho.
 *
 * Pelo `Date`, e não cortando a string: carga antiga foi gravada com a hora
 * do registro, e a das 21h em diante vem em UTC com a data de amanhã.
 */
export function diaLocal(iso: string): string {
  return formatDate(new Date(iso), 'YYYY-MM-DD');
}

/** Dias de hoje até a data (negativo = já passou). */
export function diasAte(iso: string, hoje = hojeIso()): number {
  const [a, m, d] = (iso.length > 10 ? diaLocal(iso) : iso).split('-').map(Number);
  const [ha, hm, hd] = hoje.split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86_400_000);
}

export type Situacao = {
  chave: 'sem-ficha' | 'vencida' | 'vencendo' | 'em-dia';
  rotulo: string;
  cor: string;
  fundo: string;
  icone: IconName;
  /** Precisa do professor: sem ficha ou vencida. */
  urgente: boolean;
};

/** Até quantos dias antes do vencimento a ficha já pede atenção. */
const AVISO_DIAS = 10;

export function situacaoDoAluno(r?: ResumoAluno | null, hoje = hojeIso()): Situacao {
  if (!r || r.fichas === 0) {
    return { chave: 'sem-ficha', rotulo: 'Sem ficha', cor: LC.dangerFg, fundo: LC.dangerBg, icone: 'document-outline', urgente: true };
  }
  if (r.vencimento) {
    const dias = diasAte(r.vencimento, hoje);
    if (dias < 0) {
      return { chave: 'vencida', rotulo: 'Ficha vencida', cor: LC.dangerFg, fundo: LC.dangerBg, icone: 'alert-circle-outline', urgente: true };
    }
    if (dias <= AVISO_DIAS) {
      return {
        chave: 'vencendo',
        rotulo: dias === 0 ? 'Vence hoje' : dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`,
        cor: LC.warningFg, fundo: LC.warningBg, icone: 'time-outline', urgente: false,
      };
    }
  }
  return {
    chave: 'em-dia',
    rotulo: r.fichas === 1 ? '1 ficha' : `${r.fichas} fichas`,
    cor: LC.successFg, fundo: LC.successBg, icone: 'checkmark-circle-outline', urgente: false,
  };
}

/**
 * A ordem das fichas: a que o professor arrumou à mão, e depois o nome —
 * Treino 1 antes do Treino 2, A antes de B. Antes vinha a última editada
 * primeiro, e mexer no Treino 1 jogava o Treino 2 para o topo.
 */
export function ordenarFichas<T extends Pick<Treino, 'titulo'> & { ordem?: number | null }>(fichas: T[]): T[] {
  return [...fichas].sort((a, b) => {
    const oa = a.ordem ?? Number.MAX_SAFE_INTEGER;
    const ob = b.ordem ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.titulo.localeCompare(b.titulo, 'pt-BR', { numeric: true, sensitivity: 'base' });
  });
}

/** Última data (YYYY-MM-DD) com carga registrada em algum exercício da ficha. */
function ultimoTreinoDaFicha(ficha: Treino, cargas: EvolucaoExercicio[]): string | null {
  const nomes = new Set(ficha.exercicios.map((e) => e.nome));
  let ultima: string | null = null;
  for (const evo of cargas) {
    if (!nomes.has(evo.exercicio)) continue;
    for (const r of evo.registros) {
      const d = diaLocal(r.data);
      if (!ultima || d > ultima) ultima = d;
    }
  }
  return ultima;
}

/**
 * Qual ficha é a de hoje, para quem tem Treino A, B, C.
 *
 * O sistema não guarda "o aluno fez o treino A na terça" — mas guarda a carga
 * de cada exercício com a data, e cada exercício mora numa ficha. A ficha
 * feita há mais tempo (ou nunca) é a da vez. É uma sugestão, e a tela diz de
 * onde ela veio para o professor concordar ou trocar num toque.
 *
 * Null quando há uma ficha só, ou quando nenhuma tem carga (não há de onde
 * tirar a vez).
 */
export function fichaSugerida(
  fichas: Treino[],
  cargas: EvolucaoExercicio[],
  hoje = hojeIso(),
): { id: string; motivo: string } | null {
  const comExercicio = fichas.filter((f) => f.exercicios.length > 0);
  if (comExercicio.length < 2) return null;
  const datas = comExercicio.map((f) => ({ f, ultima: ultimoTreinoDaFicha(f, cargas) }));
  if (datas.every((d) => !d.ultima)) return null;

  // Já treinou hoje uma delas: a de hoje é essa.
  const deHoje = datas.find((d) => d.ultima === hoje);
  if (deHoje) return { id: deHoje.f.id, motivo: 'já tem carga registrada hoje' };

  const escolhida = datas.reduce((a, b) => {
    if (!a.ultima) return a;
    if (!b.ultima) return b;
    return b.ultima < a.ultima ? b : a;
  });
  const maisRecente = datas.reduce((a, b) => ((b.ultima ?? '') > (a.ultima ?? '') ? b : a));
  const quando = maisRecente.ultima ? formatDate(maisRecente.ultima, 'DD/MM') : '';
  const curto = (t: string) => t.split(/\s+[—–-]\s+/)[0];
  const motivo = escolhida.ultima
    ? `sem treino desde ${formatDate(escolhida.ultima, 'DD/MM')}`
    : `o ${curto(maisRecente.f.titulo)} foi em ${quando}`;
  return { id: escolhida.f.id, motivo };
}

/** Tem carga registrada hoje neste exercício? É o "feito" da aula. */
export function cargaDeHoje(evo: EvolucaoExercicio | null | undefined, hoje = hojeIso()) {
  if (!evo) return null;
  const r = [...evo.registros].reverse().find((x) => diaLocal(x.data) === hoje);
  return r ?? null;
}

/**
 * Como chamar cada aluno numa turma, no espaço de uma foto: o primeiro nome,
 * e o primeiro nome + inicial do sobrenome quando dois se chamam igual (o
 * estúdio tem três Carlos, e dois podem cair na mesma aula).
 */
export function apelidosDaTurma(alunos: { id: string; nome: string }[]): Record<string, string> {
  const partes = (nome: string) => nome.trim().split(/\s+/).filter(Boolean);
  const cap = (p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  const primeiro = (nome: string) => cap(partes(nome)[0] ?? nome);
  const contagem = new Map<string, number>();
  alunos.forEach((a) => contagem.set(primeiro(a.nome), (contagem.get(primeiro(a.nome)) ?? 0) + 1));
  const out: Record<string, string> = {};
  for (const a of alunos) {
    const p = primeiro(a.nome);
    const ultimo = partes(a.nome).slice(-1)[0];
    out[a.id] = (contagem.get(p) ?? 0) > 1 && ultimo && partes(a.nome).length > 1 ? `${p} ${ultimo.charAt(0).toUpperCase()}.` : p;
  }
  return out;
}
