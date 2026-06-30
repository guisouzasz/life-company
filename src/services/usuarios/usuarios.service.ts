import { http } from '../http';
import type { SaldoSemanal } from './usuarios.types';

export const usuariosService = {
  async saldo(): Promise<SaldoSemanal> {
    const { data } = await http.get<SaldoSemanal>('/usuarios/me/saldo');
    return data;
  },
};
