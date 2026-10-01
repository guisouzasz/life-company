/**
 * Transforma o texto de uma ficha em PDF (feita no Word ou no Excel) em
 * fichas do sistema: título, grupos, exercícios, séries, repetições e carga.
 *
 * Não tem IA: são as regras de como uma ficha costuma ser escrita. Por isso o
 * resultado sempre passa pelo professor — ele abre no formulário, confere e
 * só então salva — e o que não deu para entender aparece numa lista, em vez
 * de sumir calado.
 *
 * Os dois formatos que chegam:
 *  - Word: uma linha por exercício — "Supino reto – 4x12 – 20kg",
 *    "Rosca direta 3 séries de 12", com "TREINO A" separando as fichas;
 *  - Excel/tabela: colunas Exercício | Séries | Repetições | Carga. A coluna
 *    de cada valor sai da posição dele debaixo do cabeçalho.
 */
import { EXERCICIOS_POR_GRUPO } from '../../constants/exercicios';
import type { LinhaPdf } from '../../services/treinos/treinos.types';

export interface ExercicioImportado {
  grupo: string;
  nome: string;
  series: number;
  repeticoes: string;
  carga: string;
  observacao: string;
}

export interface FichaImportada {
  /** Vazio quando o PDF não dá nome à ficha: a tela sugere "Treino N". */
  titulo: string;
  textoAntes: string;
  observacoes: string;
  conteudo: string;
  exercicios: ExercicioImportado[];
}

export interface Importacao {
  fichas: FichaImportada[];
  /** Linhas com cara de conteúdo que não viraram nada — o professor confere. */
  ignoradas: string[];
}

// ── Texto ─────────────────────────────────────────────────────────────

/** Sem acento, minúsculo, só letras e números: para comparar, nunca para mostrar. */
export const normalizar = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Tira traço, dois-pontos e barra soltos nas pontas. */
const aparar = (s: string): string => s.replace(/^[\s\-–—:|,;.•]+|[\s\-–—:|,;]+$/g, '').trim();

/** Tira marcador de lista do começo: "1.", "2)", "•", "-", "a)". */
const semMarcador = (s: string): string =>
  s.replace(/^\s*(?:[-–—•●▪◦*>]|\d{1,2}\s*[.)º°]|\(?[a-z]\))\s*/i, '').trim();

const textoDaLinha = (l: LinhaPdf): string => l.celulas.map((c) => c.texto).join(' ').replace(/\s+/g, ' ').trim();

// ── Grupos e catálogo ─────────────────────────────────────────────────

/** Como os grupos aparecem escritos nas fichas → nome do grupo no sistema. */
const GRUPO_POR_APELIDO: Record<string, string> = {
  aquecimento: 'Aquecimento',
  alongamento: 'Alongamento',
  alongamentos: 'Alongamento',
  abdominal: 'Abdominal',
  abdominais: 'Abdominal',
  abdomen: 'Abdominal',
  abdome: 'Abdominal',
  core: 'Abdominal',
  aerobico: 'Aeróbico',
  cardio: 'Aeróbico',
  antebraco: 'Antebraço',
  biceps: 'Bíceps',
  costas: 'Costas',
  dorsal: 'Costas',
  dorsais: 'Costas',
  gluteo: 'Glúteo',
  gluteos: 'Glúteo',
  ombro: 'Ombro',
  ombros: 'Ombro',
  deltoide: 'Ombro',
  deltoides: 'Ombro',
  panturrilha: 'Panturrilha',
  panturrilhas: 'Panturrilha',
  peito: 'Peitoral',
  peitoral: 'Peitoral',
  peitorais: 'Peitoral',
  perna: 'Pernas',
  pernas: 'Pernas',
  'membros inferiores': 'Pernas',
  quadriceps: 'Pernas',
  posterior: 'Pernas',
  'posterior de coxa': 'Pernas',
  coxa: 'Pernas',
  coxas: 'Pernas',
  triceps: 'Tríceps',
};

const grupoDoTexto = (s: string): string | null => GRUPO_POR_APELIDO[normalizar(s)] ?? null;

