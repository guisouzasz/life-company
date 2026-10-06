/**
 * A regra da presença do estúdio, num lugar só.
 *
 * Não existe chamada. Aula marcada que não foi cancelada CONTA COMO DADA
 * quando termina: o aluno veio — ou não veio sem avisar no prazo, e aí a aula
 * é dele do mesmo jeito (Termo de Normas: fora do prazo, "a aula será
 * contabilizada"; e reposição não se cancela). É a mesma conta que já decide a
 * semana do plano: a aula consome a cota desde que é marcada.
 *
 * Antes as telas esperavam uma chamada que ninguém fazia — o registro de
 * presença existia na API, mas nenhuma tela o preenchia —, e a frequência de
 * todo mundo aparecia zerada.
 *
 * O que NÃO é presença:
 *  - aula cancelada, por quem for (aluno no prazo, dona, academia fechada);
 *  - aula que ainda não terminou;
 *  - falta registrada à mão (`presenca.compareceu = false` ou FALTOU) — a API
 *    ainda aceita, como exceção; nenhuma tela usa hoje.
 */

type AulaParaPresenca = {
  status: string;
  dataAula: Date;
  horario: { horaFim: string };
  presenca?: { compareceu: boolean } | null;
};

/** Quando a aula termina: o dia dela (gravado à meia-noite) mais a hora final. */
export function fimDaAula(dataAula: Date, horaFim: string): Date {
  const [h, m] = horaFim.split(':').map(Number);
  const fim = new Date(dataAula);
  fim.setHours(h, m, 0, 0);
  return fim;
}

export function aulaJaTerminou(dataAula: Date, horaFim: string, agora = new Date()): boolean {
  return fimDaAula(dataAula, horaFim).getTime() <= agora.getTime();
}

/** Falta registrada à mão — a única coisa que tira a presença de uma aula dada. */
export function temFaltaRegistrada(a: { status: string; presenca?: { compareceu: boolean } | null }): boolean {
  return a.status === 'FALTOU' || a.presenca?.compareceu === false;
}

/** A aula conta como presença: marcada, não cancelada, já terminou, sem falta registrada. */
export function contaComoPresenca(a: AulaParaPresenca, agora = new Date()): boolean {
  if (temFaltaRegistrada(a)) return false;
  if (a.status !== 'CONFIRMADO' && a.status !== 'REALIZADO') return false;
  return aulaJaTerminou(a.dataAula, a.horario.horaFim, agora);
}

/**
 * Quem cancelou uma aula CANCELADA.
 *
 * - `aluno`: ele mesmo, no prazo — é o cancelamento que gera crédito para ele
 *   (crédito com esta aula de origem e não concedido pelo estúdio);
 * - `academia`: dia fechado (feriado, recesso);
 * - `estudio`: a dona tirou (com crédito de compensação, ou sem crédito ao
 *   arrumar a agenda, trocar de turma, tirar do horário fixo).
 *
 * Só a do aluno pesa na assiduidade dele: as outras não foram escolha dele.
 */
export function quemCancelou(
  a: { id: string; diaFechadoId?: string | null },
  creditoDoAlunoPorOrigem: Set<string>,
): 'aluno' | 'academia' | 'estudio' {
  if (a.diaFechadoId) return 'academia';
  if (creditoDoAlunoPorOrigem.has(a.id)) return 'aluno';
  return 'estudio';
}
