import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { CriarHorarioDto } from './dto/criar-horario.dto';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { calcularCapacidadeEfetiva } from '../common/capacidade';
import { AutoAgendamentoService } from '../auto-agendamento/auto-agendamento.service';

dayjs.extend(isoWeek);

@Injectable()
export class HorariosService {
  constructor(
    private prisma: PrismaService,
    private autoAgendamento: AutoAgendamentoService,
  ) {}

  async criar(dto: CriarHorarioDto) {
    return this.prisma.horario.create({ data: dto });
  }

  async listar() {
    return this.prisma.horario.findMany({
      where: { ativo: true },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  async listarSemana(inicio?: string) {
    const base = inicio ? dayjs(inicio) : dayjs();
    const segunda = base.isoWeekday(1).startOf('day');
    const sexta = segunda.add(4, 'day');
    const dias = Array.from({ length: 5 }, (_, idx) =>
      segunda.add(idx, 'day'),
    );

    await this.autoAgendamento.gerarAgendamentosFixosNoPeriodo(
      segunda.toDate(),
      sexta.endOf('day').toDate(),
    );

    const [horarios, agendamentos] = await Promise.all([
      this.prisma.horario.findMany({
        where: { ativo: true },
        orderBy: [{ horaInicio: 'asc' }, { diaSemana: 'asc' }],
      }),
      this.prisma.agendamento.findMany({
        where: {
          status: 'CONFIRMADO',
          dataAula: {
            gte: segunda.toDate(),
            lte: sexta.endOf('day').toDate(),
          },
        },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              telefone: true,
              status: true,
              planoAtivo: { include: { plano: true } },
            },
          },
          horario: true,
        },
      }),
    ]);

    const horariosAtivos = horarios.filter((horario) => {
      const capacidade = calcularCapacidadeEfetiva(horario.capacidadeMaxima);
      return capacidade > 0;
    });

    const agrupado = new Map<string, typeof agendamentos>();
    for (const agendamento of agendamentos) {
      const data = dayjs(agendamento.dataAula).format('YYYY-MM-DD');
      const chave = `${agendamento.horarioId}|${data}`;
      const lista = agrupado.get(chave) ?? [];
      lista.push(agendamento);
      agrupado.set(chave, lista);
    }

    return dias.map((dia) => {
      const data = dia.format('YYYY-MM-DD');
      return {
        data,
        diaSemana: dia.isoWeekday(),
        horarios: horariosAtivos
          .filter((horario) => {
            const diaHorario = this.mapDiaSemana(horario.diaSemana);
            return diaHorario === dia.isoWeekday();
          })
          .map((horario) => {
            const ags = agrupado.get(`${horario.id}|${data}`) ?? [];
            const capacidade = calcularCapacidadeEfetiva(
              horario.capacidadeMaxima,
            );
            return {
              horarioId: horario.id,
              horaInicio: horario.horaInicio,
              horaFim: horario.horaFim,
              capacidadeMaxima: capacidade,
              modalidade: horario.modalidade,
              alunos: ags.map((agendamento) => ({
                agendamentoId: agendamento.id,
                usuarioId: agendamento.usuarioId,
                nome: agendamento.usuario.nome,
                telefone: agendamento.usuario.telefone,
                status: agendamento.usuario.status,
                plano: agendamento.usuario.planoAtivo?.plano.nome ?? null,
              })),
              vagasDisponiveis: Math.max(capacidade - ags.length, 0),
            };
          }),
      };
    });
  }

  async atualizar(id: string, dto: CriarHorarioDto) {
    const horario = await this.prisma.horario.findUnique({ where: { id } });
    if (!horario) throw new NotFoundException('Horario nao encontrado');

    const capacidadeNova = calcularCapacidadeEfetiva(dto.capacidadeMaxima);

    if (capacidadeNova > 0) {
      const conflitoOcupacao = await this.prisma.agendamento.findFirst({
        where: {
          horarioId: id,
          status: 'CONFIRMADO',
          dataAula: { gte: dayjs().startOf('day').toDate() },
        },
        groupBy: ['dataAula'],
        having: { id: { _count: { gt: capacidadeNova } } },
      } as never);

      if (conflitoOcupacao) {
        throw new ConflictException(
          'Existem dias futuros com mais alunos do que a nova capacidade permite.',
        );
      }
    }

    return this.prisma.horario.update({ where: { id }, data: dto });
  }

  async remover(id: string) {
    const hoje = dayjs().startOf('day').toDate();
    const futuros = await this.prisma.agendamento.count({
      where: { horarioId: id, status: 'CONFIRMADO', dataAula: { gte: hoje } },
    });

    if (futuros > 0) {
      throw new ConflictException(
        'Nao e possivel remover um horario com agendamentos futuros.',
      );
    }

    return this.prisma.horario.update({
      where: { id },
      data: { ativo: false },
    });
  }

  private mapDiaSemana(dia: string) {
    const mapa: Record<string, number> = {
      SEGUNDA: 1,
      TERCA: 2,
      QUARTA: 3,
      QUINTA: 4,
      SEXTA: 5,
    };
    return mapa[dia] ?? 0;
  }
}