/** Nome normalizado → grafia do catálogo e o grupo dele. */
const CATALOGO = new Map<string, { nome: string; grupo: string }>();
for (const [grupo, nomes] of Object.entries(EXERCICIOS_POR_GRUPO)) {
  for (const nome of nomes) {
    const chave = normalizar(nome);
    if (!CATALOGO.has(chave)) CATALOGO.set(chave, { nome, grupo });
  }
}

/**
 * Nome de aparelho como se fala na academia → como está no catálogo do
 * professor. Só os casos sem dúvida: a evolução de carga do aluno é casada
 * pelo nome, então trocar um nome errado custaria o histórico dele.
 */
const SINONIMOS: Record<string, string> = {
  'cadeira extensora': 'extensor',
  extensora: 'extensor',
  'mesa flexora': 'flexor',
  'cadeira flexora': 'flexor',
  flexora: 'flexor',
  'cadeira abdutora': 'abdutor',
  abdutora: 'abdutor',
  'cadeira adutora': 'adutor',
  adutora: 'adutor',
};

/**
 * Grupo pelo jeito do nome, para exercício fora do catálogo. A ordem importa:
 * "supino fechado" é tríceps antes de ser peito, e "rosca punho" é antebraço
 * antes de ser bíceps.
 */
const GRUPO_POR_PALAVRA: [RegExp, string][] = [
  [/\b(esteira|bicicleta|bike|eliptico|transport|escada|polichinelo|mobilidade)\b/, 'Aquecimento'],
  [/\balongamento\b/, 'Alongamento'],
  [/\b(triceps|frances|testa|coice|supino fechado|mergulho)\b/, 'Tríceps'],
  [/\b(punho|antebraco)\b/, 'Antebraço'],
  [/\b(rosca|biceps)\b/, 'Bíceps'],
  // Ombro antes de peito: "crucifixo inverso" é ombro, o resto dos crucifixos é peito.
  [/\b(desenvolvimento|elevacao lateral|elevacao frontal|crucifixo inverso|encolhimento|ombro)\b/, 'Ombro'],
  [/\b(supino|crucifixo|voador|peck|crossover|cross over|flexao de braco|peitoral)\b/, 'Peitoral'],
  [/\b(remada|puxada|pull ?down|barra fixa|serrote|pulley|dorsal)\b/, 'Costas'],
  [/\b(panturrilha|gemeos)\b/, 'Panturrilha'],
  [/\b(gluteo|pelvica|coice de gluteo|abducao)\b/, 'Glúteo'],
  [/\b(agachamento|leg|extensora|flexora|stiff|afundo|passada|hack|levantamento terra|adutora|abdutora|sumo|bulgaro)\b/, 'Pernas'],
  [/\b(abdominal|abdomen|prancha|crunch|infra|supra|obliquo|canivete)\b/, 'Abdominal'],
];

const GRUPOS_EM_MINUTOS = ['Aquecimento', 'Alongamento'];

/** Grafia do catálogo e grupo, quando o nome é de um exercício conhecido. */
function doCatalogo(nome: string): { nome: string; grupo: string } | null {
  const chave = normalizar(nome);
  return CATALOGO.get(chave) ?? CATALOGO.get(SINONIMOS[chave] ?? '') ?? null;
}

function grupoPeloNome(nome: string): string {
  const chave = normalizar(nome);
  for (const [padrao, grupo] of GRUPO_POR_PALAVRA) if (padrao.test(chave)) return grupo;
  return '';
}

// ── Peças de uma linha ────────────────────────────────────────────────

/** Repetições: "12", "10-12", "10 a 12", "30s", "10 min", "até a falha". */
const REPS = String.raw`(\d{1,3}(?:\s*(?:-|–|a|\/|ou)\s*\d{1,3}(?!\s*kg|[.,]\d|\d))?(?:\s*(?:min(?:utos?)?|seg(?:undos?)?|s|"|''|rep(?:s|eti[cç](?:ão|ões|ao|oes))?)(?![a-zà-ú]))?|at[eé]\s+a\s+falha|falha|m[aá]x(?:imo)?)`;
/** "4x12", "4 x 10-12", "3X15" */
const SERIE_X_REPS = new RegExp(String.raw`(?<![\d,.])(\d{1,2})\s*[x×]\s*` + REPS, 'i');
/** "3 séries de 12", "3 series 10 a 12 repetições" */
const SERIES_DE_REPS = new RegExp(String.raw`(?<![\d,.])(\d{1,2})\s*s[ée]ries?\s*(?:de\s*)?` + REPS, 'i');
/** Só tempo: "Esteira 10 min" */
const SO_TEMPO = /(?<![\d,.])(\d{1,3})\s*(min(?:utos?)?)(?![a-zà-ú])/i;
const CARGA = /(\d{1,3}(?:[.,]\d{1,2})?)\s*kg\b/i;

