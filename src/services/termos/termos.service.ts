import { http } from '../http';
import type { SituacaoDoTermo, Termo } from './termos.types';

export const termosService = {
  /** Termo vigente do estúdio. Rota pública: quem lê ainda não tem conta. */
  async vigente(): Promise<Termo> {
    const { data } = await http.get<Termo>('/termos');
    return data;
  },
};

/** Situação e aceite de quem já está logado (aluno que entrou antes do termo). */
export const meuTermoService = {
  async situacao(): Promise<SituacaoDoTermo> {
    const { data } = await http.get<SituacaoDoTermo>('/termos/meu');
    return data;
  },

  async aceitar(versao: string): Promise<{ versao: string; aceitoEm: string }> {
    const { data } = await http.post<{ versao: string; aceitoEm: string }>('/termos/aceitar', { versao });
    return data;
  },
};
