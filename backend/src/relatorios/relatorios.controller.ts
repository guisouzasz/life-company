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

    const DIAS = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'] as const;
    const hojeIdx = (dayjs() as any).isoWeekday(); // 1..7
    const diaHoje = hojeIdx <= 5 ? DIAS[hojeIdx - 1] : null; // fim de semana: sem aulas
    const inicioHoje = dayjs().startOf('day').toDate();
    const fimHoje = dayjs().endOf('day').toDate();

    const [totalAlunos, alunosAtivos, aulasSemana, presencas, faltas, agsSemana, horariosHoje] = await Promise.all([
      this.prisma.usuario.count({ where: { tipoUsuario: 'ALUNO' } }),
      this.prisma.usuario.count({ where: { tipoUsuario: 'ALUNO', ativo: true } }),
      this.prisma.agendamento.count({ where: { status: 'CONFIRMADO', dataAula: { gte: inicioSemana, lte: fimSemana } } }),
      this.prisma.presenca.count({ where: { compareceu: true, registradoEm: { gte: inicioSemana } } }),
      this.prisma.presenca.count({ where: { compareceu: false, registradoEm: { gte: inicioSemana } } }),
      // Agrupamos pelo diaSemana do horário (evita ambiguidade de fuso do dataAula)
      this.prisma.agendamento.findMany({
        where: { status: 'CONFIRMADO', dataAula: { gte: inicioSemana, lte: fimSemana } },
        select: { horario: { select: { diaSemana: true } } },
      }),
      diaHoje
        ? this.prisma.horario.findMany({
            where: { ativo: true, diaSemana: diaHoje },
            include: {
              modalidade: { select: { nome: true } },
              _count: { select: { agendamentos: { where: { status: 'CONFIRMADO', dataAula: { gte: inicioHoje, lte: fimHoje } } } } },
            },
            orderBy: { horaInicio: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    const ocupacao = aulasSemana > 0 ? Math.round((presencas / aulasSemana) * 100) : 0;
    const aulasPorDia = DIAS.map((dia) => ({
      dia,
      total: agsSemana.filter((a) => a.horario.diaSemana === dia).length,
    }));
    const aulasHoje = horariosHoje.map((h) => ({
      horarioId: h.id,
      horaInicio: h.horaInicio,
      horaFim: h.horaFim,
      modalidade: h.modalidade.nome,
      agendados: h._count.agendamentos,
      capacidade: h.capacidadeMaxima,
    }));

    return { totalAlunos, alunosAtivos, aulasSemana, presencas, faltas, ocupacao, aulasPorDia, aulasHoje };
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
