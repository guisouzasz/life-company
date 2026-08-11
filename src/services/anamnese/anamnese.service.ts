import { http } from '../http';
import type { Anamnese, SalvarAnamnesePayload } from './anamnese.types';

export const anamneseService = {
  /** Ficha do aluno logado (null quando ainda não preencheu). */
  async minha(): Promise<Anamnese | null> {
    const { data } = await http.get<Anamnese | null>('/anamnese/me');
    return data;
  },

  async salvar(payload: SalvarAnamnesePayload): Promise<Anamnese> {
    const { data } = await http.put<Anamnese>('/anamnese/me', payload);
    return data;
  },

  /** Ficha de um aluno (professor da modalidade / admin). */
  async doAluno(alunoId: string): Promise<Anamnese | null> {
    const { data } = await http.get<Anamnese | null>(`/anamnese/aluno/${alunoId}`);
    return data;
  },
};
