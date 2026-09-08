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
  /**
   * Já fez o primeiro acesso (tem senha). Diferente de `ativo`: cadastro novo
   * nasce inativo e só liga quando o aluno abre o app pela primeira vez.
   */
  ativado?: boolean;
  // Ficha cadastral preenchida pelo admin. Vem null nos cadastros feitos
  // antes destes campos existirem.
  rg?: string | null;
  endereco?: string | null;
  cep?: string | null; // 8 dígitos, sem hífen
  dataNascimento?: string | null; // ISO
  usuarioPlanos: AlunoPlanoInfo[];
}

export interface CriarAlunoPayload {
  nome: string;
  cpf: string;
  email?: string; // obrigatório para ALUNO; PROFESSOR ativa pelo CPF
  telefone?: string;
  /** Ficha cadastral: obrigatória para ALUNO, dispensada para PROFESSOR. */
  rg?: string;
  endereco?: string;
  cep?: string;
  dataNascimento?: string; // YYYY-MM-DD
  /** ALUNO (default) ou PROFESSOR (sem plano). */
  tipoUsuario?: 'ALUNO' | 'PROFESSOR';
  /** Mensalidade combinada com o aluno (opcional; editável depois no Financeiro). */
  valorMensalidade?: number;
  /** Dia do vencimento, 1 a 28. */
  diaVencimento?: number;
  planoId?: string; // obrigatório para ALUNO
  modalidadeId?: string; // obrigatório para ALUNO
}

export interface CriarAlunoResposta {
  usuario: AlunoAdmin;
  linkAcesso: string;
}

/**
 * PUT /usuarios/:id — só os campos enviados são alterados, então dá para
 * corrigir um dado isolado sem apagar o resto do cadastro.
 */
export interface AtualizarAlunoPayload {
  nome?: string;
  cpf?: string;
  /** String vazia limpa o e-mail (o aluno cadastra o dele na ativação). */
  email?: string;
  telefone?: string;
  rg?: string;
  endereco?: string;
  cep?: string;
  dataNascimento?: string; // YYYY-MM-DD
  /** Reativar/desativar o cadastro. */
  ativo?: boolean;
  /**
   * Modalidade — só tem efeito em PROFESSOR, onde corrige a que ele leciona.
   * No aluno a modalidade pertence ao plano, e quem troca é `atualizarPlano`.
   */
  modalidadeId?: string;
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

/**
 * Professor só com o que serve para escolhê-lo numa lista
 * (GET /usuarios/professores/nomes).
 *
 * Separado de `ProfessorAdmin` porque aquele carrega CPF, e-mail e telefone —
 * dado de cadastro, que a equipe não precisa ver para vincular um professor a
 * uma ficha de treino.
 */
export interface NomeDeProfessor {
  id: string;
  nome: string;
  modalidadeProfessor?: { id: string; nome: string } | null;
}

/**
 * Professor do estúdio (GET /usuarios/professores).
 *
 * `ativado` = já tem senha, ou seja, passou pelo primeiro acesso (ou a dona
 * definiu a senha pelo painel). É diferente de `ativo`, que é o cadastro
 * ligado/desligado — um professor afastado fica ativado e inativo.
 */
export interface ProfessorAdmin {
  id: string;
  nome: string;
  cpf: string;
  email?: string | null;
  telefone?: string | null;
  ativo: boolean;
  ativado: boolean;
  createdAt: string;
  modalidadeProfessor?: { id: string; nome: string } | null;
}
