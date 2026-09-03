import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { PrismaService } from '../prisma/prisma.service';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { CriarAgendamentoAdminDto } from './dto/criar-agendamento-admin.dto';
import {
  DIAS_PERIODO_REPOSICOES,
  DIAS_VALIDADE_CREDITO,
  MAX_REPOSICOES_POR_PERIODO,
} from '../creditos/creditos.constantes';
import { capacidadeEfetiva } from '../horarios/capacidade';

(dayjs as any).extend((isoWeek as any).default || isoWeek);

const DIA_MAP: Record<number, string> = { 1: 'SEGUNDA', 2: 'TERCA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA' };

/**
 * Até quando o ALUNO pode marcar, em dias.
 *
 * A tela dele oferece as próximas duas semanas, mas a rota aceitava qualquer
 * data futura: dava para marcar meses à frente e sentar em cima da vaga de
 * turmas que nem foram montadas ainda. O estúdio não tem esse limite — a dona
 * remaneja para onde precisar.
 */
const DIAS_MAXIMOS_ANTECEDENCIA = 60;

/** "da", "de", "dos"... continuam minúsculas ao formatar o nome. */
const CONECTIVOS = new Set(['da', 'de', 'di', 'do', 'das', 'des', 'dos', 'e']);

/**
 * Como o sistema chama o aluno nas mensagens: primeiro nome + último
 * sobrenome. "CARLOS EDUARDO RAVAGLIO DA ROCHA" → "Carlos Rocha".
 *
 * Só o primeiro nome não serve. O estúdio tem três Carlos, e o aviso "Carlos
 * já tem 1 aula nesta semana" fez a dona achar que o sistema tinha misturado
 * os cadastros — ela leu como se estivesse falando de OUTRO Carlos. É como
 * ela chama cada um ("o Carlos Rocha"), então é como o sistema deve falar.
 */
function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const capitaliza = (p: string) =>
    CONECTIVOS.has(p.toLowerCase()) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  if (partes.length === 0) return nome;
  const primeiro = capitaliza(partes[0]);
  // Último token que não seja conectivo ("... DA ROCHA" → "Rocha").
  const sobrenome = [...partes].reverse().find((x) => !CONECTIVOS.has(x.toLowerCase()));
  if (partes.length === 1 || !sobrenome || sobrenome === partes[0]) return primeiro;
  return `${primeiro} ${capitaliza(sobrenome)}`;
}

@Injectable()
export class AgendamentosService {
  constructor(private prisma: PrismaService) {}

  async criar(usuarioId: string, dto: CriarAgendamentoDto) {
    return this.agendar(usuarioId, dto, { admin: false });
  }

  /**
   * O estúdio coloca o aluno direto na aula.
   *
   * O caminho normal para fixar alguém numa turma é o horário fixo, que gera
   * as aulas sozinho. Quando essa geração não consegue — turma cheia, semana
   * do plano já ocupada, aula sobrando de um fixo antigo — a dona ficava sem
   * saída: o fixo aparecia salvo e o aluno não estava na turma, e não havia
   * nenhuma tela onde ela pudesse simplesmente colocá-lo lá.
   */
  async criarComoAdmin(dto: CriarAgendamentoAdminDto) {
    const aluno = await this.prisma.usuario.findUnique({
      where: { id: dto.usuarioId },
      select: { id: true, nome: true, ativo: true, senhaHash: true, tipoUsuario: true },
    });
    if (!aluno || aluno.tipoUsuario !== 'ALUNO') throw new NotFoundException('Aluno não encontrado');

    /**
     * Cadastro novo nasce `ativo=false` até o primeiro acesso, mas ainda pode
     * receber horário fixo e aula pelo estúdio. Diferente disso é o aluno que
     * já criou senha e depois foi desligado: esse não deve voltar para a agenda
     * por engano, porque o desligamento remove as turmas e libera as vagas.
     */
    if (!aluno.ativo && aluno.senhaHash) {
      throw new BadRequestException(
        `${nomeCurto(aluno.nome)} está inativo/desligado. Reative o cadastro antes de marcar aula.`,
      );
    }

    return this.agendar(dto.usuarioId, dto, {
      admin: true,
      nome: nomeCurto(aluno.nome),
      substituirAgendamentoId: dto.substituirAgendamentoId,
    });
  }

