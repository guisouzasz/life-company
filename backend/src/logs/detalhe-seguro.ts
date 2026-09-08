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

/** Até onde o detalhe pode crescer. Log é índice, não arquivo. */
const LIMITE_DETALHE = 400;

/** Trunca um VALOR longo. O objeto inteiro nunca é cortado — veja abaixo. */
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

  /**
   * Cabe no limite tirando CAMPOS, nunca cortando o texto no meio.
   *
   * Antes era `encurtar(JSON.stringify(limpo))`, e o corte caía onde caísse:
   * `{"nome":"MARINA COSTA","email":"aluno@estudio.com","planoId":"1d0adf...`
   * sem fechar a chave. Ficava aceitável na tela de logs, que só mostra o
   * texto, e ilegível para qualquer coisa que tentasse LER o registro — que é
   * justamente o que se quer fazer quando algo deu errado e se está
   * reconstruindo o que aconteceu.
   *
   * Os campos saem do fim para o começo: a ordem do corpo põe o que
   * identifica (nome, e-mail) antes da configuração, e é o que identifica que
   * tem valor num registro.
   */
  const restantes = { ...limpo };
  let json = JSON.stringify(restantes);
  for (const chave of [...chaves].reverse()) {
    if (json.length <= LIMITE_DETALHE) break;
    delete restantes[chave];
    json = JSON.stringify(restantes);
  }
  return Object.keys(restantes).length === 0 ? null : json;
}
