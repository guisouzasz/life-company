/**
 * Teto de alunos por turma, por modalidade.
 *
 * A capacidade sempre existiu por horário, livre de 1 a 20, e o padrão era 4
 * para tudo. Só que Pilates comporta 3 — então toda turma de Pilates criada
 * pelo painel nascia aceitando um aluno a mais do que cabe na sala. É o que a
 * dona viu como "passou do limite".
 *
 * O teto mora aqui, e não no banco, porque é regra da sala: quantos aparelhos
 * e quanto espaço existem. A capacidade do horário continua valendo para
 * BAIXO (uma turma de 2 é possível), mas nunca ultrapassa o teto.
 *
 * A comparação ignora acento e caixa de propósito: "Musculação", "musculacao"
 * e "MUSCULAÇÃO" são a mesma sala. Modalidade que ainda não está nesta lista
 * cai no padrão — melhor apertar de leve do que deixar entrar gente demais.
 */
const TETO_POR_MODALIDADE: Record<string, number> = {
  musculacao: 4,
  funcional: 4,
  pilates: 3,
};

/** Vale para modalidade nova, ainda não listada acima. */
const TETO_PADRAO = 4;

const normalizar = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira o acento
    .trim()
    .toLowerCase();

export function tetoDaModalidade(nomeModalidade?: string | null): number {
  if (!nomeModalidade) return TETO_PADRAO;
  return TETO_POR_MODALIDADE[normalizar(nomeModalidade)] ?? TETO_PADRAO;
}

/**
 * Quantos alunos a turma aceita de verdade: o que está no horário, limitado
 * pelo teto da modalidade.
 *
 * Usada tanto na hora de agendar quanto na contagem de vagas que o aluno vê —
 * as duas precisam dar o mesmo número, senão o app oferece uma vaga que a API
 * recusa.
 */
export function capacidadeEfetiva(
  capacidadeMaxima: number,
  nomeModalidade?: string | null,
): number {
  return Math.min(capacidadeMaxima, tetoDaModalidade(nomeModalidade));
}
