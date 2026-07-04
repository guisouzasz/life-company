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

/** POST /auth/ativar-conta — ativação sem link, com CPF + e-mail. */
export interface AtivarContaPayload {
  cpf: string;
  email: string;
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

/** Resposta de GET /auth/me. */
export interface UsuarioLogado {
  id: string;
  email: string;
  tipo: TipoUsuario;
}
