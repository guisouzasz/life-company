import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { PrismaService } from '../prisma/prisma.service';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';

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

    // Plano dá N aulas/semana para QUALQUER modalidade (não trava por categoria)
    const usuarioPlano = await this.prisma.usuarioPlano.findFirst({ where: { usuarioId, vigenciaFim: null }, include: { plano: true } });
    if (!usuarioPlano) throw new ForbiddenException('Você não possui um plano ativo');

    // Validações comuns aos dois fluxos (vaga/duplicidade)
    const jaAgendado = await this.prisma.agendamento.findFirst({ where: { usuarioId, horarioId: dto.horarioId, dataAula, status: 'CONFIRMADO' } });
    if (jaAgendado) throw new ConflictException('Você já possui agendamento neste horário');

    const ocupacao = await this.prisma.agendamento.count({ where: { horarioId: dto.horarioId, dataAula, status: 'CONFIRMADO' } });
    if (ocupacao >= horario.capacidadeMaxima) throw new BadRequestException('Horário lotado');

    // ── Fluxo por CRÉDITO de reposição (não consome vaga semanal) ──────
    if (dto.usarCredito === true) {
      const credito = await this.prisma.creditoReposicao.findFirst({
        where: { usuarioId, usado: false, revogado: false, expiraEm: { gt: new Date() } },
        orderBy: { expiraEm: 'asc' },
      });
      if (!credito) throw new ForbiddenException('Você não possui crédito de reposição válido');
      const agendamento = await this.prisma.agendamento.create({
        data: { usuarioId, horarioId: dto.horarioId, dataAula, status: 'CONFIRMADO', reposicao: true, creditoId: credito.id },
        include: { horario: { include: { modalidade: true } } },
      });
      await this.prisma.creditoReposicao.update({
        where: { id: credito.id },
        data: { usado: true, usadoEm: new Date(), usadoAgendamentoId: agendamento.id },
      });
      return agendamento;
    }

    // ── Fluxo normal: limite semanal do plano ──────────────────────────
    // O limite vale para a SEMANA DA AULA sendo agendada (não a semana atual):
    // cada semana tem sua própria cota, permitindo agendar semanas futuras.
    const inicioSemanaAula = dayjs(dto.dataAula).startOf('isoWeek').toDate();
    const fimSemanaAula = dayjs(dto.dataAula).endOf('isoWeek').toDate();
    const usadasNaSemana = await this.prisma.agendamento.count({
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
    const inicioSemanaAtual = dayjs().startOf('isoWeek').toDate();
    const aulaNaSemanaAtual = dayjs(dto.dataAula).startOf('isoWeek').isSame(dayjs(inicioSemanaAtual));
    if (dayjs(usuarioPlano.semanaReferencia).isBefore(inicioSemanaAtual)) {
      await this.prisma.usuarioPlano.update({ where: { id: usuarioPlano.id }, data: { aulasUsadasSemana: 0, semanaReferencia: inicioSemanaAtual } });
      usuarioPlano.aulasUsadasSemana = 0;
    }

    const agendamento = await this.prisma.agendamento.create({
      data: { usuarioId, horarioId: dto.horarioId, dataAula, status: 'CONFIRMADO' },
      include: { horario: { include: { modalidade: true } } },
    });
    if (aulaNaSemanaAtual) {
      await this.prisma.usuarioPlano.update({ where: { id: usuarioPlano.id }, data: { aulasUsadasSemana: { increment: 1 } } });
    }
    return agendamento;
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

    // Aula normal cancelada no prazo → convertida em 1 crédito de reposição (45 dias)
    const expiraEm = dayjs(ag.dataAula).add(45, 'day').endOf('day').toDate();
    await this.prisma.$transaction([
      this.prisma.agendamento.update({ where: { id: agendamentoId }, data: { status: 'CANCELADO' } }),
      this.prisma.creditoReposicao.create({ data: { usuarioId, origemAgendamentoId: ag.id, expiraEm } }),
    ]);
    return { mensagem: 'Aula cancelada. Você recebeu 1 crédito de reposição (válido por 45 dias).' };
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

  async listarPorHorario(horarioId: string, data: string) {
    const dataAula = dayjs(data).startOf('day').toDate();
    return this.prisma.agendamento.findMany({
      where: { horarioId, dataAula, status: 'CONFIRMADO' },
      include: { usuario: { select: { id: true, nome: true, cpf: true } } },
    });
  }

  async adminCancelar(agendamentoId: string) {
    const ag = await this.prisma.agendamento.findUnique({ where: { id: agendamentoId } });
    if (!ag) throw new NotFoundException('Agendamento não encontrado');
    if (ag.status !== 'CONFIRMADO') throw new BadRequestException('Agendamento não pode ser cancelado');

    // Cancelamento pelo admin não é culpa do aluno: sempre compensa com
    // 1 crédito de reposição (45 dias, mesma regra do cancelamento no prazo) —
    // inclusive se a aula tinha sido marcada com crédito (devolve um novo).
    const expiraEm = dayjs(ag.dataAula).add(45, 'day').endOf('day').toDate();
    await this.prisma.$transaction([
      this.prisma.agendamento.update({ where: { id: agendamentoId }, data: { status: 'CANCELADO' } }),
      this.prisma.creditoReposicao.create({ data: { usuarioId: ag.usuarioId, origemAgendamentoId: ag.id, expiraEm, concedidoAdmin: true } }),
    ]);
    return { mensagem: 'Agendamento cancelado. O aluno recebeu 1 crédito de reposição (válido por 45 dias).' };
  }
}
