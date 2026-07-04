import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { PrismaService } from '../prisma/prisma.service';
import { AgendamentosService } from '../agendamentos/agendamentos.service';

(dayjs as any).extend((isoWeek as any).default || isoWeek);

const DIA_MAP: Record<number, string> = { 1: 'SEGUNDA', 2: 'TERCA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA' };
const JANELA_DIAS = 14;

@Injectable()
export class AutoAgendamentoService {
  private readonly logger = new Logger(AutoAgendamentoService.name);

  constructor(
    private prisma: PrismaService,
    private agendamentosService: AgendamentosService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async gerarAgendamentosFixos() {
    const hoje = dayjs().startOf('day');
    const fimJanela = hoje.add(JANELA_DIAS, 'day');

    const fixos = await this.prisma.horarioFixo.findMany({
      where: {
        ativo: true,
        dataInicio: { lte: fimJanela.toDate() },
        OR: [{ dataFim: null }, { dataFim: { gte: hoje.toDate() } }],
      },
      include: { horario: true },
    });

    let criados = 0;
    let ignorados = 0;
    let erros = 0;

    for (const fixo of fixos) {
      for (let d = 0; d <= JANELA_DIAS; d++) {
        const dia = hoje.add(d, 'day');
        if (dia.isBefore(dayjs(fixo.dataInicio), 'day')) continue;
        if (fixo.dataFim && dia.isAfter(dayjs(fixo.dataFim), 'day')) continue;
        if (dia.isoWeekday() > 5) continue;
        if (DIA_MAP[dia.isoWeekday()] !== fixo.horario.diaSemana) continue;

        try {
          await this.agendamentosService.criar(fixo.usuarioId, {
            horarioId: fixo.horarioId,
            dataAula: dia.format('YYYY-MM-DD'),
          });
          criados++;
        } catch (e) {
          if (e instanceof ConflictException) {
            ignorados++;
            continue;
          }
          erros++;
          this.logger.warn(
            `Falha ao auto-agendar usuario=${fixo.usuarioId} horario=${fixo.horarioId} data=${dia.format('YYYY-MM-DD')}: ${e.message}`,
          );
        }
      }
    }

    this.logger.log(`Auto-agendamento: ${criados} criados, ${ignorados} já existentes, ${erros} falhas`);
    return { criados, ignorados, erros };
  }
}
