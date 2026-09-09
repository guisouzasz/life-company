import { PrismaClient } from '@prisma/client';

/**
 * Remonta o que dá para saber de um cadastro que foi EXCLUÍDO definitivamente.
 *
 * A exclusão apaga de verdade: horários fixos, fichas de treino e histórico de
 * carga saem da tabela, e o cadastro é anonimizado (nome vira "Conta
 * removida", CPF vira "REMOVIDO-<id>", e-mail e telefone somem). Não existe
 * "desfazer" — o botão avisa isso antes.
 *
 * Mas nem tudo vai junto. Duas coisas sobrevivem, e é delas que este relatório
 * vive:
 *
 *  1. Os AGENDAMENTOS. Eles ficam como histórico anônimo, presos ao mesmo
 *     usuarioId e apontando para a turma. Então dá para dizer, com certeza,
 *     em que dia e horário aquela pessoa treinava — porque ela esteve lá.
 *
 *  2. O REGISTRO DE AÇÕES. Nome e e-mail estão na lista branca do log, então
 *     o cadastro e as edições anteriores deixaram esses dois campos gravados,
 *     ligados ao id. CPF, RG, telefone e endereço ficaram de fora de
 *     propósito — log não é lugar de dado pessoal — e por isso não voltam.
 *
 * O resultado é uma lista de conferência para recadastrar: quem era, o e-mail,
 * o plano que tinha e em que turmas vinha. É menos do que um backup do banco
 * devolveria, e por isso o relatório diz isso em voz alta: se houver backup,
 * é o backup que se usa.
 *
 * A ficha de anamnese NÃO está entre o que sobrevive — ela é apagada junto com
 * o cadastro, e o boot varre as que ficaram de versões antigas. `temAnamnese`
 * continua no relatório só como alarme: se vier verdadeiro, uma dessas duas
 * coisas falhou.
 */

type ClientePrisma = Pick<PrismaClient, 'usuario' | 'agendamento' | 'logAcao' | 'anamnese' | 'horario'>;

const DIA_LEGIVEL: Record<string, string> = {
  SEGUNDA: 'segunda', TERCA: 'terça', QUARTA: 'quarta', QUINTA: 'quinta', SEXTA: 'sexta',
};

export type TurmaFrequentada = {
  diaSemana: string;
  horaInicio: string;
  modalidade: string;
  /** Quantas aulas a pessoa teve ali. Muitas = era o horário fixo dela. */
  aulas: number;
  /** A última vez que apareceu, para separar o horário atual do antigo. */
  ultima: string;
};

export type CadastroRemovido = {
  usuarioId: string;
  /** Do registro de ações; null quando a exclusão é anterior ao log. */
  nome: string | null;
  email: string | null;
  removidoEm: string | null;
  plano: string | null;
  turmas: TurmaFrequentada[];
  /**
   * Os horários fixos que o registro de ações mostra ter sido criados para
   * esta pessoa — "quarta 19:00". É a prova mais direta que existe: não é
   * inferência a partir das aulas, é a combinação que alguém cadastrou.
   */
  fixosNoRegistro: string[];
  /**
   * Sinal de alarme, não informação: a exclusão apaga a anamnese e o boot
   * varre as que sobraram de versões antigas. Se isto vier `true`, alguma
   * dessas duas coisas não funcionou.
   */
  temAnamnese: boolean;
};

export type RelatorioRemovidos = {
  rodadaEm: string;
  total: number;
  /** Quantos deram para nomear pelo registro de ações. */
  comNome: number;
  removidos: CadastroRemovido[];
  /**
   * Nomes que o registro mostra terem sido cadastrados, mas que não dá para
   * ligar a um id.
   *
   * Vêm de uma época em que `POST /usuarios` não gravava o id do cadastro
   * criado — o log guardava o nome e nada que o amarrasse à pessoa. Já
   * corrigido para os cadastros novos, mas o que passou, passou.
   *
   * Continuam valendo alguma coisa: ao lado da lista de excluídos, dão para
   * cruzar na mão. São N cadastros sem nome e M nomes sem cadastro, e quem
   * conhece o estúdio fecha a conta.
   */
  nomesSemVinculo: { nome: string; email: string | null; quando: string }[];
};

