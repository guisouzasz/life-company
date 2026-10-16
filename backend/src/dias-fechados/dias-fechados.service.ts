import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { PrismaService } from '../prisma/prisma.service';
import { FecharDiaDto } from './dto/fechar-dia.dto';
import { validadeDoCreditoExtra } from '../creditos/credito-valido';

(dayjs as any).extend((isoWeek as any).default || isoWeek);

/**
 * Dias em que a academia não abre — feriado, recesso, manutenção.
 *
 * Feriado (Termo, seção 3): "faltas em dias de feriados não geram direito a
 * reposição". A aula sai da agenda, sem crédito, e continua contando na
 * cota da semana (não vira outro dia da mesma semana). Quem tinha marcado
 * REPOSIÇÃO nesse dia recebe o crédito de volta: pagou por uma aula que não
 * vai existir.
 *
 * Recesso de fim de ano (seção 4): igual, mas cada aula do plano que o aluno
 * teria no dia vira um crédito EXTRA — fora do limite de reposições e válido
 * no ano seguinte (creditos/credito-valido.ts).
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
    return dias.map((d) => ({ id: d.id, data: dayjs(d.data).format('YYYY-MM-DD'), motivo: d.motivo, recesso: d.recesso }));
  }

  async fechar(dto: FecharDiaDto) {
    const dia = dayjs(dto.data).startOf('day');
    if (!dia.isValid()) throw new BadRequestException('Data inválida');
    if (dia.isBefore(dayjs().startOf('day'))) {
      throw new BadRequestException('Esse dia já passou. Só dá para fechar de hoje em diante.');
    }
    if (dia.isoWeekday() > 5) throw new BadRequestException('A academia já não abre no fim de semana.');
    const recesso = dto.recesso === true;
    const motivo = dto.motivo?.trim() || (recesso ? 'Recesso de fim de ano' : 'Feriado');
    const data = dia.toDate();

    return this.prisma.$transaction(async (tx) => {
      /**
       * Trava as turmas — as mesmas linhas que a marcação e o cancelamento
       * travam primeiro. Uma aula marcada (ou cancelada) no meio do
       * fechamento ou acontece antes e o fechamento a vê, ou espera e vê o
       * dia já fechado. Sem isto, um aluno marcando bem na hora ficaria
       * agendado num dia fechado.
       */
      await tx.$queryRaw`SELECT id FROM horarios FOR UPDATE`;
      if (await tx.diaFechado.findUnique({ where: { data } })) {
        throw new ConflictException(`O dia ${dia.format('DD/MM')} já está fechado.`);
      }
      const fechado = await tx.diaFechado.create({ data: { data, motivo, recesso } });

      const doDia = await tx.agendamento.findMany({
        where: { dataAula: data, status: 'CONFIRMADO' },
        select: { id: true, usuarioId: true, reposicao: true, creditoId: true },
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

      /**
       * Quem já tinha cancelado uma aula deste dia, antes de o dia fechar.
       *
       * Cancelou no prazo com o dia aberto e ganhou o crédito — mas a aula
       * caiu num dia em que a academia não abre, e "faltas em dias de feriados
       * não geram direito a reposição" (termo, seção 3). Sem isto quem
       * cancelou antes ficava com crédito e quem não cancelou perdia a aula.
       * O crédito AINDA NÃO USADO sai, e a aula passa a contar como a dos
       * outros (dia fechado). O já usado não tem como voltar: a reposição foi
       * marcada — fica, e a dona fica sabendo pelo aviso.
       * Reabrir o dia devolve o crédito (é para isso o `diaFechadoId` nele).
       */
      const canceladasAntes = await tx.agendamento.findMany({
        where: { dataAula: data, status: 'CANCELADO', reposicao: false, diaFechadoId: null },
        select: { id: true, usuarioId: true },
      });
      const doAlunoAntes = canceladasAntes.length === 0
        ? []
        : await tx.creditoReposicao.findMany({
            where: { origemAgendamentoId: { in: canceladasAntes.map((a) => a.id) }, concedidoAdmin: false, revogado: false },
            select: { id: true, usado: true, origemAgendamentoId: true },
          });
      const retirados = doAlunoAntes.filter((c) => !c.usado);
      const jaUsados = doAlunoAntes.filter((c) => c.usado).length;
      if (retirados.length > 0) {
        await tx.creditoReposicao.updateMany({
          where: { id: { in: retirados.map((c) => c.id) }, usado: false },
          data: { revogado: true, diaFechadoId: fechado.id },
        });
        await tx.agendamento.updateMany({
          where: { id: { in: retirados.map((c) => c.origemAgendamentoId!) } },
          data: { diaFechadoId: fechado.id },
        });
      }

      /**
       * Recesso: cada aula do plano que o aluno teria no dia vira um crédito
       * extra (termo, seção 4) — inclusive a de quem tinha cancelado e
       * acabou de perder o crédito comum acima. É "concedido pelo estúdio"
       * para não contar na semana do aluno: a aula do dia fechado já conta.
       */
      let extras = 0;
      if (recesso) {
        const donoDa = new Map(canceladasAntes.map((a) => [a.id, a.usuarioId]));
        const aulas = [
          ...doDia.filter((a) => !a.reposicao).map((a) => ({ id: a.id, usuarioId: a.usuarioId })),
          ...retirados.map((c) => ({ id: c.origemAgendamentoId!, usuarioId: donoDa.get(c.origemAgendamentoId!)! })),
        ];
        const validade = validadeDoCreditoExtra(data);
        if (aulas.length > 0) {
          await tx.creditoReposicao.createMany({
            data: aulas.map((a) => ({
              usuarioId: a.usuarioId,
              origemAgendamentoId: a.id,
              extra: true,
              concedidoAdmin: true,
              diaFechadoId: fechado.id,
              ...validade,
            })),
          });
        }
        extras = aulas.length;
      }

      const aulasRetiradas = doDia.length;
      const partes = [`${aulasRetiradas} ${aulasRetiradas === 1 ? 'aula saiu' : 'aulas saíram'} da agenda`];
      if (creditos.length > 0) {
        partes.push(`${creditos.length} ${creditos.length === 1 ? 'crédito de reposição voltou' : 'créditos de reposição voltaram'} para os alunos`);
      }
      if (extras > 0) {
        partes.push(`${extras} ${extras === 1 ? 'crédito extra do recesso foi dado' : 'créditos extras do recesso foram dados'}`);
      }
      if (retirados.length > 0) {
        partes.push(
          `${retirados.length} ${retirados.length === 1 ? 'crédito de quem tinha cancelado aula deste dia saiu' : 'créditos de quem tinha cancelado aula deste dia saíram'}` +
            (recesso ? ' (viraram crédito extra)' : ' (feriado não gera reposição)'),
        );
      }
      const aviso = jaUsados > 0
        ? ` Atenção: ${jaUsados} ${jaUsados === 1 ? 'aluno já tinha usado' : 'alunos já tinham usado'} o crédito de uma aula deste dia — esse não dá para retirar.`
        : '';
      return {
        id: fechado.id,
        data: dia.format('YYYY-MM-DD'),
        motivo,
        recesso,
        aulasRetiradas,
        creditosDevolvidos: creditos.length,
        creditosExtras: extras,
        creditosRetirados: retirados.length,
        creditosJaUsados: jaUsados,
        mensagem: `Dia ${dia.format('DD/MM')} fechado (${motivo}). ${partes.join(', ')}.${aviso}`,
      };
    });
  }

  /**
   * Reabre o dia e desfaz o fechamento.
   *
   * - As aulas do plano que ele tinha tirado voltam (ninguém conseguiu marcar
   *   nada no dia enquanto ele esteve fechado, então as vagas estão lá).
   * - As reposições não voltam: o crédito delas já foi devolvido e pode até
   *   ter sido usado em outra aula.
   * - Quem tinha cancelado antes do fechamento recebe o crédito de volta, e a
   *   aula continua cancelada — foi escolha do aluno.
   * - Crédito extra do recesso ainda não usado sai; o já usado fica (a
   *   reposição foi marcada) e a dona fica sabendo.
   */
  async reabrir(id: string) {
    const dia = await this.prisma.diaFechado.findUnique({ where: { id } });
    if (!dia) throw new NotFoundException('Dia fechado não encontrado');
    if (dayjs(dia.data).isBefore(dayjs().startOf('day'))) {
      throw new BadRequestException('Esse dia já passou — não há o que reabrir.');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM horarios FOR UPDATE`;

      const retirados = await tx.creditoReposicao.findMany({
        where: { diaFechadoId: id, extra: false },
        select: { id: true, origemAgendamentoId: true },
      });
      const canceladasPeloAluno = retirados.map((c) => c.origemAgendamentoId).filter((x): x is string => !!x);
      if (retirados.length > 0) {
        await tx.creditoReposicao.updateMany({
          where: { id: { in: retirados.map((c) => c.id) } },
          data: { revogado: false, diaFechadoId: null },
        });
      }

      const extras = await tx.creditoReposicao.findMany({
        where: { diaFechadoId: id, extra: true },
        select: { id: true, usado: true },
      });
      const extrasUsados = extras.filter((c) => c.usado).length;
      if (extras.length > 0) {
        await tx.creditoReposicao.updateMany({
          where: { id: { in: extras.filter((c) => !c.usado).map((c) => c.id) } },
          data: { revogado: true },
        });
        await tx.creditoReposicao.updateMany({ where: { diaFechadoId: id }, data: { diaFechadoId: null } });
      }

      const { count } = await tx.agendamento.updateMany({
        where: { diaFechadoId: id, reposicao: false, usuario: { ativo: true }, id: { notIn: canceladasPeloAluno } },
        data: { status: 'CONFIRMADO', diaFechadoId: null },
      });
      await tx.agendamento.updateMany({ where: { diaFechadoId: id }, data: { diaFechadoId: null } });
      await tx.diaFechado.delete({ where: { id } });

      const partes = [`${count} ${count === 1 ? 'aula voltou' : 'aulas voltaram'} para a agenda`];
      if (retirados.length > 0) {
        partes.push(`${retirados.length} ${retirados.length === 1 ? 'crédito voltou' : 'créditos voltaram'} para quem tinha cancelado`);
      }
      const aviso = extrasUsados > 0
        ? ` Atenção: ${extrasUsados} ${extrasUsados === 1 ? 'crédito extra do recesso já tinha sido usado' : 'créditos extras do recesso já tinham sido usados'} e não ${extrasUsados === 1 ? 'foi retirado' : 'foram retirados'}.`
        : '';
      return {
        aulasDevolvidas: count,
        creditosDevolvidos: retirados.length,
        extrasJaUsados: extrasUsados,
        mensagem: `Dia ${dayjs(dia.data).format('DD/MM')} reaberto. ${partes.join(', ')}.${aviso}`,
      };
    });
  }
}