  /**
   * Marca a aula. `ctx.admin` só muda de quem é a voz das mensagens e o que o
   * estúdio pode fazer a mais (entrar numa aula do dia que já começou, e
   * trocar uma aula da semana por outra) — lotação e plano valem para os dois.
   */
  private async agendar(
    usuarioId: string,
    dto: CriarAgendamentoDto,
    ctx: { admin: boolean; nome?: string; substituirAgendamentoId?: string },
  ) {
    const quem = ctx.admin ? (ctx.nome ?? 'O aluno') : 'Você';
    const dataAula = dayjs(dto.dataAula).startOf('day').toDate();
    const dow = dayjs(dto.dataAula).isoWeekday();
    if (dow > 5) throw new BadRequestException('Apenas de segunda a sexta');

    const horario = await this.prisma.horario.findUnique({ where: { id: dto.horarioId }, include: { modalidade: true } });
    if (!horario || !horario.ativo) throw new NotFoundException('Horário não encontrado ou inativo');

    const diaSemana = DIA_MAP[dow];
    if (diaSemana !== horario.diaSemana) throw new BadRequestException('Data incompatível com o dia do horário');

    /**
     * Aula que já começou não se marca.
     *
     * Faltava esta checagem: só o dia da semana era conferido, nunca a hora.
     * Dava para marcar a aula das 7h às 9h da manhã, a aula de ontem e até a
     * da semana passada — e cada uma dessas consumia uma aula da cota semanal
     * do aluno, por uma aula que ele não teve. Ele descobriria só ao tentar
     * marcar a próxima e ouvir que o limite acabou.
     *
     * Para o estúdio a régua é o dia, não a hora: quem aparece na recepção com
     * a aula já rolando ainda precisa entrar na lista de quem está lá. Dia
     * passado continua barrado para os dois — aquilo só distorceria a cota.
     */
    const [hora, minuto] = horario.horaInicio.split(':').map(Number);
    const inicioAula = dayjs(dto.dataAula).startOf('day').hour(hora).minute(minuto);
    if (ctx.admin) {
      if (dayjs(dataAula).isBefore(dayjs().startOf('day'))) {
        throw new BadRequestException('Esta aula já passou. Só dá para marcar de hoje em diante.');
      }
    } else {
      if (!inicioAula.isAfter(dayjs())) {
        throw new BadRequestException(
          'Esta aula já começou. Escolha um horário que ainda vai acontecer.',
        );
      }
      const limite = dayjs().startOf('day').add(DIAS_MAXIMOS_ANTECEDENCIA, 'day');
      if (dayjs(dataAula).isAfter(limite)) {
        throw new BadRequestException(
          `Só dá para marcar com até ${DIAS_MAXIMOS_ANTECEDENCIA} dias de antecedência.`,
        );
      }
    }

    // Plano dá N aulas/semana para QUALQUER modalidade (não trava por categoria)
    const usuarioPlano = await this.prisma.usuarioPlano.findFirst({ where: { usuarioId, vigenciaFim: null }, include: { plano: true } });
    if (!usuarioPlano) {
      throw new ForbiddenException(
        ctx.admin ? `${quem} não tem plano ativo. Defina o plano no cadastro antes de marcar aula.` : 'Você não possui um plano ativo',
      );
    }

    const inicioSemanaAula = dayjs(dto.dataAula).startOf('isoWeek').toDate();
    const fimSemanaAula = dayjs(dto.dataAula).endOf('isoWeek').toDate();
    const inicioSemanaAtual = dayjs().startOf('isoWeek').toDate();
    const aulaNaSemanaAtual = dayjs(dto.dataAula).startOf('isoWeek').isSame(dayjs(inicioSemanaAtual));

    /**
     * Daqui para baixo tudo decide "ainda cabe esta aula?" — contar e só então
     * inserir. Fora de uma transação com trava, duas requisições quase
     * simultâneas (dois toques no botão, o app repetindo o envio, ou o
     * auto-agendamento rodando junto) leem a MESMA contagem e ambas inserem:
     * era assim que um aluno de plano 1x conseguia marcar mais de uma aula na
     * semana. As travas ficam sempre na mesma ordem — horário e depois plano —
     * para dois alunos marcando ao mesmo tempo não travarem um ao outro.
     */
    return this.prisma.$transaction(async (tx) => {
      // Trava a aula (protege a lotação) e o plano do aluno (protege a cota).
      await tx.$queryRaw`SELECT id FROM horarios WHERE id = ${dto.horarioId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM usuario_planos WHERE id = ${usuarioPlano.id} FOR UPDATE`;

      /**
       * Validações comuns aos dois fluxos (vaga/duplicidade).
       *
       * Procura QUALQUER agendamento do aluno nesta aula, não só o confirmado:
       * o banco tem índice único em (usuário, horário, data) e o cancelado
       * continua ocupando essa chave. Enquanto isto olhava só o CONFIRMADO, o
       * aluno que cancelasse e mudasse de ideia levava erro 500 ao tentar
       * marcar de novo a MESMA aula — o insert esbarrava no índice. Agora a
       * linha cancelada é reaproveitada.
       */
      const anterior = await tx.agendamento.findFirst({ where: { usuarioId, horarioId: dto.horarioId, dataAula } });
      if (anterior?.status === 'CONFIRMADO') {
        throw new ConflictException(ctx.admin ? `${quem} já está nesta aula.` : 'Você já possui agendamento neste horário');
      }

      /**
       * Remanejamento: a aula que sai, para esta entrar.
       *
       * Sai sem crédito de propósito — o aluno não perdeu aula nenhuma, ele
       * mudou de turma. Só aceita aula da MESMA semana, que é a única que
       * libera cota para a aula nova; trocar por uma de outra semana daria a
       * impressão de ter resolvido sem ter liberado nada.
       */
      if (ctx.substituirAgendamentoId) {
        const sai = await tx.agendamento.findUnique({ where: { id: ctx.substituirAgendamentoId } });
        if (!sai || sai.usuarioId !== usuarioId) throw new NotFoundException('A aula que sairia não é deste aluno');
        if (sai.status !== 'CONFIRMADO') throw new BadRequestException('A aula que sairia já não está marcada');
        if (!dayjs(sai.dataAula).startOf('isoWeek').isSame(dayjs(dataAula).startOf('isoWeek'))) {
          throw new BadRequestException('Só dá para trocar por uma aula da mesma semana');
        }
        if (sai.id === anterior?.id) throw new BadRequestException('Essa é a própria aula que você está marcando');
        await tx.agendamento.update({ where: { id: sai.id }, data: { status: 'CANCELADO' } });
      }

      /**
       * Quantos cabem: o menor entre a capacidade gravada no horário e o teto
       * da modalidade. Sem o teto aqui, as turmas criadas antes desta regra —
       * Pilates salvo com 4, por exemplo — continuariam aceitando gente a
       * mais, porque a checagem olhava só o número do banco.
       */
      const cabem = capacidadeEfetiva(horario.capacidadeMaxima, horario.modalidade?.nome);
      const ocupacao = await tx.agendamento.count({ where: { horarioId: dto.horarioId, dataAula, status: 'CONFIRMADO' } });
      if (ocupacao >= cabem) {
        throw new BadRequestException(ctx.admin ? `Turma lotada (${ocupacao}/${cabem}). Tire alguém antes de colocar ${quem}.` : 'Horário lotado');
      }

      /**
       * Grava o agendamento: revive a linha cancelada, se existir, ou cria uma
       * nova. `reposicao` e `creditoId` vão sempre explícitos para a marcação
       * anterior não vazar na nova (quem repôs e cancelou pode voltar a marcar
       * a aula pelo plano, e aí não é mais reposição).
       */
      const gravar = (extra: { reposicao: boolean; creditoId: string | null }) => {
        const include = { horario: { include: { modalidade: true } } };
        const dados = { status: 'CONFIRMADO' as const, ...extra };
        return anterior
          ? tx.agendamento.update({ where: { id: anterior.id }, data: dados, include })
          : tx.agendamento.create({ data: { usuarioId, horarioId: dto.horarioId, dataAula, ...dados }, include });
      };

      // ── Fluxo por CRÉDITO de reposição (não consome vaga semanal) ──────
      if (dto.usarCredito === true) {
        const credito = await tx.creditoReposicao.findFirst({
          where: { usuarioId, usado: false, revogado: false, expiraEm: { gt: new Date() } },
          orderBy: { expiraEm: 'asc' },
        });
        if (!credito) throw new ForbiddenException('Você não possui crédito de reposição válido');

        /**
         * Teto de reposições da janela (Termo de Normas, seção 3).
         *
         * Conta pela data em que a reposição foi MARCADA, não pela data da
         * aula: o termo fala em "agendar até 5 a cada 30 dias", e é o ato de
         * marcar que ocupa a vaga de outra pessoa. Reposição cancelada não
         * conta — o crédito já se perdeu ali, cobrar de novo na cota seria
         * punir duas vezes pelo mesmo cancelamento.
         */
        const desde = dayjs().subtract(DIAS_PERIODO_REPOSICOES, 'day').toDate();
        const marcadasNaJanela = await tx.agendamento.findMany({
          where: {
            usuarioId,
            reposicao: true,
            status: { not: 'CANCELADO' },
            createdAt: { gte: desde },
          },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        });
        if (marcadasNaJanela.length >= MAX_REPOSICOES_POR_PERIODO) {
          // Quando a mais antiga sair da janela, abre uma vaga de novo — dizer
          // a data evita o aluno ficar tentando todo dia sem saber o porquê.
          const liberaEm = dayjs(marcadasNaJanela[0].createdAt)
            .add(DIAS_PERIODO_REPOSICOES, 'day')
            .format('DD/MM');
          throw new ForbiddenException(
            `Você já agendou ${MAX_REPOSICOES_POR_PERIODO} reposições nos últimos ${DIAS_PERIODO_REPOSICOES} dias, ` +
              `que é o limite. A próxima vaga abre em ${liberaEm}.`,
          );
        }

        const agendamento = await gravar({ reposicao: true, creditoId: credito.id });
        await tx.creditoReposicao.update({
          where: { id: credito.id },
          data: { usado: true, usadoEm: new Date(), usadoAgendamentoId: agendamento.id },
        });
        return agendamento;
      }

      // ── Fluxo normal: limite semanal do plano ──────────────────────────
      // O limite vale para a SEMANA DA AULA sendo agendada (não a semana atual):
      // cada semana tem sua própria cota, permitindo agendar semanas futuras.
      const usadasNaSemana = await tx.agendamento.count({
        where: {
          usuarioId,
          dataAula: { gte: inicioSemanaAula, lte: fimSemanaAula },
          status: { in: ['CONFIRMADO', 'REALIZADO'] },
          reposicao: false, // aulas por crédito não consomem a cota semanal
        },
      });
      if (usadasNaSemana >= usuarioPlano.plano.aulasSemanais) {
        /**
         * Para o aluno, "acabou a cota" encerra o assunto. Para o estúdio não:
         * quase sempre a dona está remanejando, e a aula que ocupa a cota é
         * justamente a que ela quer tirar. Devolver QUAIS aulas ocupam a semana
         * deixa a tela oferecer a troca ali mesmo, em vez de mandá-la caçar a
         * aula velha em outra tela sem saber qual é.
         */
        if (ctx.admin) {
          const daSemana = await tx.agendamento.findMany({
            where: {
              usuarioId,
              dataAula: { gte: inicioSemanaAula, lte: fimSemanaAula },
              status: { in: ['CONFIRMADO', 'REALIZADO'] },
              reposicao: false,
            },
            include: { horario: { include: { modalidade: true } } },
            orderBy: [{ dataAula: 'asc' }, { horario: { horaInicio: 'asc' } }],
          });
          throw new ForbiddenException({
            statusCode: 403,
            codigo: 'LIMITE_SEMANAL',
            message:
              `${quem} já tem ${usadasNaSemana} aula${usadasNaSemana > 1 ? 's' : ''} nesta semana e o plano é ${usuarioPlano.plano.aulasSemanais}x/semana. ` +
              'Escolha qual sai para esta entrar.',
            aulasDaSemana: daSemana.map((a) => ({
              id: a.id,
              dataAula: a.dataAula,
              horaInicio: a.horario.horaInicio,
              modalidade: a.horario.modalidade?.nome ?? '',
              podeTrocar: a.status === 'CONFIRMADO',
            })),
          });
        }
        throw new ForbiddenException(`Limite semanal atingido (${usuarioPlano.plano.aulasSemanais}x/semana)`);
      }

      // aulasUsadasSemana/semanaReferencia seguem existindo só para relatórios:
      // incrementa apenas quando a aula pertence à semana corrente.
      if (dayjs(usuarioPlano.semanaReferencia).isBefore(inicioSemanaAtual)) {
        await tx.usuarioPlano.update({ where: { id: usuarioPlano.id }, data: { aulasUsadasSemana: 0, semanaReferencia: inicioSemanaAtual } });
        usuarioPlano.aulasUsadasSemana = 0;
      }

      /**
       * O crédito é para a aula que o aluno PERDEU — não para a que ele
       * remarcou.
       *
       * Cancelar libera a vaga da semana E gerava um crédito. Quem cancelasse
       * e marcasse de novo na mesma semana ficava com a aula e com o crédito,
       * e podia repetir o ciclo à vontade: cancela, remarca, cancela,
       * remarca — um crédito por volta. Como reposição não consome cota, cada
       * volta virava uma aula extra depois. Um plano 1x rendia 2 aulas por
       * semana, indefinidamente.
       *
       * Régua: cada aula que o aluno remarca na semana derruba um crédito que
       * ELE gerou naquela mesma semana. Quem cancela e não remarca fica com o
       * crédito — que é o caso legítimo, o da aula realmente perdida.
       *
       * Só vale para o aluno se agendando. Quando é a dona quem coloca (troca
       * de turma, arrumação de agenda), o crédito fica de pé: ela está
       * remanejando, não devolvendo aula ao aluno. Crédito concedido pelo
       * estúdio também nunca cai — a compensação é dela e não se desfaz
       * porque o aluno achou outro horário.
       */
      if (!ctx.admin) {
        const canceladasNaSemana = await tx.agendamento.findMany({
          where: {
            usuarioId,
            dataAula: { gte: inicioSemanaAula, lte: fimSemanaAula },
            status: 'CANCELADO',
          },
          select: { id: true },
        });
        if (canceladasNaSemana.length > 0) {
          const credito = await tx.creditoReposicao.findFirst({
            where: {
              usuarioId,
              usado: false,
              revogado: false,
              concedidoAdmin: false,
              origemAgendamentoId: { in: canceladasNaSemana.map((c) => c.id) },
            },
            orderBy: { criadoEm: 'asc' },
            select: { id: true },
          });
          if (credito) {
            await tx.creditoReposicao.update({
              where: { id: credito.id },
              data: { revogado: true },
            });
          }
        }
      }

      const agendamento = await gravar({ reposicao: false, creditoId: null });
      if (aulaNaSemanaAtual) {
        await tx.usuarioPlano.update({ where: { id: usuarioPlano.id }, data: { aulasUsadasSemana: { increment: 1 } } });
      }
      return agendamento;
    });
  }

