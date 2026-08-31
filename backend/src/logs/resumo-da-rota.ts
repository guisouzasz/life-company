/**
 * Traduz método + rota para uma frase que a pessoa entende.
 *
 * O log guarda `POST /agendamentos/admin`, mas quem abre a tela quer ler
 * "Colocou aluno na aula". Sem esta tradução o registro só serviria para quem
 * conhece a API por dentro — ou seja, para ninguém que vai realmente usá-lo.
 *
 * Rota desconhecida cai num texto genérico em vez de sumir: é preferível uma
 * linha feia a uma ação invisível.
 */

type Regra = { metodo: string; padrao: RegExp; resumo: string };

/**
 * A ordem importa: a primeira que casar vence. As mais específicas vêm antes
 * das genéricas do mesmo recurso.
 */
const REGRAS: Regra[] = [
  // ── Aulas ────────────────────────────────────────────────────────
  { metodo: 'POST', padrao: /^\/agendamentos\/admin$/, resumo: 'Colocou aluno na aula' },
  { metodo: 'POST', padrao: /^\/agendamentos$/, resumo: 'Marcou aula' },
  { metodo: 'PATCH', padrao: /^\/agendamentos\/[^/]+\/cancelar-admin$/, resumo: 'Tirou aluno da aula (gerou crédito)' },
  { metodo: 'PATCH', padrao: /^\/agendamentos\/[^/]+\/desmarcar$/, resumo: 'Tirou aluno da aula (sem crédito)' },
  { metodo: 'PATCH', padrao: /^\/agendamentos\/[^/]+\/cancelar$/, resumo: 'Cancelou a própria aula' },

  // ── Horário fixo ─────────────────────────────────────────────────
  { metodo: 'POST', padrao: /^\/horarios-fixos\/[^/]+$/, resumo: 'Criou horário fixo do aluno' },
  { metodo: 'DELETE', padrao: /^\/horarios-fixos\/[^/]+$/, resumo: 'Removeu horário fixo do aluno' },

  // ── Turmas da grade ──────────────────────────────────────────────
  { metodo: 'POST', padrao: /^\/horarios$/, resumo: 'Criou turma na grade' },
  { metodo: 'PATCH', padrao: /^\/horarios\/[^/]+$/, resumo: 'Editou turma da grade' },
  { metodo: 'DELETE', padrao: /^\/horarios\/[^/]+$/, resumo: 'Desativou turma da grade' },

  // ── Alunos e equipe ──────────────────────────────────────────────
  { metodo: 'PUT', padrao: /^\/usuarios\/[^/]+\/plano$/, resumo: 'Trocou o plano do aluno' },
  { metodo: 'POST', padrao: /^\/usuarios\/[^/]+\/senha-professor$/, resumo: 'Definiu senha de professor' },
  { metodo: 'POST', padrao: /^\/usuarios$/, resumo: 'Cadastrou pessoa' },
  { metodo: 'PATCH', padrao: /^\/usuarios\/[^/]+$/, resumo: 'Editou cadastro' },
  { metodo: 'DELETE', padrao: /^\/usuarios\/[^/]+$/, resumo: 'Desativou cadastro' },

  // ── Créditos ─────────────────────────────────────────────────────
  { metodo: 'POST', padrao: /^\/creditos/, resumo: 'Concedeu crédito de reposição' },
  { metodo: 'PATCH', padrao: /^\/creditos\/[^/]+\/revogar$/, resumo: 'Revogou crédito de reposição' },
  { metodo: 'DELETE', padrao: /^\/creditos\/[^/]+$/, resumo: 'Removeu crédito de reposição' },

  // ── Dinheiro ─────────────────────────────────────────────────────
  { metodo: 'POST', padrao: /^\/financeiro\/pagamentos/, resumo: 'Marcou mensalidade como paga' },
  { metodo: 'DELETE', padrao: /^\/financeiro\/pagamentos\/[^/]+$/, resumo: 'Desfez a baixa da mensalidade' },
  { metodo: 'PATCH', padrao: /^\/financeiro/, resumo: 'Mexeu no financeiro' },
  { metodo: 'PUT', padrao: /^\/financeiro/, resumo: 'Mexeu no financeiro' },

  // ── Treinos ──────────────────────────────────────────────────────
  { metodo: 'POST', padrao: /^\/treinos\/dia/, resumo: 'Salvou o treino do dia' },
  { metodo: 'POST', padrao: /^\/treinos$/, resumo: 'Montou treino de aluno' },
  { metodo: 'PATCH', padrao: /^\/treinos\/[^/]+$/, resumo: 'Editou treino de aluno' },
  { metodo: 'DELETE', padrao: /^\/treinos\/[^/]+$/, resumo: 'Removeu treino de aluno' },
  { metodo: 'POST', padrao: /^\/cargas/, resumo: 'Registrou carga de exercício' },

  // ── Presença ─────────────────────────────────────────────────────
  { metodo: 'POST', padrao: /^\/presencas/, resumo: 'Marcou presença/falta' },

  // ── Acesso ───────────────────────────────────────────────────────
  { metodo: 'POST', padrao: /^\/auth\/primeiro-acesso/, resumo: 'Gerou link de primeiro acesso' },
  { metodo: 'POST', padrao: /^\/auth\/login$/, resumo: 'Entrou no sistema' },
  { metodo: 'POST', padrao: /^\/modalidades$/, resumo: 'Criou modalidade' },
  { metodo: 'POST', padrao: /^\/planos$/, resumo: 'Criou plano' },
];

const VERBO: Record<string, string> = {
  POST: 'Criou',
  PATCH: 'Alterou',
  PUT: 'Alterou',
  DELETE: 'Removeu',
};

export function resumoDaRota(metodo: string, rota: string): string {
  const limpa = rota.split('?')[0].replace(/\/+$/, '') || '/';
  const regra = REGRAS.find((r) => r.metodo === metodo && r.padrao.test(limpa));
  if (regra) return regra.resumo;

  // Genérico: "Alterou em horarios". Feio, mas visível — e serve de aviso de
  // que apareceu rota nova sem tradução.
  const recurso = limpa.split('/').filter(Boolean)[0] ?? 'sistema';
  return `${VERBO[metodo] ?? 'Mexeu'} em ${recurso}`;
}

/**
 * O id do registro afetado, quando a rota carrega um.
 *
 * Pega o primeiro trecho que pareça um UUID — é assim que todas as rotas do
 * projeto identificam registro.
 */
export function idDaRota(rota: string): string | null {
  const m = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(rota);
  return m ? m[0] : null;
}
