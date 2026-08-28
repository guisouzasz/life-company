export interface SecaoDoTermo {
  titulo: string;
  /** Parágrafo de abertura da seção, quando ela tem um. */
  texto?: string;
  itens: string[];
}

/**
 * O termo vem da API, não de uma cópia dentro do app: o que o aluno lê e a
 * versão que fica gravada no aceite precisam ser sempre o mesmo texto.
 */
export interface Termo {
  versao: string;
  titulo: string;
  abertura: string;
  secoes: SecaoDoTermo[];
  declaracao: string;
}
