import type { TipoUsuario } from '../../store/auth';

export interface LoginPayload {
  email: string;
  senha: string;
}

export interface PrimeiroAcessoPayload {
  token: string;
  cpf: string;
  senha: string;
}

/** Resposta de /auth/login e /auth/primeiro-acesso. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tipoUsuario: TipoUsuario;
  usuarioId: string;
  nome: string;
}

/** Resposta de GET /auth/me (payload do JWT). */
export interface UsuarioLogado {
  sub: string;
  tipo: TipoUsuario;
}
