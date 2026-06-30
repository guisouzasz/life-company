export interface AlunoPlanoInfo {
  plano?: { nome: string; aulasSemanais: number } | null;
  modalidade?: { nome: string } | null;
}

export interface AlunoAdmin {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  telefone?: string | null;
  ativo: boolean;
  usuarioPlanos: AlunoPlanoInfo[];
}

export interface CriarAlunoPayload {
  nome: string;
  cpf: string;
  email: string;
  telefone?: string;
  planoId: string;
  modalidadeId: string;
}

export interface CriarAlunoResposta {
  usuario: AlunoAdmin;
  linkAcesso: string;
}

/** PUT /usuarios/:id — backend atualiza nome, email e telefone. */
export interface AtualizarAlunoPayload {
  nome?: string;
  email?: string;
  telefone?: string;
}

export interface GerarLinkResposta {
  link: string;
  token: string;
}
