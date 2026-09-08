/** Um item do achado. `usuarioId` deixa a tela levar direto ao cadastro. */
export type ItemDoAchado = {
  texto: string;
  usuarioId?: string;
  /**
   * Os horários fixos desligados desta linha. Só o achado com `acao` traz, e é
   * o que a tela manda de volta ao devolver — a devolução é do que foi
   * marcado, nunca "de tudo".
   */
  horarioFixoIds?: string[];
};

export type Achado = {
  tipo: string;
  gravidade: 'grave' | 'atencao';
  titulo: string;
  itens: ItemDoAchado[];
  oQueFazer: string;
  /**
   * Quando o próprio sistema consegue desfazer o achado. Os outros dependem
   * de uma decisão da dona (tirar quem da turma cheia?) e não têm botão.
   */
  acao?: 'restaurar-horarios-fixos';
};

/**
 * O que voltou de devolver os horários fixos.
 *
 * `aulasRemarcadas` é o que a dona de fato queria: a combinação de volta é meio
 * caminho, a aula na agenda é o resultado. `recusados` diz, nome por nome, o
 * que não entrou e por quê — turma cheia, plano completo, aluno desligado.
 * Sem essa lista o número menor do que o esperado não teria explicação, e
 * quem apertou o botão ficaria procurando o erro na própria conferência.
 */
export type Restauracao = {
  devolvidos: number;
  aulasRemarcadas: number;
  recusados: { nome: string; motivo: string }[];
  mensagem: string;
};

export type Varredura = {
  rodadaEm: string;
  resumo: {
    fixosAtivos: number;
    turmas: number;
    turmasAtivas: number;
    graves: number;
    atencao: number;
  };
  achados: Achado[];
};

/** Uma turma em que a pessoa realmente treinou — vem dos agendamentos. */
export type TurmaFrequentada = {
  diaSemana: string;
  horaInicio: string;
  modalidade: string;
  aulas: number;
  ultima: string;
};

/**
 * O que sobrou de um cadastro excluído definitivamente.
 *
 * `nome` e `email` vêm do registro de ações e podem faltar (exclusão anterior
 * ao log). `turmas` vem dos agendamentos, que não são apagados — é a parte
 * mais confiável, porque prova onde a pessoa esteve.
 */
export type CadastroRemovido = {
  usuarioId: string;
  nome: string | null;
  email: string | null;
  removidoEm: string | null;
  plano: string | null;
  turmas: TurmaFrequentada[];
  /** Horários fixos que o registro mostra ter sido criados para a pessoa. */
  fixosNoRegistro: string[];
  temAnamnese: boolean;
};

export type RelatorioRemovidos = {
  rodadaEm: string;
  total: number;
  comNome: number;
  removidos: CadastroRemovido[];
  /**
   * Nomes que o registro mostra terem sido cadastrados mas não dá para ligar a
   * um id — cadastros de antes de o registro guardar o id do criado. Servem
   * para cruzar na mão com os excluídos sem nome.
   */
  nomesSemVinculo: { nome: string; email: string | null; quando: string }[];
};
