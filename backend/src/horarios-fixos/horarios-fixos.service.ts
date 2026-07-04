import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CriarHorarioFixoDto } from './dto/criar-horario-fixo.dto';

@Injectable()
export class HorariosFixosService {
  constructor(private prisma: PrismaService) {}

  async listarDoAluno(usuarioId: string) {
    return this.prisma.horarioFixo.findMany({
      where: { usuarioId, ativo: true },
      include: { horario: { include: { modalidade: true } } },
      orderBy: [{ horario: { diaSemana: 'asc' } }, { horario: { horaInicio: 'asc' } }],
    });
  }

  async criar(usuarioId: string, dto: CriarHorarioFixoDto) {
    const usuarioPlano = await this.prisma.usuarioPlano.findFirst({
      where: { usuarioId, vigenciaFim: null },
      include: { plano: true },
    });
    if (!usuarioPlano) throw new ForbiddenException('Aluno não possui plano ativo');

    const horario = await this.prisma.horario.findUnique({ where: { id: dto.horarioId } });
    if (!horario || !horario.ativo) throw new NotFoundException('Horário não encontrado ou inativo');

    const existente = await this.prisma.horarioFixo.findUnique({
      where: { usuarioId_horarioId: { usuarioId, horarioId: dto.horarioId } },
    });

    if (!existente || !existente.ativo) {
      const ativosCount = await this.prisma.horarioFixo.count({ where: { usuarioId, ativo: true } });
      if (ativosCount >= usuarioPlano.plano.aulasSemanais) {
        throw new BadRequestException(
          `Limite de horários fixos atingido (${usuarioPlano.plano.aulasSemanais}x/semana no plano ${usuarioPlano.plano.nome})`,
        );
      }
    }

    const dataInicio = dto.dataInicio ? new Date(dto.dataInicio) : new Date();
    const dataFim = dto.dataFim ? new Date(dto.dataFim) : null;

    if (existente) {
      return this.prisma.horarioFixo.update({
        where: { id: existente.id },
        data: { ativo: true, dataInicio, dataFim },
        include: { horario: { include: { modalidade: true } } },
      });
    }
    return this.prisma.horarioFixo.create({
      data: { usuarioId, horarioId: dto.horarioId, dataInicio, dataFim },
      include: { horario: { include: { modalidade: true } } },
    });
  }

  async remover(id: string) {
    const hf = await this.prisma.horarioFixo.findUnique({ where: { id } });
    if (!hf) throw new NotFoundException('Horário fixo não encontrado');
    await this.prisma.horarioFixo.update({ where: { id }, data: { ativo: false } });
    return { mensagem: 'Horário fixo removido' };
  }
}
