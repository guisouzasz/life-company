import { http } from '../http';
import type { ArquivoPdf, LinhaPdf, SalvarTreinoDiaPayload, SalvarTreinoPayload, Treino, TreinoDia, ResumoAluno } from './treinos.types';

export const treinosService = {
  /** Treinos do aluno logado. */
  async meus(): Promise<Treino[]> {
    const { data } = await http.get<Treino[]>('/treinos/meus');
    return data;
  },

  // ── Treino do dia (Funcional) ──────────────────────────────────────
  /** Treinos do dia de hoje das aulas do aluno logado. */
  async diaMeu(): Promise<TreinoDia[]> {
    const { data } = await http.get<TreinoDia[]>('/treinos/dia/meu');
    return data;
  },

  async diaVer(dataDia: string): Promise<TreinoDia | null> {
    const { data } = await http.get<TreinoDia | null>('/treinos/dia', { params: { data: dataDia } });
    return data;
  },

  async diaSalvar(payload: SalvarTreinoDiaPayload): Promise<TreinoDia> {
    const { data } = await http.put<TreinoDia>('/treinos/dia', payload);
    return data;
  },

  async diaRemover(id: string): Promise<{ mensagem: string }> {
    const { data } = await http.delete<{ mensagem: string }>(`/treinos/dia/${id}`);
    return data;
  },

  // ── Professor/Admin ────────────────────────────────────────────────
  /** Situação das fichas de cada aluno e a próxima aula dele. */
  async resumo(): Promise<ResumoAluno[]> {
    const { data } = await http.get<ResumoAluno[]>('/treinos/resumo');
    return data;
  },

  async doAluno(alunoId: string): Promise<Treino[]> {
    const { data } = await http.get<Treino[]>(`/treinos/aluno/${alunoId}`);
    return data;
  },

  async criar(payload: SalvarTreinoPayload): Promise<Treino> {
    const { data } = await http.post<Treino>('/treinos', payload);
    return data;
  },

  async atualizar(id: string, payload: SalvarTreinoPayload): Promise<Treino> {
    const { data } = await http.put<Treino>(`/treinos/${id}`, payload);
    return data;
  },

  async remover(id: string): Promise<{ mensagem: string }> {
    const { data } = await http.delete<{ mensagem: string }>(`/treinos/${id}`);
    return data;
  },

  /** A ordem das fichas do aluno (ids na ordem nova). */
  /** Texto de uma ficha em PDF, linha por linha. Não grava nada. */
  async lerPdf(arquivo: ArquivoPdf): Promise<{ paginas: number; linhas: LinhaPdf[] }> {
    const form = new FormData();
    if (arquivo.file) form.append('arquivo', arquivo.file, arquivo.name);
    // No app (iOS/Android) o FormData aceita o arquivo pelo caminho.
    else form.append('arquivo', { uri: arquivo.uri, name: arquivo.name, type: arquivo.mimeType ?? 'application/pdf' } as unknown as Blob);
    const { data } = await http.post<{ paginas: number; linhas: LinhaPdf[] }>('/treinos/ler-pdf', form, {
      // Sem isto o padrão JSON do cliente transformaria o arquivo em texto;
      // o navegador completa o cabeçalho com a fronteira do multipart.
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return data;
  },

  async ordenar(alunoId: string, ids: string[]): Promise<{ mensagem: string }> {
    const { data } = await http.put<{ mensagem: string }>('/treinos/ordem', { alunoId, ids });
    return data;
  },

  /** Concluir (arquivar) ou reativar a ficha. */
  async definirStatus(id: string, concluido: boolean): Promise<Treino> {
    const { data } = await http.patch<Treino>(`/treinos/${id}/status`, { concluido });
    return data;
  },
};
