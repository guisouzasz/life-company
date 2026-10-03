import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { PrismaService } from '../prisma/prisma.service';
import { FecharDiaDto } from './dto/fechar-dia.dto';

(dayjs as any).extend((isoWeek as any).default || isoWeek);

/**
 * Dias em que a academia não abre — feriado, recesso, manutenção.
 *
 * Regra do estúdio (escolhida pela dona): no dia fechado o aluno PERDE a
 * aula. Ela sai da agenda, não gera crédito de reposição (o termo é claro
 * quanto a feriado) e continua contando na cota da semana, então não vira
 * outro dia da mesma semana. Quem tinha marcado REPOSIÇÃO nesse dia recebe o
 * crédito de volta: ele pagou com um crédito por uma aula que não vai existir.
 */
@Injectable()
export class DiasFechadosService {
  constructor(private prisma: PrismaService) {}

  /** Dias fechados entre duas datas (inclusive), em YYYY-MM-DD. */
  async listar(de?: string, ate?: string) {
    const inicio = dayjs(de ?? undefined).startOf('day');
    const fim = ate ? dayjs(ate).endOf('day') : inicio.add(90, 'day').endOf('day');
    if (!inicio.isValid() || !fim.isValid()) throw new BadRequestException('Datas inválidas');
    const dias = await this.prisma.diaFechado.findMany({
      where: { data: { gte: inicio.toDate(), lte: fim.toDate() } },
      orderBy: { data: 'asc' },
    });
    return dias.map((d) => ({ id: d.id, data: dayjs(d.data).format('YYYY-MM-DD'), motivo: d.motivo }));
  }

  async fechar(dto: FecharDiaDto) {
    const dia = dayjs(dto.data).startOf('day');
    if (!dia.isValid()) throw new BadRequestException('Data inválida');
    if (dia.isBefore(dayjs().startOf('day'))) {
      throw new BadRequestException('Esse dia já passou. Só dá para fechar de hoje em diante.');
    }
    if (dia.isoWeekday() > 5) throw new BadRequestException('A academia já não abre no fim de semana.');
    const motivo = dto.motivo?.trim() || 'Feriado';
    const data = dia.toDate();

    return this.prisma.$transaction(async (tx) => {
      /**
       * Trava as turmas — as mesmas linhas que a marcação de aula trava. Uma
       * aula marcada no meio do fechamento ou entra antes (e sai junto com as
       * outras) ou espera e é recusada. Sem isto, um aluno marcando bem na
       * hora ficaria agendado num dia fechado.
       */
      await tx.$queryRaw`SELECT id FROM horarios FOR UPDATE`;
      if (await tx.diaFechado.findUnique({ where: { data } })) {
        throw new ConflictException(`O dia ${dia.format('DD/MM')} já está fechado.`);
      }
      const fechado = await tx.diaFechado.create({ data: { data, motivo } });

      const doDia = await tx.agendamento.findMany({
        where: { dataAula: data, status: 'CONFIRMADO' },
        select: { id: true, reposicao: true, creditoId: true },
      });
      if (doDia.length > 0) {
        await tx.agendamento.updateMany({
          where: { id: { in: doDia.map((a) => a.id) } },
          data: { status: 'CANCELADO', diaFechadoId: fechado.id },
        });
      }
      const creditos = doDia.filter((a) => a.reposicao && a.creditoId).map((a) => a.creditoId!);
      if (creditos.length > 0) {
        await tx.creditoReposicao.updateMany({
          where: { id: { in: creditos }, usado: true },
          data: { usado: false, usadoEm: null, usadoAgendamentoId: null },
        });
      }

      const aulas = doDia.length;
      const partes = [`${aulas} ${aulas === 1 ? 'aula saiu' : 'aulas saíram'} da agenda`];
      if (creditos.length > 0) {
        partes.push(`${creditos.length} ${creditos.length === 1 ? 'crédito de reposição voltou' : 'créditos de reposição voltaram'} para os alunos`);
      }
      return {
        id: fechado.id,
        data: dia.format('YYYY-MM-DD'),
        motivo,
        aulasRetiradas: aulas,
        creditosDevolvidos: creditos.length,
        mensagem: `Dia ${dia.format('DD/MM')} fechado (${motivo}). ${partes.join(' e ')}.`,
      };
    });
  }

  /**
   * Reabre o dia e devolve as aulas do plano que ele tinha tirado.
   *
   * Ninguém conseguiu marcar nada no dia enquanto ele esteve fechado, então
   * as vagas estão lá. As reposições não voltam: o crédito delas já foi
   * devolvido e pode até ter sido usado em outra aula.
   */
  async reabrir(id: string) {
    const dia = await this.prisma.diaFechado.findUnique({ where: { id } });
    if (!dia) throw new NotFoundException('Dia fechado não encontrado');
    if (dayjs(dia.data).isBefore(dayjs().startOf('day'))) {
      throw new BadRequestException('Esse dia já passou — não há o que reabrir.');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM horarios FOR UPDATE`;
      const { count } = await tx.agendamento.updateMany({
        where: { diaFechadoId: id, reposicao: false, usuario: { ativo: true } },
        data: { status: 'CONFIRMADO', diaFechadoId: null },
      });
      await tx.agendamento.updateMany({ where: { diaFechadoId: id }, data: { diaFechadoId: null } });
      await tx.diaFechado.delete({ where: { id } });
      return {
        aulasDevolvidas: count,
        mensagem: `Dia ${dayjs(dia.data).format('DD/MM')} reaberto. ${count} ${count === 1 ? 'aula voltou' : 'aulas voltaram'} para a agenda.`,
      };
    });
  }
}
