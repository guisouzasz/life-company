import type { TipoUsuario } from '../../store/auth';

export interface LoginPayload {
  email: string;
  senha: string;
}

/**
 * A ficha que o aluno preenche ao ativar a conta.
 *
 * O cadastro feito pela dona pede só nome e CPF — ela cadastra no balcão e
 * não tem RG nem CEP à mão. Estes campos são exigidos pela API quando quem
 * ativa é ALUNO; professor e admin usam a mesma rota e não têm ficha.
 */
export interface FichaDoPrimeiroAcesso {
  email?: string;
  telefone?: string;
  rg?: string;
  endereco?: string;
  cep?: string;
  /** YYYY-MM-DD */
  dataNascimento?: string;
}

export interface PrimeiroAcessoPayload extends FichaDoPrimeiroAcesso {
  token: string;
  cpf: string;
  senha: string;
  /**
   * Versão do termo aceito. A API recusa a ativação de ALUNO sem ela — o
   * aceite é condição para concluir o primeiro acesso, não só um visto na
   * tela. Professor e admin ativam pela mesma rota e não assinam o termo.
   */
  termoVersao?: string;
}

/** POST /auth/ativar-conta — ativação sem link, pelo CPF. */
export interface AtivarContaPayload extends FichaDoPrimeiroAcesso {
  cpf: string;
  senha: string;
  /** Idem: obrigatória para ALUNO. */
  termoVersao?: string;
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
  nome?: string;
  email: string;
  cpf?: string;
  telefone?: string | null;
  tipo: TipoUsuario;
  /** Dono do sistema: ADMIN que também vê o registro de ações. */
  dono?: boolean;
  /** Modalidade do professor (null para admin/aluno). */
  modalidadeProfessor?: { id: string; nome: string } | null;
}