  async cancelar(agendamentoId: string, usuarioId: string) {
    const ag = await this.prisma.agendamento.findFirst({ where: { id: agendamentoId, usuarioId }, include: { horario: { include: { modalidade: true } } } });
    if (!ag) throw new NotFoundException('Agendamento não encontrado');
    if (ag.status !== 'CONFIRMADO') throw new BadRequestException('Agendamento não pode ser cancelado');

    /**
     * Reposição marcada não se desmarca (Termo de Normas, seção 3:
     * "uma vez agendada no sistema, a reposição é confirmada e não permite
     * novo cancelamento ou reagendamento").
     *
     * Antes daqui o cancelamento passava e o aluno só perdia o crédito. O
     * efeito para ele era parecido, mas a vaga voltava para a turma tarde
     * demais para outra pessoa aproveitar — e o texto que ele assinou diz o
     * contrário. Quem precisa desfazer é o estúdio, pelo painel.
     */
    if (ag.reposicao) {
      throw new ForbiddenException(
        'Aula de reposição não pode ser cancelada — uma vez agendada, ela é confirmada. ' +
          'Fale com o estúdio pelo WhatsApp se houver algum imprevisto.',
      );
    }

    // Prazo de cancelamento por período da aula — os prazos do Termo de
    // Normas que o aluno aceita no primeiro acesso (termos/termo.ts, seção 2):
    //  - Manhã  (05:30–11:30): até 20:00 do dia anterior
    //  - Tarde  (13:00–17:00): até 10:00 do próprio dia
    //  - Noite  (18:00–22:00): até 14:00 do próprio dia
    // O espelho no app é src/services/cancelamento.ts; os três andam juntos.
    const [hIni, mIni] = ag.horario.horaInicio.split(':').map((n) => parseInt(n, 10));
    const inicioMin = hIni * 60 + mIni;
    let limite: dayjs.Dayjs;
    if (inicioMin < 720) {
      limite = dayjs(ag.dataAula).subtract(1, 'day').hour(20).minute(0).second(0).millisecond(0);
    } else if (inicioMin < 1080) {
      limite = dayjs(ag.dataAula).hour(10).minute(0).second(0).millisecond(0);
    } else {
      limite = dayjs(ag.dataAula).hour(14).minute(0).second(0).millisecond(0);
    }
    if (dayjs().isAfter(limite)) {
      throw new ForbiddenException('O prazo de cancelamento deste horário já encerrou. A aula será contabilizada.');
    }

    // Aula normal cancelada no prazo → convertida em 1 crédito de reposição
    // (a de reposição já saiu lá em cima: ela não é cancelável pelo aluno).
    const expiraEm = dayjs(ag.dataAula).add(DIAS_VALIDADE_CREDITO, 'day').endOf('day').toDate();
    await this.prisma.$transaction([
      this.prisma.agendamento.update({ where: { id: agendamentoId }, data: { status: 'CANCELADO' } }),
      this.prisma.creditoReposicao.create({ data: { usuarioId, origemAgendamentoId: ag.id, expiraEm } }),
    ]);
    return {
      mensagem: `Aula cancelada. Você recebeu 1 crédito de reposição (válido por ${DIAS_VALIDADE_CREDITO} dias).`,
    };
  }

