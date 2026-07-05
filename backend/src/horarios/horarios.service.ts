import { Injectable, NotFoundException } from '@nestjs/common';
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

  async listarComVagas(modalidadeId: string, dataAula: string) {
    const data = new Date(dataAula);
    const horarios = await this.prisma.horario.findMany({
      where: { ativo: true, modalidadeId },
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

  async excluir(id: string) {
    await this.prisma.horario.update({ where: { id }, data: { ativo: false } });
    return { mensagem: 'Horário desativado' };
  }
}
