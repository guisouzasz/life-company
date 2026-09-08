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