/**
 * Lê um campo do detalhe do log, mesmo quando o JSON está quebrado.
 *
 * Por muito tempo o detalhe foi gravado com o JSON inteiro truncado em 120
 * caracteres, o que produzia coisas como
 * `{"nome":"MARINA COSTA","email":"aluno@estudio.com","planoId":"1d0adf...` —
 * texto que nenhum `JSON.parse` aceita. O gravador já foi corrigido, mas os
 * registros antigos são os que interessam agora: são deles que sai o nome de
 * quem já foi excluído.
 *
 * Daí a segunda tentativa na marra. Ela só é usada quando o parse falha, e só
 * procura o campo pedido — não é um parser, é um resgate.
 */
function lerCampo(detalhe: string, campo: string): string | null {
  try {
    const v = JSON.parse(detalhe)?.[campo];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  } catch {
    const m = new RegExp(`"${campo}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(detalhe);
    return m?.[1]?.trim() || null;
  }
}

/** O primeiro valor não vazio de um campo, entre os detalhes do log. */
function doLog(linhas: { detalhe: string | null }[], campo: string): string | null {
  for (const l of linhas) {
    if (!l.detalhe) continue;
    const v = lerCampo(l.detalhe, campo);
    if (v) return v;
  }
  return null;
}

export async function levantarCadastrosRemovidos(prisma: ClientePrisma): Promise<RelatorioRemovidos> {
  const removidos = await prisma.usuario.findMany({
    where: { cpf: { startsWith: 'REMOVIDO-' } },
    select: {
      id: true,
      usuarioPlanos: {
        where: { vigenciaFim: null },
        include: { plano: { select: { nome: true } } },
      },
    },
  });

  if (removidos.length === 0) {
    return {
      rodadaEm: new Date().toISOString(),
      total: 0, comNome: 0, removidos: [], nomesSemVinculo: [],
    };
  }

  const ids = removidos.map((u) => u.id);

  /**
   * As aulas de cada um, mais recentes primeiro. TODAS, inclusive canceladas.
   *
   * Filtrar as canceladas parecia o certo — aula desmarcada não prova
   * presença — e deixava o relatório vazio justamente no caso que ele existe
   * para atender: a exclusão CANCELA as aulas futuras antes de anonimizar o
   * cadastro, então quem tinha horário fixo fica só com canceladas.
   *
   * E, para a pergunta desta tela, a cancelada prova o que interessa: ela só
   * existe porque o horário fixo da pessoa criou aquela aula naquela turma.
   */
  const aulas = await prisma.agendamento.findMany({
    where: { usuarioId: { in: ids } },
    select: {
      usuarioId: true,
      dataAula: true,
      horario: { select: { diaSemana: true, horaInicio: true, modalidade: { select: { nome: true } } } },
    },
    orderBy: { dataAula: 'desc' },
  });

  const logs = await prisma.logAcao.findMany({
    where: { entidadeId: { in: ids } },
    select: { entidadeId: true, detalhe: true, rota: true, metodo: true, criadoEm: true },
    orderBy: { criadoEm: 'desc' },
  });

  const comAnamnese = new Set(
    (await prisma.anamnese.findMany({ where: { usuarioId: { in: ids } }, select: { usuarioId: true } }))
      .map((a) => a.usuarioId),
  );

  const porUsuario = new Map<string, typeof logs>();
  for (const l of logs) {
    if (!l.entidadeId) continue;
    if (!porUsuario.has(l.entidadeId)) porUsuario.set(l.entidadeId, [] as any);
    porUsuario.get(l.entidadeId)!.push(l);
  }

  /**
   * As turmas que aparecem no registro como horário fixo criado para alguém.
   *
   * `POST /horarios-fixos/<usuarioId>` grava `horarioId` no detalhe, e isso é
   * melhor prova do que as aulas: diz qual combinação foi cadastrada, sem
   * depender de a pessoa ter chegado a treinar.
   */
  const idsDeHorario = new Set<string>();
  for (const l of logs) {
    if (l.metodo !== 'POST' || !l.rota.startsWith('/horarios-fixos') || !l.detalhe) continue;
    const h = lerCampo(l.detalhe, 'horarioId');
    if (h) idsDeHorario.add(h);
  }
  const horarios = idsDeHorario.size
    ? await prisma.horario.findMany({
        where: { id: { in: [...idsDeHorario] } },
        select: { id: true, diaSemana: true, horaInicio: true },
      })
    : [];
  const rotuloDoHorario = new Map(
    horarios.map((h) => [h.id, `${DIA_LEGIVEL[h.diaSemana] ?? h.diaSemana} ${h.horaInicio}`]),
  );

  const lista: CadastroRemovido[] = removidos.map((u) => {
    const meus = porUsuario.get(u.id) ?? [];
    const exclusao = meus.find((l) => l.metodo === 'DELETE');

    const turmas = new Map<string, TurmaFrequentada>();
    for (const a of aulas) {
      if (a.usuarioId !== u.id || !a.horario) continue;
      const chave = `${a.horario.diaSemana}|${a.horario.horaInicio}`;
      const atual = turmas.get(chave);
      if (atual) {
        atual.aulas++;
      } else {
        turmas.set(chave, {
          diaSemana: DIA_LEGIVEL[a.horario.diaSemana] ?? a.horario.diaSemana,
          horaInicio: a.horario.horaInicio,
          modalidade: a.horario.modalidade?.nome ?? '',
          aulas: 1,
          // A lista veio ordenada do mais recente: a primeira é a última vez.
          ultima: a.dataAula.toISOString().slice(0, 10),
        });
      }
    }

    const fixosNoRegistro = [
      ...new Set(
        meus
          .filter((l) => l.metodo === 'POST' && l.rota.startsWith('/horarios-fixos') && l.detalhe)
          .map((l) => {
            const h = lerCampo(l.detalhe!, 'horarioId');
            return h ? rotuloDoHorario.get(h) ?? null : null;
          })
          .filter((x): x is string => !!x),
      ),
    ];

    return {
      usuarioId: u.id,
      nome: doLog(meus, 'nome'),
      email: doLog(meus, 'email'),
      removidoEm: exclusao ? exclusao.criadoEm.toISOString() : null,
      plano: u.usuarioPlanos[0]?.plano?.nome ?? null,
      fixosNoRegistro,
      // Mais aulas primeiro: o horário de verdade da pessoa vem no topo, e um
      // encaixe avulso de uma aula só não se confunde com ele.
      turmas: [...turmas.values()].sort((a, b) => b.aulas - a.aulas),
      temAnamnese: comAnamnese.has(u.id),
    };
  });

  // Quem foi excluído por último aparece primeiro: é o estrago mais fresco, e
  // provavelmente o que se está tentando desfazer agora.
  lista.sort((a, b) => (b.removidoEm ?? '').localeCompare(a.removidoEm ?? ''));

  /**
   * Os cadastros órfãos do registro: `POST /usuarios` sem entidadeId.
   *
   * Só interessam quando algum excluído ficou sem nome — se todos foram
   * nomeados, esta lista seria ruído. Também some quem ainda existe no
   * sistema: se o nome bate com um cadastro vivo, aquele log é dele e não tem
   * nada a ver com os excluídos.
   */
  const semNome = lista.filter((r) => !r.nome).length;
  let nomesSemVinculo: RelatorioRemovidos['nomesSemVinculo'] = [];
  if (semNome > 0) {
    const orfaos = await prisma.logAcao.findMany({
      where: { metodo: 'POST', rota: '/usuarios', entidadeId: null, status: { lt: 300 } },
      select: { detalhe: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
      take: 400,
    });
    /**
     * Fora da lista: quem ainda existe no sistema (o log é dele, não tem nada
     * a ver com os excluídos) e quem já apareceu nomeado num cartão acima —
     * repetir o nome nos dois lugares faria parecer que são duas pessoas.
     */
    const vivos = new Set(
      (await prisma.usuario.findMany({
        where: { NOT: { cpf: { startsWith: 'REMOVIDO-' } } },
        select: { nome: true },
      })).map((u) => u.nome.trim().toLowerCase()),
    );
    for (const r of lista) if (r.nome) vivos.add(r.nome.trim().toLowerCase());
    const vistos = new Set<string>();
    for (const o of orfaos) {
      if (!o.detalhe) continue;
      const nome = lerCampo(o.detalhe, 'nome');
      if (!nome) continue;
      const chave = nome.toLowerCase();
      if (vivos.has(chave) || vistos.has(chave)) continue;
      vistos.add(chave);
      nomesSemVinculo.push({
        nome,
        email: lerCampo(o.detalhe, 'email'),
        quando: o.criadoEm.toISOString(),
      });
    }
  }

  return {
    rodadaEm: new Date().toISOString(),
    total: lista.length,
    comNome: lista.filter((r) => r.nome).length,
    removidos: lista,
    nomesSemVinculo,
  };
}
