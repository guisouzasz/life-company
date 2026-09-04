/** Um item do achado. `usuarioId` deixa a tela levar direto ao cadastro. */
export type ItemDoAchado = {
  texto: string;
  usuarioId?: string;
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
 * O que voltou de devolver os horários fixos. `aulasRemarcadas` é o que a dona
 * de fato queria: a combinação de volta é meio caminho, a aula na agenda é o
 * resultado.
 */
export type Restauracao = {
  devolvidos: number;
  aulasRemarcadas: number;
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