  async listarMeus(usuarioId: string) {
    // A partir do INÍCIO do dia de hoje: aulas de hoje continuam aparecendo
    // (dataAula é armazenada à meia-noite do dia da aula).
    return this.prisma.agendamento.findMany({
      where: { usuarioId, status: 'CONFIRMADO', dataAula: { gte: dayjs().startOf('day').toDate() } },
      include: { horario: { include: { modalidade: true } } },
      orderBy: [{ dataAula: 'asc' }, { horario: { horaInicio: 'asc' } }],
    });
  }

  async historico(usuarioId: string, page = 1) {
    const take = 20;
    const skip = (page - 1) * take;
    // Só aulas de dias anteriores — as de hoje/futuras aparecem em "minhas aulas"
    return this.prisma.agendamento.findMany({
      where: { usuarioId, dataAula: { lt: dayjs().startOf('day').toDate() } },
      include: { horario: { include: { modalidade: true } }, presenca: true },
      orderBy: { dataAula: 'desc' },
      take, skip,
    });
  }

  async listarPorHorario(horarioId: string, data: string, solicitante?: { id: string; tipo: string }) {
    // Professor só enxerga aulas da própria modalidade
    if (solicitante?.tipo === 'PROFESSOR') {
      const [horario, prof] = await Promise.all([
        this.prisma.horario.findUnique({ where: { id: horarioId }, select: { modalidadeId: true } }),
        this.prisma.usuario.findUnique({ where: { id: solicitante.id }, select: { modalidadeProfessorId: true } }),
      ]);
      if (!horario || !prof?.modalidadeProfessorId || horario.modalidadeId !== prof.modalidadeProfessorId) {
        throw new ForbiddenException('Esta aula não é da sua modalidade');
      }
    }
    const dataAula = dayjs(data).startOf('day').toDate();
    return this.prisma.agendamento.findMany({
      where: { horarioId, dataAula, status: 'CONFIRMADO' },
      include: { usuario: { select: { id: true, nome: true, cpf: true } } },
    });
  }

