/** Dia em que a academia não abre (feriado, recesso). `data` em YYYY-MM-DD. */
export interface DiaFechado {
  id: string;
  data: string;
  motivo: string;
}

export interface ResultadoFechamento extends DiaFechado {
  aulasRetiradas: number;
  creditosDevolvidos: number;
  mensagem: string;
}
