import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { PrismaService } from '../prisma/prisma.service';
import { AgendamentosService } from '../agendamentos/agendamentos.service';

dayjs.extend(isoWeek);

const DIA_MAP: Record<string, number> = {
  SEGUNDA: 1,
  TERCA: 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
};

const JANELA_DIAS = 14;

type ResultadoGeracao = {
  criados: number;
  ignorados: number;
  erros: number;
  motivos: string[];
  datas: string[];
};

type FixoParaGeracao = {
  usuarioId: string;
  horarioId: string;
  dataInicio: Date;
  dataFim: Date | null;
  horario: {
    diaSemana: string;
  };
};

function resultadoVazio(): ResultadoGeracao {
  return { criados: 0, ignorados: 0, erros: 0, motivos: [], datas: [] };
}

function acumularResultado(total: ResultadoGeracao, parcial: ResultadoGeracao) {
  total.criados += parcial.criados;
  total.ignorados += parcial.ignorados;
  total.erros += parcial.erros;

  for (const motivo of parcial.motivos) {
    if (!total.motivos.includes(motivo)) total.motivos.push(motivo);
  }

  for (const data of parcial.datas) {
    if (!total.datas.includes(data)) total.datas.push(data);
  }
}

@Injectable()
export class AutoAgendamentoService {
  private readonly logger = new Logger(AutoAgendamentoService.name);

  constructor(
    private prisma: PrismaService,
    private agendamentosService: AgendamentosService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async gerarAgendamentosFixos() {
    const hoje = dayjs().startOf('day');
    const fimJanela = hoje.add(JANELA_DIAS, 'day');
    const total = await this.gerarAgendamentosFixosNoPeriodo(
      hoje.toDate(),
      fimJanela.toDate(),
    );

    this.logger.log(
      `Auto-agendamento fixo concluido: ${total.criados} criados, ${total.ignorados} ignorados, ${total.erros} erros`,
    );

    return total;
  }

  async gerarAgendamentosFixosNoPeriodo(
    inicio: Date,
    fim: Date,
  ): Promise<ResultadoGeracao> {
    const inicioPeriodo = dayjs(inicio).startOf('day');
    const fimPeriodo = dayjs(fim).endOf('day');
    const total = resultadoVazio();

    if (fimPeriodo.isBefore(inicioPeriodo, 'day')) return total;

    const fixos = await this.prisma.horarioFixo.findMany({
      where: {
        ativo: true,
        dataInicio: { lte: fimPeriodo.toDate() },
        OR: [{ dataFim: null }, { dataFim: { gte: inicioPeriodo.toDate() } }],
      },
      include: { horario: true },
    });

    for (const fixo of fixos) {
      const resultado = await this.gerarParaFixo(
        fixo,
        inicioPeriodo,
        fimPeriodo,
      );
      acumularResultado(total, resultado);
    }

    if (total.erros > 0) {
      this.logger.warn(
        `Auto-agendamento fixo do periodo ${inicioPeriodo.format('YYYY-MM-DD')} a ${fimPeriodo.format('YYYY-MM-DD')} concluiu com ${total.erros} erros`,
      );
    }

    return total;
  }

  async gerarParaHorarioFixoId(id: string) {
    const fixo = await this.prisma.horarioFixo.findUnique({
      where: { id },
      include: { horario: true },
    });

    if (!fixo || !fixo.ativo) {
      return resultadoVazio();
    }

    const hoje = dayjs().startOf('day');
    const fimJanela = hoje.add(JANELA_DIAS, 'day');

    return this.gerarParaFixo(fixo, hoje, fimJanela);
  }

  private async gerarParaFixo(
    fixo: FixoParaGeracao,
    inicioPeriodo = dayjs().startOf('day'),
    fimPeriodo = dayjs().startOf('day').add(JANELA_DIAS, 'day'),
  ): Promise<ResultadoGeracao> {
    const resultado = resultadoVazio();
    const dataInicio = dayjs(fixo.dataInicio).startOf('day');
    const dataFim = fixo.dataFim ? dayjs(fixo.dataFim).endOf('day') : null;
    const diaSemanaFixo = DIA_MAP[fixo.horario.diaSemana];

    if (!diaSemanaFixo) return resultado;

    for (
      let dia = inicioPeriodo.startOf('day');
      !dia.isAfter(fimPeriodo, 'day');
      dia = dia.add(1, 'day')
    ) {
      if (dia.isBefore(dataInicio, 'day')) continue;
      if (dataFim && dia.isAfter(dataFim, 'day')) continue;
      if (dia.day() === 0 || dia.day() === 6) continue;
      if (dia.isoWeekday() !== diaSemanaFixo) continue;

      const dataAula = dia.format('YYYY-MM-DD');

      try {
        await this.agendamentosService.criarComoAdmin({
          usuarioId: fixo.usuarioId,
          horarioId: fixo.horarioId,
          dataAula,
        });
        resultado.criados++;
        resultado.datas.push(dataAula);
      } catch (error) {
        if (error instanceof ConflictException) {
          resultado.ignorados++;
          resultado.motivos.push(error.message);
          continue;
        }

        resultado.erros++;
        const message =
          error instanceof Error ? error.message : 'Erro desconhecido';
        resultado.motivos.push(message);
        this.logger.warn(
          `Falha ao gerar agendamento fixo ${fixo.usuarioId}/${fixo.horarioId}/${dataAula}: ${message}`,
        );
      }
    }

    return resultado;
  }
}
