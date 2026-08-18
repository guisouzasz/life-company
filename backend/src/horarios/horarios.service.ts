import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarHorarioDto, CriarHorarioDto } from './dto/criar-horario.dto';

@Injectable()
export class HorariosService {
  constructor(private prisma: PrismaService) {}

  /** `incluirInativos` (admin): lista também horários desativados, para gestão. */
  async listar(modalidadeId?: string, diaSemana?: string, incluirInativos = false) {
    const horarios = await this.prisma.horario.findMany({
      where: { ...(incluirInativos ? {} : { ativo: true }), ...(modalidadeId && { modalidadeId }), ...(diaSemana && { diaSemana: diaSemana as any }) },
      include: { modalidade: true, _count: { select: { agendamentos: { where: { status: 'CONFIRMADO', dataAula: { gte: new Date(new Date().setHours(0,0,0,0)) } } } } } },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });
    return horarios.map(h => ({ ...h, agendados: h._count.agendamentos, vagas: h.capacidadeMaxima - h._count.agendamentos }));
  }

  /**
   * `modalidadeId` opcional: sem ele, retorna todas as modalidades.
   * PROFESSOR sempre enxerga apenas a própria modalidade (filtro forçado).
   */
  async listarComVagas(
    modalidadeId: string | undefined,
    dataAula: string,
    solicitante?: { id: string; tipo: string },
  ) {
    if (solicitante?.tipo === 'PROFESSOR') {
      const prof = await this.prisma.usuario.findUnique({
        where: { id: solicitante.id },
        select: { modalidadeProfessorId: true },
      });
      modalidadeId = prof?.modalidadeProfessorId ?? '__sem_modalidade__';
    }
    // `new Date('2026-08-17')` é meia-noite em UTC — 21h do dia anterior no
    // fuso do estúdio. Como o agendamento é gravado à meia-noite LOCAL, a
    // comparação nunca batia e toda aula aparecia com 0 agendados e livre,
    // mesmo lotada. dayjs respeita o fuso do processo, igual ao que grava.
    const data = dayjs(dataAula).startOf('day').toDate();
    const horarios = await this.prisma.horario.findMany({
      where: { ativo: true, ...(modalidadeId ? { modalidadeId } : {}) },
      include: {
        modalidade: true,
        agendamentos: { where: { dataAula: data, status: 'CONFIRMADO' } },
      },
      orderBy: { horaInicio: 'asc' },
    });
    return horarios.map(h => ({
      id: h.id, horaInicio: h.horaInicio, horaFim: h.horaFim, diaSemana: h.diaSemana,
      modalidade: h.modalidade, capacidadeMaxima: h.capacidadeMaxima,
      agendados: h.agendamentos.length, vagas: h.capacidadeMaxima - h.agendamentos.length,
      disponivel: h.agendamentos.length < h.capacidadeMaxima,
    }));
  }

  async criar(dto: CriarHorarioDto) {
  return this.prisma.horario.create({
    data: {
      modalidadeId: dto.modalidadeId,
      diaSemana: dto.diaSemana as any,
      horaInicio: dto.horaInicio,
      horaFim: dto.horaFim,
      capacidadeMaxima: dto.capacidadeMaxima ?? 4,
      ativo: dto.ativo ?? true,
    },
    include: {
      modalidade: true,
    },
  });
}

  /** Edição de campos do horário (admin) — não mexe em agendamentos existentes. */
  async atualizar(id: string, dto: AtualizarHorarioDto) {
    const h = await this.prisma.horario.findUnique({ where: { id } });
    if (!h) throw new NotFoundException('Horário não encontrado');
    return this.prisma.horario.update({
      where: { id },
      data: {
        ...(dto.modalidadeId !== undefined ? { modalidadeId: dto.modalidadeId } : {}),
        ...(dto.diaSemana !== undefined ? { diaSemana: dto.diaSemana as any } : {}),
        ...(dto.horaInicio !== undefined ? { horaInicio: dto.horaInicio } : {}),
        ...(dto.horaFim !== undefined ? { horaFim: dto.horaFim } : {}),
        ...(dto.capacidadeMaxima !== undefined ? { capacidadeMaxima: dto.capacidadeMaxima } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      },
      include: { modalidade: true },
    });
  }

  async bloquear(id: string) {
    const h = await this.prisma.horario.findUnique({ where: { id } });
    if (!h) throw new NotFoundException('Horário não encontrado');
    return this.prisma.horario.update({ where: { id }, data: { ativo: !h.ativo } });
  }

  /**
   * Remove o horário de vez quando ele não deixa rastro (sem aulas no
   * histórico e sem aluno com horário fixo). Se tiver, apenas desativa — o
   * histórico do aluno não pode sumir junto.
   *
   * Antes isto era sempre `ativo: false`, então excluir um horário JÁ inativo
   * não fazia nada e ele ficava preso na lista para sempre.
   */
  async excluir(id: string) {
    const horario = await this.prisma.horario.findUnique({
      where: { id },
      include: { _count: { select: { agendamentos: true, horariosFixos: true } } },
    });
    if (!horario) throw new NotFoundException('Horário não encontrado');

    const { agendamentos, horariosFixos } = horario._count;
    if (agendamentos > 0 || horariosFixos > 0) {
      if (!horario.ativo) {
        const motivo = [
          agendamentos > 0 ? `${agendamentos} aula(s) no histórico` : null,
          horariosFixos > 0 ? `${horariosFixos} aluno(s) com horário fixo` : null,
        ]
          .filter(Boolean)
          .join(' e ');
        throw new ConflictException(
          `Este horário não pode ser excluído porque tem ${motivo}. Ele fica inativo para preservar o histórico.`,
        );
      }
      await this.prisma.horario.update({ where: { id }, data: { ativo: false } });
      return { mensagem: 'Horário desativado (tem histórico, por isso não foi apagado)' };
    }

    await this.prisma.horario.delete({ where: { id } });
    return { mensagem: 'Horário excluído' };
  }
}
