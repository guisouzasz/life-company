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

    // Reset semanal
    const inicioSemana = dayjs().startOf('isoWeek').toDate();
    if (dayjs(usuarioPlano.semanaReferencia).isBefore(inicioSemana)) {
      await this.prisma.usuarioPlano.update({ where: { id: usuarioPlano.id }, data: { aulasUsadasSemana: 0, semanaReferencia: inicioSemana } });
      usuarioPlano.aulasUsadasSemana = 0;
    }

    if (usuarioPlano.aulasUsadasSemana >= usuarioPlano.plano.aulasSemanais) throw new ForbiddenException(`Limite semanal atingido (${usuarioPlano.plano.aulasSemanais}x/semana)`);

    const jaAgendado = await this.prisma.agendamento.findFirst({ where: { usuarioId, horarioId: dto.horarioId, dataAula, status: 'CONFIRMADO' } });
    if (jaAgendado) throw new ConflictException('Você já possui agendamento neste horário');

    const ocupacao = await this.prisma.agendamento.count({ where: { horarioId: dto.horarioId, dataAula, status: 'CONFIRMADO' } });
    if (ocupacao >= horario.capacidadeMaxima) throw new BadRequestException('Horário lotado');

    const [agendamento] = await this.prisma.$transaction([
      this.prisma.agendamento.create({ data: { usuarioId, horarioId: dto.horarioId, dataAula, status: 'CONFIRMADO' }, include: { horario: { include: { modalidade: true } } } }),
      this.prisma.usuarioPlano.update({ where: { id: usuarioPlano.id }, data: { aulasUsadasSemana: { increment: 1 } } }),
    ]);
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

    const usuarioPlano = await this.prisma.usuarioPlano.findFirst({ where: { usuarioId, vigenciaFim: null } });
    await this.prisma.$transaction([
      this.prisma.agendamento.update({ where: { id: agendamentoId }, data: { status: 'CANCELADO' } }),
      ...(usuarioPlano ? [this.prisma.usuarioPlano.update({ where: { id: usuarioPlano.id }, data: { aulasUsadasSemana: { decrement: 1 } } })] : []),
    ]);
    return { mensagem: 'Agendamento cancelado com sucesso' };
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
    return this.prisma.agendamento.findMany({
      where: { usuarioId },
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
    await this.prisma.agendamento.update({ where: { id: agendamentoId }, data: { status: 'CANCELADO' } });
    return { mensagem: 'Agendamento cancelado pelo admin' };
  }
}
