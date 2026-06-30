import { http } from '../http';

export interface Plano {
  id: string;
  nome: string;
  aulasSemanais: number;
}

export const planosService = {
  async listar(): Promise<Plano[]> {
    const { data } = await http.get<Plano[]>('/planos');
    return data;
  },
};
