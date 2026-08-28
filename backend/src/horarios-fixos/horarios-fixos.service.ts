import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { AutoAgendamentoService } from '../auto-agendamento/auto-agendamento.service';
import { CriarHorarioFixoDto } from './dto/criar-horario-fixo.dto';

@Injectable()
export class HorariosFixosService {
  constructor(
    private prisma: PrismaService,
    private autoAgendamento: AutoAgendamentoService,
  ) {}

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

    const fixo = existente
      ? await this.prisma.horarioFixo.update({
          where: { id: existente.id },
          data: { ativo: true, dataInicio, dataFim },
          include: { horario: { include: { modalidade: true } } },
        })
      : await this.prisma.horarioFixo.create({
          data: { usuarioId, horarioId: dto.horarioId, dataInicio, dataFim },
          include: { horario: { include: { modalidade: true } } },
        });

    // Gera as próximas aulas na hora — sem esperar o cron das 3h. Falha na
    // geração (ex: sem saldo na semana) não desfaz o horário fixo criado.
    let geracao: { criados: number; ignorados: number; erros: number; motivos: string[]; datas: string[] } = {
      criados: 0, ignorados: 0, erros: 0, motivos: [], datas: [],
    };
    try {
      geracao = await this.autoAgendamento.gerarParaHorarioFixoId(fixo.id);
    } catch {
      // cron diário cobre depois
    }

    return { ...fixo, geracao };
  }

  /**
   * Remove o horário fixo E cancela as aulas futuras que ele já tinha criado.
   *
   * Antes só desligava o fixo. As aulas geradas continuavam de pé por até
   * duas semanas: o cadastro do aluno mostrava a combinação nova e a agenda
   * mostrava a antiga, com ele ocupando vaga numa turma de onde tinha
   * saído. Foi assim que um aluno remanejado para a sexta às 17h continuou
   * aparecendo na quinta às 19h.
   *
   * Só as futuras: aula que já aconteceu é histórico e não se apaga. E não
   * gera crédito — quem está remanejando é o estúdio, não o aluno desmarcando.
   */
  async remover(id: string) {
    const hf = await this.prisma.horarioFixo.findUnique({ where: { id } });
    if (!hf) throw new NotFoundException('Horário fixo não encontrado');

    const { count } = await this.prisma.agendamento.updateMany({
      where: {
        usuarioId: hf.usuarioId,
        horarioId: hf.horarioId,
        status: 'CONFIRMADO',
        dataAula: { gte: dayjs().startOf('day').toDate() },
      },
      data: { status: 'CANCELADO' },
    });

    await this.prisma.horarioFixo.update({ where: { id }, data: { ativo: false } });
    return {
      mensagem:
        count > 0
          ? `Horário fixo removido e ${count} aula(s) futura(s) cancelada(s).`
          : 'Horário fixo removido.',
      aulasCanceladas: count,
    };
  }
}
