/**
 * As perguntas da ficha de anamnese, exatamente como o estúdio as escreveu.
 *
 * Ficam num arquivo só porque três telas leem daqui: o formulário que o aluno
 * preenche, a ficha que o professor lê e a lista de regiões do boneco. Com as
 * opções copiadas em cada tela, uma patologia acrescentada no formulário
 * apareceria como texto solto na ficha do professor — ou, pior, a ficha
 * deixaria de reconhecer uma resposta e a esconderia.
 *
 * O texto é o do documento, sem reescrever: a dona precisa reconhecer a
 * pergunta dela, e é ela que responde ao aluno quando alguém liga com dúvida.
 */

/** Objetivo principal — o documento pede "marque até 2". */
export const MAX_OBJETIVOS = 2;

export const OBJETIVOS = [
  'Emagrecimento / Redução de gordura',
  'Ganho de massa muscular (Hipertrofia)',
  'Saúde, postura e alívio de dores',
  'Condicionamento físico geral',
  'Performance / Preparação para outro esporte',
] as const;

export const EXPERIENCIAS = [
  'Nunca treinei / Sedentário há mais de 1 ano',
  'Já treinei antes, mas estou parado há alguns meses',
  'Já treino regularmente (praticante ativo)',
] as const;

export const POSTURAS = [
  'Sentado(a)',
  'Em pé parado(a)',
  'Em pé em movimento/caminhando',
  'Trabalho com esforço físico/levantamento de cargas',
] as const;

export const PATOLOGIAS = [
  'Hipertensão (pressão alta)',
  'Diabetes',
  'Colesterol ou triglicerídeos alterados',
  'Problemas cardíacos (arritmias, sopro, histórico de infarto)',
  'Problemas respiratórios (asma, bronquite)',
  'Problemas na tireoide (hipo/hipertireoidismo)',
  'Labirintite ou episódios frequentes de tontura',
  'Osteoporose / Osteopenia',
  'Hérnia de disco ou desvios posturais diagnosticados',
] as const;

/**
 * A opção que exclui as outras: marcar "nenhuma" limpa a lista.
 *
 * Sem essa regra, a ficha aceitaria "tenho diabetes" e "não tenho nada" ao
 * mesmo tempo, e o professor teria que adivinhar qual valia.
 */
export const PATOLOGIA_NENHUMA = 'Nenhuma condição de saúde diagnosticada';

export const PARQ = [
  'Algum médico já disse que você possui algum problema de coração e recomendou que você só fizesse exercícios com supervisão médica?',
  'Você sente dores no peito provocadas pela prática de atividade física?',
  'No último mês, você sentiu dores no peito mesmo sem estar praticando atividade física?',
  'Você perde o equilíbrio devido a tonturas ou já perdeu a consciência/desmaiou alguma vez?',
  'Você tem algum problema ósseo ou articular que pode ser agravado pela prática de atividade física?',
  'Você toma atualmente algum medicamento para pressão arterial ou problemas cardíacos?',
  'Sabe de alguma outra razão pela qual você não deva realizar atividade física?',
] as const;

/** A opção exclusiva do PAR-Q, igual à de patologias. */
export const PARQ_NENHUMA = 'Nenhuma das opções acima se aplica a mim';

/**
 * As regiões do boneco.
 *
 * `id` é o que vai para o banco e nunca muda — o rótulo pode ser reescrito
 * sem invalidar o que os alunos já marcaram. `lado` separa direito de
 * esquerdo onde isso muda o treino (ombro, joelho) e é ausente onde não faz
 * sentido (lombar, cervical).
 */
export type RegiaoDoCorpo = {
  id: string;
  rotulo: string;
  vista: 'frente' | 'costas';
};

export const REGIOES_DOR: RegiaoDoCorpo[] = [
  { id: 'cervical', rotulo: 'Nuca / cervical', vista: 'costas' },
  { id: 'ombro-d', rotulo: 'Ombro direito', vista: 'frente' },
  { id: 'ombro-e', rotulo: 'Ombro esquerdo', vista: 'frente' },
  { id: 'peito', rotulo: 'Peito', vista: 'frente' },
  { id: 'cotovelo-d', rotulo: 'Cotovelo direito', vista: 'frente' },
  { id: 'cotovelo-e', rotulo: 'Cotovelo esquerdo', vista: 'frente' },
  { id: 'punho-d', rotulo: 'Punho / mão direita', vista: 'frente' },
  { id: 'punho-e', rotulo: 'Punho / mão esquerda', vista: 'frente' },
  { id: 'abdomen', rotulo: 'Abdômen', vista: 'frente' },
  { id: 'quadril-d', rotulo: 'Quadril direito', vista: 'frente' },
  { id: 'quadril-e', rotulo: 'Quadril esquerdo', vista: 'frente' },
  { id: 'joelho-d', rotulo: 'Joelho direito', vista: 'frente' },
  { id: 'joelho-e', rotulo: 'Joelho esquerdo', vista: 'frente' },
  { id: 'canela-d', rotulo: 'Canela / pé direito', vista: 'frente' },
  { id: 'canela-e', rotulo: 'Canela / pé esquerdo', vista: 'frente' },
  { id: 'dorsal', rotulo: 'Costas (meio)', vista: 'costas' },
  { id: 'lombar', rotulo: 'Lombar', vista: 'costas' },
  { id: 'gluteo', rotulo: 'Glúteo', vista: 'costas' },
  { id: 'posterior-d', rotulo: 'Posterior da coxa direita', vista: 'costas' },
  { id: 'posterior-e', rotulo: 'Posterior da coxa esquerda', vista: 'costas' },
  { id: 'panturrilha-d', rotulo: 'Panturrilha direita', vista: 'costas' },
  { id: 'panturrilha-e', rotulo: 'Panturrilha esquerda', vista: 'costas' },
];

/** "ombro-d" → "Ombro direito". Para a ficha do professor ler o que foi marcado. */
export const rotuloDaRegiao = (id: string): string =>
  REGIOES_DOR.find((r) => r.id === id)?.rotulo ?? id;

/**
 * Lê uma lista que veio do banco como JSON.
 *
 * Devolve lista vazia em vez de estourar: um campo gravado por uma versão
 * antiga (ou por um erro) não pode derrubar a ficha de saúde inteira na cara
 * do professor no meio da aula.
 */
export function listaDoJson(valor?: string | null): string[] {
  if (!valor) return [];
  try {
    const v = JSON.parse(valor);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