/** "20" na coluna de carga é 20 kg; "20kg", "2 placas" ficam como escritos. */
function formatarCarga(valor: string): string {
  const v = valor.trim();
  if (!v || v === '-' || v === '—') return '';
  const kg = CARGA.exec(v);
  if (kg) return `${kg[1]} kg`;
  return /^\d{1,3}(?:[.,]\d{1,2})?$/.test(v) ? `${v} kg` : v;
}

const limparReps = (r: string): string =>
  r
    .replace(/\s+/g, ' ')
    .replace(/\s*(?:-|–)\s*/g, '-')
    .replace(/\s*rep(?:s|eti[cç](?:ão|ões|ao|oes))?$/i, '')
    .trim()
    .slice(0, 40);

const limitarSeries = (n: number): number => Math.min(Math.max(Number.isFinite(n) ? n : 3, 1), 20);

/** Monta o exercício pondo o nome na grafia do catálogo e achando o grupo. */
function exercicio(
  nomeBruto: string,
  grupoAtual: string,
  campos: { series?: number; repeticoes?: string; carga?: string; observacao?: string },
): ExercicioImportado | null {
  const nomeLimpo = aparar(semMarcador(nomeBruto)).replace(/\s+/g, ' ').slice(0, 80);
  if (!/[a-zà-ú]{2}/i.test(nomeLimpo)) return null;
  const conhecido = doCatalogo(nomeLimpo);
  const grupo = grupoAtual || conhecido?.grupo || grupoPeloNome(nomeLimpo);
  const emMinutos = GRUPOS_EM_MINUTOS.includes(grupo);
  return {
    grupo,
    nome: conhecido?.nome ?? nomeLimpo.charAt(0).toUpperCase() + nomeLimpo.slice(1),
    series: limitarSeries(campos.series ?? (emMinutos ? 1 : 3)),
    repeticoes: campos.repeticoes || (emMinutos ? '10 min' : '12'),
    carga: campos.carga ?? '',
    observacao: (campos.observacao ?? '').slice(0, 200),
  };
}