  /**
   * Tira o aluno da aula SEM gerar crédito.
   *
   * É diferente de `adminCancelar`: lá o estúdio desmarcou uma aula que ia
   * acontecer, e compensar com crédito é justo. Aqui a dona está arrumando a
   * agenda dele — tirando aula que sobrou de horário fixo antigo, ou
   * remanejando de turma. Dar crédito nesse caso inflaria o saldo do aluno a
   * cada correção de cadastro.
   */
  async desmarcarSemCredito(agendamentoId: string) {
    const ag = await this.prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      include: { horario: { include: { modalidade: true } } },
    });
    if (!ag) throw new NotFoundException('Agendamento não encontrado');
    if (ag.status !== 'CONFIRMADO') {
      throw new BadRequestException('Esta aula já não está marcada');
    }
    await this.prisma.agendamento.update({
      where: { id: agendamentoId },
      data: { status: 'CANCELADO' },
    });
    return { mensagem: 'Aula desmarcada. A vaga voltou para a turma.' };
  }

  async adminCancelar(agendamentoId: string) {
    const ag = await this.prisma.agendamento.findUnique({ where: { id: agendamentoId } });
    if (!ag) throw new NotFoundException('Agendamento não encontrado');
    if (ag.status !== 'CONFIRMADO') throw new BadRequestException('Agendamento não pode ser cancelado');

    // Cancelamento pelo admin não é culpa do aluno: sempre compensa com
    // 1 crédito de reposição (mesma validade do cancelamento no prazo) —
    // inclusive se a aula tinha sido marcada com crédito (devolve um novo).
    const expiraEm = dayjs(ag.dataAula).add(DIAS_VALIDADE_CREDITO, 'day').endOf('day').toDate();
    await this.prisma.$transaction([
      this.prisma.agendamento.update({ where: { id: agendamentoId }, data: { status: 'CANCELADO' } }),
      this.prisma.creditoReposicao.create({ data: { usuarioId: ag.usuarioId, origemAgendamentoId: ag.id, expiraEm, concedidoAdmin: true } }),
    ]);
    return {
      mensagem: `Agendamento cancelado. O aluno recebeu 1 crédito de reposição (válido por ${DIAS_VALIDADE_CREDITO} dias).`,
    };
  }
}
