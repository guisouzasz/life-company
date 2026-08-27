import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { PrismaService } from '../prisma/prisma.service';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { DIAS_VALIDADE_CREDITO } from '../creditos/creditos.constantes';
import { capacidadeEfetiva } from '../horarios/capacidade';

(dayjs as any).extend((isoWeek as any).default || isoWeek);

const DIA_MAP: Record<number, string> = { 1: 'SEGUNDA', 2: 'TERCA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA' };

@Injectable()
export class AgendamentosService {
  constructor(private prisma: PrismaService) {}

  async criar(usuarioId: string, dto: CriarAgendamentoDto) {
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
     */
    const [hora, minuto] = horario.horaInicio.split(':').map(Number);
    const inicioAula = dayjs(dto.dataAula).startOf('day').hour(hora).minute(minuto);
    if (!inicioAula.isAfter(dayjs())) {
      throw new BadRequestException(
        'Esta aula já começou. Escolha um horário que ainda vai acontecer.',
      );
    }

    // Plano dá N aulas/semana para QUALQUER modalidade (não trava por categoria)
    const usuarioPlano = await this.prisma.usuarioPlano.findFirst({ where: { usuarioId, vigenciaFim: null }, include: { plano: true } });
    if (!usuarioPlano) throw new ForbiddenException('Você não possui um plano ativo');

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
      if (anterior?.status === 'CONFIRMADO') throw new ConflictException('Você já possui agendamento neste horário');

      /**
       * Quantos cabem: o menor entre a capacidade gravada no horário e o teto
       * da modalidade. Sem o teto aqui, as turmas criadas antes desta regra —
       * Pilates salvo com 4, por exemplo — continuariam aceitando gente a
       * mais, porque a checagem olhava só o número do banco.
       */
      const cabem = capacidadeEfetiva(horario.capacidadeMaxima, horario.modalidade?.nome);
      const ocupacao = await tx.agendamento.count({ where: { horarioId: dto.horarioId, dataAula, status: 'CONFIRMADO' } });
      if (ocupacao >= cabem) throw new BadRequestException('Horário lotado');

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
      if (usadasNaSemana >= usuarioPlano.plano.aulasSemanais) throw new ForbiddenException(`Limite semanal atingido (${usuarioPlano.plano.aulasSemanais}x/semana)`);

      // aulasUsadasSemana/semanaReferencia seguem existindo só para relatórios:
      // incrementa apenas quando a aula pertence à semana corrente.
      if (dayjs(usuarioPlano.semanaReferencia).isBefore(inicioSemanaAtual)) {
        await tx.usuarioPlano.update({ where: { id: usuarioPlano.id }, data: { aulasUsadasSemana: 0, semanaReferencia: inicioSemanaAtual } });
        usuarioPlano.aulasUsadasSemana = 0;
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

    // Prazo de cancelamento por período da aula:
    //  - Manhã  (06:30–11:30): até 20:00 do dia anterior
    //  - Tarde  (13:00–17:00): até 09:00 do próprio dia
    //  - Noite  (18:00–22:00): até 14:00 do próprio dia
    const [hIni, mIni] = ag.horario.horaInicio.split(':').map((n) => parseInt(n, 10));
    const inicioMin = hIni * 60 + mIni;
    let limite: dayjs.Dayjs;
    if (inicioMin < 720) {
      limite = dayjs(ag.dataAula).subtract(1, 'day').hour(20).minute(0).second(0).millisecond(0);
    } else if (inicioMin < 1080) {
      limite = dayjs(ag.dataAula).hour(9).minute(0).second(0).millisecond(0);
    } else {
      limite = dayjs(ag.dataAula).hour(14).minute(0).second(0).millisecond(0);
    }
    if (dayjs().isAfter(limite)) {
      throw new ForbiddenException('O prazo de cancelamento deste horário já encerrou. A aula será contabilizada.');
    }

    // Aula de reposição: cancelar NÃO gera novo crédito — o crédito é perdido.
    if (ag.reposicao) {
      await this.prisma.agendamento.update({ where: { id: agendamentoId }, data: { status: 'CANCELADO' } });
      return { mensagem: 'Aula de reposição cancelada. O crédito foi perdido e não gera novo crédito.' };
    }

    // Aula normal cancelada no prazo → convertida em 1 crédito de reposição
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
