/** Dia em que a academia não abre (feriado, recesso). `data` em YYYY-MM-DD. */
export interface DiaFechado {
  id: string;
  data: string;
  motivo: string;
  /** Recesso de fim de ano: quem tinha aula ganhou crédito extra (Termo, seção 4). */
  recesso?: boolean;
}

export interface ResultadoFechamento extends DiaFechado {
  aulasRetiradas: number;
  creditosDevolvidos: number;
  creditosExtras?: number;
  creditosRetirados?: number;
  mensagem: string;
}
