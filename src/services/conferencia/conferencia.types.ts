/**
 * A conferência diária dos horários fixos (roda às 08:00 no servidor).
 * Espelha backend/src/conferencia/conferir-horarios-fixos.ts.
 */
export interface ItemDaConferencia {
  texto: string;
  usuarioId?: string;
  nome?: string;
}

export interface PontoDaConferencia {
  tipo: string;
  /** `revisar` acende o alerta; `aviso` só aparece na lista. */
  nivel: 'revisar' | 'aviso';
  titulo: string;
  oQueFazer: string;
  itens: ItemDaConferencia[];
}

export interface Conferencia {
  id: string;
  /** Meia-noite do dia da conferência (ISO). */
  data: string;
  rodadaEm: string;
  pendencias: number;
  revisadaEm: string | null;
  revisadaPor: string | null;
  resultado: {
    de: string;
    ate: string;
    pendencias: number;
    avisos: number;
    pontos: PontoDaConferencia[];
  };
}
