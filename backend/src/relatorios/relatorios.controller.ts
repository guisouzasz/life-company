import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';

(dayjs as any).extend((isoWeek as any).default || isoWeek);

@ApiTags('relatorios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('relatorios')
export class RelatoriosController {
  constructor(private prisma: PrismaService) {}

  @Get('dashboard')
  async dashboard() {
    const inicioSemana = dayjs().startOf('isoWeek').toDate();
    const fimSemana = dayjs().endOf('isoWeek').toDate();
    const [totalAlunos, alunosAtivos, aulasSemana, presencas, faltas] = await Promise.all([
      this.prisma.usuario.count({ where: { tipoUsuario: 'ALUNO' } }),
      this.prisma.usuario.count({ where: { tipoUsuario: 'ALUNO', ativo: true } }),
      this.prisma.agendamento.count({ where: { status: 'CONFIRMADO', dataAula: { gte: inicioSemana, lte: fimSemana } } }),
      this.prisma.presenca.count({ where: { compareceu: true, registradoEm: { gte: inicioSemana } } }),
      this.prisma.presenca.count({ where: { compareceu: false, registradoEm: { gte: inicioSemana } } }),
    ]);
    const ocupacao = aulasSemana > 0 ? Math.round((presencas / aulasSemana) * 100) : 0;
    return { totalAlunos, alunosAtivos, aulasSemana, presencas, faltas, ocupacao };
  }

  @Get('frequencia')
  async frequencia() {
    return this.prisma.usuario.findMany({
      where: { tipoUsuario: 'ALUNO', ativo: true },
      select: {
        id: true, nome: true,
        agendamentos: { where: { status: 'CONFIRMADO' }, include: { presenca: true }, orderBy: { dataAula: 'desc' }, take: 20 },
        usuarioPlanos: { include: { plano: true, modalidade: true }, where: { vigenciaFim: null } },
      },
    });
  }
}
