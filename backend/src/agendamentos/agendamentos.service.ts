import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nomeCurto } from '../comum/nome';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { CriarAgendamentoAdminDto } from './dto/criar-agendamento-admin.dto';
import { modalidadesDoProfessor } from '../usuarios/modalidades-do-professor';
import {
  DIAS_PERIODO_REPOSICOES,
  DIAS_VALIDADE_CREDITO,
  MAX_REPOSICOES_POR_PERIODO,
} from '../creditos/creditos.constantes';
import { capacidadeEfetiva } from '../horarios/capacidade';
import { cotaDaSemana } from './cota-semanal';

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
  async criarComoAdmin(dto: CriarAgendamentoAdminDto, horarioFixoId?: string) {
    const aluno = await this.prisma.usuario.findUnique({
      where: { id: dto.usuarioId },
      select: { id: true, nome: true, ativo: true, senhaHash: true, tipoUsuario: true },
    });
    if (!aluno || aluno.tipoUsuario !== 'ALUNO') throw new NotFoundException('Aluno não encontrado');

    /**
     * Quem parou de treinar não volta para a agenda por engano — desligar
     * remove as turmas e libera as vagas, e marcar aula desfaria isso em
     * silêncio. Cadastro novo passa: ele nasce treinando, mesmo antes de
     * abrir o app.
     */
    if (!aluno.ativo) {
      throw new BadRequestException(
        `${nomeCurto(aluno.nome)} está marcado como "não treina mais". ` +
          'Marque como treinando antes de marcar aula.',
      );
    }

    return this.agendar(dto.usuarioId, dto, {
      admin: true,
      nome: nomeCurto(aluno.nome),
      substituirAgendamentoId: dto.substituirAgendamentoId,
      horarioFixoId,
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
    ctx: { admin: boolean; nome?: string; substituirAgendamentoId?: string; horarioFixoId?: string },
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
      const turmaAtual = await tx.horario.findUnique({ where: { id: dto.horarioId }, include: { modalidade: true } });
      if (!turmaAtual?.ativo) throw new BadRequestException('Turma desligada. Escolha uma turma ativa.');
      /**
       * Dia fechado (feriado, recesso) não recebe aula — nem do aluno, nem da
       * dona: para pôr alguém nele, ela reabre o dia antes. A conferência é
       * aqui dentro, com a turma travada, porque fechar o dia trava as turmas
       * também: ou a aula entra antes e o fechamento a tira, ou o fechamento
       * vem antes e a aula é recusada. Nunca fica aula num dia fechado.
       */
      const fechado = await tx.diaFechado.findUnique({ where: { data: dataAula } });
      if (fechado) {
        throw new BadRequestException(
          `A academia não abre em ${dayjs(dataAula).format('DD/MM')} (${fechado.motivo}). Escolha outro dia.`,
        );
      }
      if (turmaAtual.diaSemana !== diaSemana) throw new BadRequestException('O dia da turma mudou. Atualize a agenda.');
      const planoAtual = await tx.usuarioPlano.findUnique({ where: { id: usuarioPlano.id } });
      if (!planoAtual || planoAtual.vigenciaFim) {
        throw new BadRequestException('O plano mudou durante a operação. Atualize a agenda e tente novamente.');
      }
      // A geração pode ter lido o fixo antes de a dona removê-lo.
      if (ctx.horarioFixoId) {
        const fixoAtual = await tx.horarioFixo.findUnique({ where: { id: ctx.horarioFixoId } });
        if (!fixoAtual?.ativo || fixoAtual.usuarioId !== usuarioId || fixoAtual.horarioId !== dto.horarioId ||
            dayjs(dataAula).isBefore(fixoAtual.dataInicio, 'day') ||
            (fixoAtual.dataFim && dayjs(dataAula).isAfter(fixoAtual.dataFim, 'day'))) {
          throw new BadRequestException('O horário fixo foi removido ou mudou. Esta aula não será gerada.');
        }
      }

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
      const cabem = capacidadeEfetiva(turmaAtual.capacidadeMaxima, turmaAtual.modalidade?.nome);
      const ocupacao = await tx.agendamento.count({ where: { horarioId: dto.horarioId, dataAula, status: 'CONFIRMADO' } });
      if (ocupacao >= cabem) {
        throw new BadRequestException(
          ctx.admin
            ? `Horário cheio (${ocupacao}/${cabem}). Não é possível marcar ${quem} nesta turma. Tire alguém antes de colocar outro aluno.`
            : 'Horário lotado',
        );
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
        /**
         * Reviver é marcar de novo, então a data de marcação é agora. Sem isto
         * a linha guardava a data da PRIMEIRA marcação — às vezes semanas
         * antes, quando a aula veio do horário fixo — e uma reposição marcada
         * hoje ficava fora da janela de 30 dias do limite de reposições.
         */
        return anterior
          ? tx.agendamento.update({ where: { id: anterior.id }, data: { ...dados, createdAt: new Date() }, include })
          : tx.agendamento.create({ data: { usuarioId, horarioId: dto.horarioId, dataAula, ...dados }, include });
      };

      // ── Fluxo por CRÉDITO de reposição (não consome vaga semanal) ──────
      if (dto.usarCredito === true) {
        /**
         * O crédito tem que valer NO DIA DA AULA, não só hoje.
         *
         * O termo diz que o crédito "expira em 30 dias corridos a contar da
         * data da aula cancelada". Olhando só a validade de hoje, um crédito
         * que vencia dia 14 servia para uma aula do dia 19 — e, como a aula
         * pode ser marcada com até 60 dias de antecedência, o prazo de 30
         * dias virava quase 90. `expiraEm` é o fim do último dia, e a aula é
         * gravada à meia-noite: aula no próprio dia do vencimento ainda vale.
         */
        const credito = await tx.creditoReposicao.findFirst({
          where: { usuarioId, usado: false, revogado: false, expiraEm: { gt: new Date(), gte: dataAula } },
          orderBy: { expiraEm: 'asc' },
        });
        if (!credito) {
          const vencemAntes = await tx.creditoReposicao.findFirst({
            where: { usuarioId, usado: false, revogado: false, expiraEm: { gt: new Date() } },
            orderBy: { expiraEm: 'desc' },
          });
          if (vencemAntes) {
            throw new ForbiddenException(
              `Seu crédito de reposição vale até ${dayjs(vencemAntes.expiraEm).format('DD/MM')}. ` +
                'Escolha uma aula até essa data.',
            );
          }
          throw new ForbiddenException('Você não possui crédito de reposição válido');
        }

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
      /**
       * O crédito é para a aula que o aluno PERDEU — não para a que ele
       * remarcou.
       *
       * Cancelar libera a vaga da semana E gera um crédito. Quem cancelasse
       * e marcasse de novo na mesma semana ficava com a aula e com o crédito,
       * e podia repetir o ciclo à vontade: cancela, remarca, cancela,
       * remarca — um crédito por volta. Como reposição não consome cota, cada
       * volta virava uma aula extra depois. Um plano 1x rendia 2 aulas por
       * semana, indefinidamente.
       *
       * Régua: cada aula que o aluno remarca na semana derruba um crédito que
       * ELE gerou naquela mesma semana. Quem cancela e não remarca fica com o
       * crédito — que é o caso legítimo, o da aula realmente perdida. Se o
       * crédito já foi gasto, não há o que derrubar: a aula cancelada já
       * voltou como reposição e continua contando na semana (cota-semanal.ts).
       *
       * Só vale para o aluno se agendando. Quando é a dona quem coloca (troca
       * de turma, arrumação de agenda), o crédito fica de pé: ela está
       * remanejando, não devolvendo aula ao aluno. Crédito concedido pelo
       * estúdio também nunca cai — a compensação é dela e não se desfaz
       * porque o aluno achou outro horário.
       */
      const cota = await cotaDaSemana(tx, usuarioId, inicioSemanaAula, fimSemanaAula);
      const usadasNaSemana = cota.usadas;
      const repostasNaSemana = ctx.admin ? [] : cota.repostas;
      const creditoParaDerrubar = ctx.admin ? null : cota.creditoLivreId;

      if (usadasNaSemana + repostasNaSemana.length >= usuarioPlano.plano.aulasSemanais) {
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
              reposicao: false,
              // A aula do dia fechado ocupa a semana e aparece na lista — só
              // não dá para trocá-la, porque ela já saiu da agenda.
              OR: [{ status: { in: ['CONFIRMADO', 'REALIZADO'] } }, { status: 'CANCELADO', diaFechadoId: { not: null } }],
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
        const limite = `Limite semanal atingido (${usuarioPlano.plano.aulasSemanais}x/semana)`;
        if (cota.emDiaFechado.length > 0) {
          const f = cota.emDiaFechado[0];
          throw new ForbiddenException(
            `${limite}. A aula de ${dayjs(f.dataAula).format('DD/MM')} conta nesta semana: ` +
              `a academia não abriu nesse dia (${f.motivo}).`,
          );
        }
        if (repostasNaSemana.length > 0) {
          const dias = repostasNaSemana.map((d) => dayjs(d).format('DD/MM')).join(' e ');
          throw new ForbiddenException(
            `${limite}. A aula de ${dias} que você cancelou já foi reposta com o crédito, ` +
              'então ela continua contando nesta semana.',
          );
        }
        throw new ForbiddenException(limite);
      }

      // aulasUsadasSemana/semanaReferencia seguem existindo só para relatórios:
      // incrementa apenas quando a aula pertence à semana corrente.
      if (dayjs(usuarioPlano.semanaReferencia).isBefore(inicioSemanaAtual)) {
        await tx.usuarioPlano.update({ where: { id: usuarioPlano.id }, data: { aulasUsadasSemana: 0, semanaReferencia: inicioSemanaAtual } });
        usuarioPlano.aulasUsadasSemana = 0;
      }

      if (creditoParaDerrubar) {
        await tx.creditoReposicao.update({
          where: { id: creditoParaDerrubar },
          data: { revogado: true },
        });
      }

      const agendamento = await gravar({ reposicao: false, creditoId: null });
      if (aulaNaSemanaAtual) {
        await tx.usuarioPlano.update({ where: { id: usuarioPlano.id }, data: { aulasUsadasSemana: { increment: 1 } } });
      }
      return agendamento;
    });
  }

  /**
   * Tira a aula do CONFIRMADO, e só uma vez.
   *
   * A leitura de status lá em cima não basta: dois toques em "Cancelar" (ou o
   * app reenviando numa conexão ruim) liam os dois "CONFIRMADO" e cada um
   * gerava o seu crédito — uma aula cancelada rendia dois, três créditos. O
   * update condicional resolve na linha do banco: o segundo pedido espera o
   * primeiro, encontra a aula já cancelada e não muda nada.
   */
  private async passarParaCancelado(tx: Prisma.TransactionClient, agendamentoId: string) {
    const { count } = await tx.agendamento.updateMany({
      where: { id: agendamentoId, status: 'CONFIRMADO' },
      data: { status: 'CANCELADO' },
    });
    if (count === 0) throw new BadRequestException('Esta aula já foi cancelada.');
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
    await this.prisma.$transaction(async (tx) => {
      await this.passarParaCancelado(tx, agendamentoId);
      await tx.creditoReposicao.create({ data: { usuarioId, origemAgendamentoId: ag.id, expiraEm } });
    });
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

  /**
   * Aulas do aluno que caíram em dia fechado, daqui para a frente.
   *
   * Elas saem de "minhas aulas" (não vão acontecer), mas sumir em silêncio
   * deixaria o aluno achando que perdeu a aula por erro do sistema — e
   * tentando marcar outra na semana, que a cota não deixa. A tela mostra cada
   * uma com o motivo.
   */
  async listarFechadasDoAluno(usuarioId: string) {
    return this.prisma.agendamento.findMany({
      where: {
        usuarioId,
        status: 'CANCELADO',
        reposicao: false,
        diaFechadoId: { not: null },
        dataAula: { gte: dayjs().startOf('day').toDate() },
      },
      include: { horario: { include: { modalidade: true } }, diaFechado: { select: { motivo: true } } },
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
    // Professor só enxerga aulas das próprias modalidades
    if (solicitante?.tipo === 'PROFESSOR') {
      const [horario, minhas] = await Promise.all([
        this.prisma.horario.findUnique({ where: { id: horarioId }, select: { modalidadeId: true } }),
        modalidadesDoProfessor(this.prisma, solicitante.id),
      ]);
      if (!horario || !minhas.includes(horario.modalidadeId)) {
        throw new ForbiddenException('Esta aula não é da sua modalidade');
      }
    }
    const dataAula = dayjs(data).startOf('day').toDate();
    const [agendamentos, fixos] = await Promise.all([
      this.prisma.agendamento.findMany({
        where: { horarioId, dataAula, status: 'CONFIRMADO' },
        include: { usuario: { select: { id: true, nome: true, cpf: true } } },
      }),
      /**
       * Quem está nesta aula por horário fixo, e qual é o fixo.
       *
       * Sem isto a tela não sabe distinguir "a Ana está aqui porque combinou
       * toda terça" de "a Ana foi encaixada nesta terça". São coisas
       * diferentes na hora de tirar: numa, a dona quer liberar só este dia; na
       * outra, ela está remanejando de vez. A tela pergunta qual — e para
       * oferecer a segunda opção precisa do id do fixo.
       *
       * O período conta: fixo que termina antes desta data já não é o motivo
       * de o aluno estar aqui.
       */
      this.prisma.horarioFixo.findMany({
        where: {
          horarioId,
          ativo: true,
          dataInicio: { lte: dataAula },
          OR: [{ dataFim: null }, { dataFim: { gte: dataAula } }],
        },
        select: { id: true, usuarioId: true },
      }),
    ]);

    const fixoPorAluno = new Map(fixos.map((f) => [f.usuarioId, f.id]));
    return agendamentos.map((a) => ({
      ...a,
      horarioFixoId: fixoPorAluno.get(a.usuarioId) ?? null,
    }));
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
    /**
     * Reposição tirada pela dona devolve o crédito que o aluno gastou nela.
     *
     * Sem crédito novo é o certo para aula do plano (a cota da semana volta
     * sozinha), mas a reposição foi paga com um crédito — desmarcar sem
     * devolvê-lo fazia o aluno perder a aula que ele tinha direito de repor,
     * por uma arrumação de agenda que não foi escolha dele. Volta o MESMO
     * crédito, com a validade de antes: não ganha prazo, só não perde.
     */
    const devolveCredito = ag.reposicao && !!ag.creditoId;
    await this.prisma.$transaction(async (tx) => {
      await this.passarParaCancelado(tx, agendamentoId);
      if (devolveCredito) {
        await tx.creditoReposicao.updateMany({
          where: { id: ag.creditoId!, usado: true },
          data: { usado: false, usadoEm: null, usadoAgendamentoId: null },
        });
      }
    });
    return {
      mensagem: devolveCredito
        ? 'Aula desmarcada. A vaga voltou para a turma e o crédito de reposição voltou para o aluno.'
        : 'Aula desmarcada. A vaga voltou para a turma.',
    };
  }

  async adminCancelar(agendamentoId: string) {
    const ag = await this.prisma.agendamento.findUnique({ where: { id: agendamentoId } });
    if (!ag) throw new NotFoundException('Agendamento não encontrado');
    if (ag.status !== 'CONFIRMADO') throw new BadRequestException('Agendamento não pode ser cancelado');

    // Cancelamento pelo admin não é culpa do aluno: sempre compensa com
    // 1 crédito de reposição (mesma validade do cancelamento no prazo) —
    // inclusive se a aula tinha sido marcada com crédito (devolve um novo).
    const expiraEm = dayjs(ag.dataAula).add(DIAS_VALIDADE_CREDITO, 'day').endOf('day').toDate();
    await this.prisma.$transaction(async (tx) => {
      await this.passarParaCancelado(tx, agendamentoId);
      await tx.creditoReposicao.create({ data: { usuarioId: ag.usuarioId, origemAgendamentoId: ag.id, expiraEm, concedidoAdmin: true } });
    });
    return {
      mensagem: `Agendamento cancelado. O aluno recebeu 1 crédito de reposição (válido por ${DIAS_VALIDADE_CREDITO} dias).`,
    };
  }
}
