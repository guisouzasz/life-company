/**
 * O que do corpo da requisição pode ir para o log.
 *
 * A regra é LISTA BRANCA, não lista negra. Com lista negra, todo campo novo
 * que alguém adicionasse a um formulário entraria no log por padrão — e um
 * dia entraria algo que não devia. Aqui o padrão é não gravar; para um campo
 * aparecer no registro, alguém precisa escrevê-lo nesta lista de propósito.
 *
 * Fora daqui ficam, sem exceção:
 *  - senha, token, hash — óbvio;
 *  - anamnese (lesões, remédios, condições de saúde) e conteúdo de treino:
 *    são dados de saúde do aluno. O log existe para dizer QUE a dona mexeu na
 *    ficha, não para guardar uma segunda cópia do que estava escrito nela;
 *  - CPF, RG, endereço, telefone: identificam a pessoa sem acrescentar nada
 *    ao "o que foi feito". O id do registro já liga o log ao cadastro.
 */
const CAMPOS_PERMITIDOS = new Set([
  // quem/onde/quando da ação
  'usuarioId',
  'alunoId',
  'horarioId',
  'planoId',
  'modalidadeId',
  'professorId',
  'agendamentoId',
  'dataAula',
  'dataInicio',
  'dataFim',
  'diaSemana',
  'horaInicio',
  'horaFim',
  'substituirAgendamentoId',
  // estado / configuração
  'ativo',
  'capacidadeMaxima',
  'aulasSemanais',
  'tipoUsuario',
  'diaVencimento',
  'compareceu',
  'usarCredito',
  'confirmarMudancaDeHorario',
  // dinheiro: o valor é o ponto da ação, e não é dado sensível de saúde
  'valor',
  'valorMensalidade',
  'mes',
  'ano',
  'formaPagamento',
  // identificação leve, para o log ser legível sem abrir outra tela
  'nome',
  'titulo',
  'email',
  'motivo',
]);

/** Trunca texto longo: log é índice, não arquivo. */
function encurtar(v: string): string {
  return v.length > 120 ? `${v.slice(0, 117)}...` : v;
}

/**
 * Devolve o JSON dos campos permitidos, ou null quando não sobrou nada.
 *
 * Só o primeiro nível do objeto é olhado. Objetos aninhados (o corpo de uma
 * anamnese, a lista de exercícios de um treino) são descartados inteiros —
 * é exatamente o que se quer.
 */
export function detalheSeguro(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return null;

  const limpo: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(corpo as Record<string, unknown>)) {
    if (!CAMPOS_PERMITIDOS.has(chave)) continue;
    if (valor === null || valor === undefined) continue;
    if (typeof valor === 'string') limpo[chave] = encurtar(valor);
    else if (typeof valor === 'number' || typeof valor === 'boolean') limpo[chave] = valor;
    // objeto/array dentro de um campo permitido também não entra
  }

  const chaves = Object.keys(limpo);
  if (chaves.length === 0) return null;
  return encurtar(JSON.stringify(limpo));
}
