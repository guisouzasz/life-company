/**
 * A ficha de anamnese como ela vem da API.
 *
 * As listas chegam como JSON em texto (`objetivos`, `patologias`, `parq`,
 * `regioesDor`) — use `listaDoJson` de `constants/anamnese` para ler. Ficaram
 * em texto porque o banco é o mesmo de sempre e a mudança precisava ser
 * aditiva, sem migração com janela.
 *
 * Os campos `sim/não` são `boolean | null` de propósito: `null` é "não
 * respondeu", `false` é "respondeu que não". Tratar os dois como iguais faria
 * a ficha afirmar que o aluno não tem lesão quando ele só não chegou ali.
 */
export interface Anamnese {
  id: string;
  usuarioId: string;

  contatoEmergenciaNome?: string | null;
  contatoEmergenciaTelefone?: string | null;

  /** JSON: ["Emagrecimento / Redução de gordura", ...] — até 2. */
  objetivos?: string | null;
  experiencia?: string | null;

  profissao?: string | null;
  posturaPredominante?: string | null;
  movimentosRepetitivos?: boolean | null;
  movimentosRepetitivosQuais?: string | null;

  /** JSON: ["Hipertensão (pressão alta)", ...]. */
  patologias?: string | null;
  patologiaOutra?: string | null;

  usaMedicamento?: boolean | null;
  medicamentos?: string | null;
  fezCirurgia?: boolean | null;
  cirurgiaQual?: string | null;
  temLesao?: boolean | null;
  lesoes?: string | null;
  temDor?: boolean | null;
  dores?: string | null;
  /** JSON: ["ombro-d", "lombar"] — regiões marcadas no boneco. */
  regioesDor?: string | null;

  /** JSON com os itens marcados. Vazio = nenhuma das opções se aplica. */
  parq?: string | null;

  observacoes?: string | null;

  /**
   * Legado: perguntas que saíram quando a ficha foi reescrita. Continuam
   * chegando porque guardam o que os alunos já responderam — a ficha do
   * professor mostra `objetivo`, `nivelAtividade` e `problemasSaude` quando
   * os campos novos estão vazios, para não zerar as fichas antigas de uma vez.
   */
  objetivo?: string | null;
  nivelAtividade?: string | null;
  problemasSaude?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface SalvarAnamnesePayload {
  contatoEmergenciaNome?: string;
  contatoEmergenciaTelefone?: string;
  objetivos?: string[];
  experiencia?: string;
  profissao?: string;
  posturaPredominante?: string;
  movimentosRepetitivos?: boolean;
  movimentosRepetitivosQuais?: string;
  patologias?: string[];
  patologiaOutra?: string;
  usaMedicamento?: boolean;
  medicamentos?: string;
  fezCirurgia?: boolean;
  cirurgiaQual?: string;
  temLesao?: boolean;
  lesoes?: string;
  temDor?: boolean;
  dores?: string;
  regioesDor?: string[];
  parq?: string[];
  observacoes?: string;
}
