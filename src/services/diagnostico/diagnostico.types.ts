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
