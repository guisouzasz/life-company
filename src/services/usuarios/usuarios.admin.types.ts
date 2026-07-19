export interface AlunoPlanoInfo {
  plano?: { id: string; nome: string; aulasSemanais: number } | null;
  modalidade?: { id: string; nome: string } | null;
}

export interface AlunoAdmin {
  id: string;
  nome: string;
  email?: string | null; // null até o aluno ativar a conta e cadastrar o e-mail
  cpf: string;
  telefone?: string | null;
  ativo: boolean;
  usuarioPlanos: AlunoPlanoInfo[];
}

export interface CriarAlunoPayload {
  nome: string;
  cpf: string;
  email?: string; // opcional: o aluno cadastra o próprio e-mail na ativação
  telefone?: string;
  /** ALUNO (default) ou PROFESSOR (sem plano). */
  tipoUsuario?: 'ALUNO' | 'PROFESSOR';
  planoId?: string; // obrigatório para ALUNO
  modalidadeId?: string; // obrigatório para ALUNO
}

export interface CriarAlunoResposta {
  usuario: AlunoAdmin;
  linkAcesso: string;
}

/** PUT /usuarios/:id — backend atualiza nome, email e telefone. */
export interface AtualizarAlunoPayload {
  nome?: string;
  cpf?: string;
  /** String vazia limpa o e-mail (o aluno cadastra o dele na ativação). */
  email?: string;
  telefone?: string;
  /** Reativar/desativar o cadastro. */
  ativo?: boolean;
}

/** PUT /usuarios/:id/plano — encerra o plano ativo e cria um novo. */
export interface AtualizarPlanoPayload {
  planoId: string;
  modalidadeId: string;
}

export interface GerarLinkResposta {
  link: string;
  token: string;
}
