import { http } from '../http';
import type {
  AuthResponse,
  LoginPayload,
  PrimeiroAcessoPayload,
  UsuarioLogado,
} from './auth.types';

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  async primeiroAcesso(payload: PrimeiroAcessoPayload): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/primeiro-acesso', payload);
    return data;
  },

  async me(): Promise<UsuarioLogado> {
    const { data } = await http.get<UsuarioLogado>('/auth/me');
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await http.post('/auth/logout', { refreshToken });
  },
};