/** Uma linha escrita, do Word: "2. Remada curvada 4 x 10 - 30 kg (pegada pronada)". */
function exercicioDeTexto(texto: string, grupoAtual: string): ExercicioImportado | null {
  const linha = semMarcador(texto);
  const achado = SERIE_X_REPS.exec(linha) ?? SERIES_DE_REPS.exec(linha);
  let antes: string;
  let depois: string;
  let series: number | undefined;
  let repeticoes: string | undefined;
  if (achado) {
    antes = linha.slice(0, achado.index);
    depois = linha.slice(achado.index + achado[0].length);
    series = parseInt(achado[1], 10);
    repeticoes = limparReps(achado[2]);
  } else {
    const tempo = SO_TEMPO.exec(linha);
    if (!tempo) {
      // Sem número nenhum: só vira exercício se o nome for um do catálogo.
      return doCatalogo(aparar(linha)) ? exercicio(linha, grupoAtual, {}) : null;
    }
    antes = linha.slice(0, tempo.index);
    depois = linha.slice(tempo.index + tempo[0].length);
    series = 1;
    repeticoes = `${tempo[1]} min`;
  }
  // "4x12 Supino reto": o nome veio depois da série.
  if (!/[a-zà-ú]{2}/i.test(antes) && /[a-zà-ú]{2}/i.test(depois)) {
    const resto = depois.split(/\s[-–—|]\s|[(]/)[0];
    antes = resto;
    depois = depois.slice(resto.length);
  }
  let carga = '';
  const kg = CARGA.exec(depois) ?? CARGA.exec(antes);
  if (kg) {
    carga = `${kg[1]} kg`;
    if (CARGA.test(depois)) depois = depois.replace(CARGA, ' ');
    else antes = antes.replace(CARGA, ' ');
  }
  const observacao = aparar(depois.replace(/[()]/g, ' ').replace(/\s+/g, ' '));
  return exercicio(antes, grupoAtual, { series, repeticoes, carga, observacao });
}

// ── Tabela (Excel, tabela do Word) ────────────────────────────────────

type Coluna = 'grupo' | 'nome' | 'series' | 'reps' | 'carga' | 'obs' | 'descanso';

function tipoDeColuna(cabecalho: string): Coluna | null {
  const t = normalizar(cabecalho);
  if (/^(grupo|musculo|grupamento)/.test(t)) return 'grupo';
  if (/^(exercicio|nome|atividade|aparelho)/.test(t)) return 'nome';
  if (/^(series?|sets?|serie s|n series|s)$/.test(t) || /^series\b/.test(t)) return 'series';
  if (/^(rep|repeticoes|repeticao|reps|tempo)/.test(t)) return 'reps';
  if (/^(carga|peso|kg)/.test(t)) return 'carga';
  if (/^(descanso|intervalo|pausa)/.test(t)) return 'descanso';
  if (/^(obs|observ|tecnica|metodo|dica)/.test(t)) return 'obs';
  return null;
}

/** Linha de cabeçalho: tem "Exercício" e pelo menos séries ou repetições. */
function cabecalhoDaTabela(l: LinhaPdf): { tipo: Coluna; x: number }[] | null {
  if (l.celulas.length < 2) return null;
  const colunas = l.celulas
    .map((c) => ({ tipo: tipoDeColuna(c.texto), x: c.x }))
    .filter((c): c is { tipo: Coluna; x: number } => c.tipo !== null);
  const tipos = new Set(colunas.map((c) => c.tipo));
  return tipos.has('nome') && (tipos.has('series') || tipos.has('reps')) ? colunas : null;
}

/**
 * Cada pedaço vai para o cabeçalho mais perto. Perto, e não "o de cima":
 * o Word centraliza o cabeçalho e alinha o conteúdo à esquerda, então o
 * número de "Séries" fica um pouco antes do título da coluna.
 */
function linhaDaTabela(l: LinhaPdf, colunas: { tipo: Coluna; x: number }[]): Partial<Record<Coluna, string>> {
  const valores: Partial<Record<Coluna, string>> = {};
  for (const c of l.celulas) {
    let melhor = colunas[0];
    for (const col of colunas) if (Math.abs(col.x - c.x) < Math.abs(melhor.x - c.x)) melhor = col;
    valores[melhor.tipo] = valores[melhor.tipo] ? `${valores[melhor.tipo]} ${c.texto}` : c.texto;
  }
  return valores;
}

function exercicioDaTabela(v: Partial<Record<Coluna, string>>, grupoAtual: string): ExercicioImportado | null {
  const nome = v.nome?.trim() ?? '';
  if (!nome) return null;
  // "4x12" escrito na coluna de séries, ou série e repetição juntas no nome.
  const junto = SERIE_X_REPS.exec(v.series ?? '') ?? SERIE_X_REPS.exec(v.reps ?? '');
  if (!v.series && !v.reps && SERIE_X_REPS.test(nome)) return exercicioDeTexto(nome, grupoAtual);
  const series = junto ? parseInt(junto[1], 10) : parseInt((v.series ?? '').replace(/\D+/g, ' ').trim().split(' ')[0], 10);
  const repeticoes = junto ? limparReps(junto[2]) : limparReps(v.reps ?? '');
  const observacao = [v.descanso ? `descanso ${v.descanso.trim()}` : '', v.obs?.trim() ?? '']
    .filter(Boolean)
    .join(' · ');
  const grupo = (v.grupo && grupoDoTexto(v.grupo)) || grupoAtual;
  return exercicio(nome, grupo, {
    series: Number.isFinite(series) ? series : undefined,
    repeticoes: repeticoes || undefined,
    carga: formatarCarga(v.carga ?? ''),
    observacao,
  });
}

// ── A ficha inteira ───────────────────────────────────────────────────

/** "TREINO A", "Treino 1 – Peito", "Ficha B", "Série C", "Dia 2", "Segunda-feira". */
const CABECALHO_DE_FICHA =
  /^(?:(?:treino|ficha|serie|rotina|dia)\s*[-:–—]?\s*(?:[a-e]|\d{1,2})(?![a-z0-9])|(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:\s*feira)?(?![a-z]))/;

/** Cabeçalho de papel: nome, data, academia. Não é treino nem precisa de aviso. */
const RUIDO =
  /^(aluno|aluna|nome|professor|professora|prof|data|academia|ficha de treino|ficha de treinamento|objetivo|telefone|idade|inicio|validade|pagina|assinatura|cref)\b/;

const ANTES = /^(aquecimento|mobilidade|ativacao)\s*[:\-–—]\s*\S/i;
const DEPOIS = /^(alongamentos?|desaquecimento|volta a calma)\s*[:\-–—]\s*\S/i;
const OBS = /^(obs|observacao|observacoes|atencao|importante)\s*[:\-–—.]\s*/i;

/** Minúsculo e sem acento, mas com a pontuação — para ler "Obs:" e "Ativação -". */
const semAcento = (s: string): string => s.normalize('NFC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const nova = (titulo = ''): FichaImportada => ({ titulo, textoAntes: '', observacoes: '', conteudo: '', exercicios: [] });
const juntar = (atual: string, mais: string) => (atual ? `${atual}\n${mais}` : mais);

export function interpretarFicha(linhas: LinhaPdf[]): Importacao {
  const fichas: FichaImportada[] = [];
  const ignoradas: string[] = [];
  /** O que vem antes da primeira ficha vale para todas (aquecimento, obs). */
  const geral = nova();
  let atual: FichaImportada | null = null;
  let grupoAtual = '';
  let colunas: { tipo: Coluna; x: number }[] | null = null;

  const ficha = (): FichaImportada => {
    if (!atual) {
      atual = nova();
      fichas.push(atual);
    }
    return atual;
  };

  for (const linha of linhas) {
    const texto = textoDaLinha(linha);
    const chave = normalizar(texto);
    if (!chave) continue;

    const cabecalho = cabecalhoDaTabela(linha);
    if (cabecalho) {
      colunas = cabecalho;
      continue;
    }

    const semNumero = normalizar(semMarcador(texto));
    if (CABECALHO_DE_FICHA.test(semNumero) && !SERIE_X_REPS.test(texto) && texto.length <= 80) {
      atual = nova(aparar(semMarcador(texto)).replace(/\s+/g, ' '));
      fichas.push(atual);
      grupoAtual = '';
      continue;
    }

    const grupo = grupoDoTexto(aparar(semMarcador(texto)));
    if (grupo) {
      grupoAtual = grupo;
      continue;
    }

    // Em tabela, com mais de uma célula: cada valor na sua coluna.
    if (colunas && linha.celulas.length >= 2) {
      const ex = exercicioDaTabela(linhaDaTabela(linha, colunas), grupoAtual);
      if (ex) {
        ficha().exercicios.push(ex);
        continue;
      }
    }

    // Aquecimento, alongamento do fim e observação: texto, não exercício.
    const semMarca = semMarcador(texto).normalize('NFC');
    const comparavel = semAcento(semMarca);
    const temSerie = SERIE_X_REPS.test(semMarca);
    const alvo = atual ?? geral;
    if (ANTES.test(comparavel) && !temSerie) {
      alvo.textoAntes = juntar(alvo.textoAntes, aparar(semMarca));
      continue;
    }
    if (DEPOIS.test(comparavel) && !temSerie) {
      alvo.conteudo = juntar(alvo.conteudo, aparar(semMarca));
      continue;
    }
    const obs = OBS.exec(comparavel);
    if (obs && semMarca.length > obs[0].length) {
      alvo.observacoes = juntar(alvo.observacoes, aparar(semMarca.slice(obs[0].length)));
      continue;
    }

    const ex = exercicioDeTexto(texto, grupoAtual);
    if (ex) {
      ficha().exercicios.push(ex);
      continue;
    }

    if (!RUIDO.test(chave)) ignoradas.push(texto.slice(0, 160));
  }

  const comAlgo = fichas.filter((f) => f.exercicios.length > 0);
  for (const f of comAlgo) {
    if (!f.textoAntes) f.textoAntes = geral.textoAntes;
    if (!f.observacoes) f.observacoes = geral.observacoes;
    if (!f.conteudo) f.conteudo = geral.conteudo;
  }
  return { fichas: comAlgo, ignoradas };
}
