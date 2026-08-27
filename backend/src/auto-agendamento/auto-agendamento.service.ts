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

    const total = { criados: 0, ignorados: 0, erros: 0 };
    for (const fixo of fixos) {
      const r = await this.gerarParaFixo(fixo);
      total.criados += r.criados;
      total.ignorados += r.ignorados;
      total.erros += r.erros;
    }

    this.logger.log(`Auto-agendamento: ${total.criados} criados, ${total.ignorados} já existentes, ${total.erros} falhas`);
    return total;
  }

  /** Gera imediatamente os agendamentos de UM horário fixo (usado ao criar/reativar). */
  async gerarParaHorarioFixoId(horarioFixoId: string) {
    const fixo = await this.prisma.horarioFixo.findUnique({
      where: { id: horarioFixoId },
      include: { horario: true },
    });
    if (!fixo || !fixo.ativo) return { criados: 0, ignorados: 0, erros: 0, motivos: [] as string[] };
    return this.gerarParaFixo(fixo);
  }

  private async gerarParaFixo(fixo: {
    usuarioId: string;
    horarioId: string;
    dataInicio: Date;
    dataFim: Date | null;
    horario: { diaSemana: string };
  }) {
    const hoje = dayjs().startOf('day');
    let criados = 0;
    let ignorados = 0;
    let erros = 0;
    /**
     * Por que não deu para marcar. Sem isto, a falha virava só um número e a
     * dona via o horário fixo criado achando que o aluno estava agendado —
     * quando na verdade a turma estava cheia ou a semana dele já tinha
     * acabado. Guardamos o motivo uma vez só: repetir "Horário lotado"
     * quatro vezes não ajuda ninguém.
     */
    const motivos: string[] = [];

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
        if (e?.message && !motivos.includes(e.message)) motivos.push(e.message);
        this.logger.warn(
          `Falha ao auto-agendar usuario=${fixo.usuarioId} horario=${fixo.horarioId} data=${dia.format('YYYY-MM-DD')}: ${e.message}`,
        );
      }
    }
    return { criados, ignorados, erros, motivos };
  }
}
