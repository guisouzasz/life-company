import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { PrismaService } from '../prisma/prisma.service';
import { AgendamentosService } from '../agendamentos/agendamentos.service';

(dayjs as any).extend((isoWeek as any).default || isoWeek);

const DIA_MAP: Record<number, string> = { 1: 'SEGUNDA', 2: 'TERCA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA' };
const JANELA_DIAS = 14;

/**
 * O texto do erro, venha ele como string ou dentro do corpo da resposta.
 *
 * O limite semanal do estúdio é lançado com um objeto (traz também as aulas
 * que ocupam a semana, para a tela oferecer a troca). Lendo só `e.message`
 * dali sairia o nome da classe, e o aviso na tela da dona ficaria sem dizer
 * o que aconteceu.
 */
function mensagemDoErro(e: any): string {
  const corpo = e?.response ?? e;
  const m = corpo?.message ?? e?.message;
  if (Array.isArray(m)) return m.join(' ');
  return typeof m === 'string' ? m : 'Não foi possível marcar a aula.';
}

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
        /**
         * Não gera para quem a dona desativou.
         *
         * Desativar já remove os horários fixos, então em tese não sobra nada
         * para este filtro pegar — ele é a segunda tranca, para um fixo órfão
         * não voltar a encher a turma toda madrugada.
         *
         * O critério NÃO é só `ativo: false`: cadastro novo nasce inativo e só
         * vira ativo no primeiro acesso do aluno. Filtrar por `ativo` sozinho
         * pararia de gerar as aulas de quem a dona acabou de cadastrar — que é
         * o caminho mais comum do estúdio. Quem já tem senha E está inativo é
         * quem foi desativado de verdade.
         */
        NOT: { usuario: { ativo: false, senhaHash: { not: null } } },
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
    if (!fixo || !fixo.ativo) {
      return { criados: 0, ignorados: 0, erros: 0, motivos: [] as string[], datas: [] as string[] };
    }
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
    /**
     * As datas que realmente entraram. A tela precisa disto para dizer "marcado
     * em 28/08, 04/09 e 11/09": salvar o horário fixo e não dizer onde o aluno
     * caiu deixava a dona conferindo turma por turma na agenda — e concluindo
     * que não tinha funcionado quando a semana que ela estava olhando era
     * justamente a que não entrou.
     */
    const datas: string[] = [];

    for (let d = 0; d <= JANELA_DIAS; d++) {
      const dia = hoje.add(d, 'day');
      if (dia.isBefore(dayjs(fixo.dataInicio), 'day')) continue;
      if (fixo.dataFim && dia.isAfter(dayjs(fixo.dataFim), 'day')) continue;
      if (dia.isoWeekday() > 5) continue;
      if (DIA_MAP[dia.isoWeekday()] !== fixo.horario.diaSemana) continue;

      try {
        /**
         * Pelo caminho do ESTÚDIO, não pelo do aluno.
         *
         * Isto rodava por `criar()`, que é a rota do aluno se agendando, e
         * herdava as regras dele. A pior: "aula que já começou não se marca"
         * conta a HORA para o aluno e só o DIA para o estúdio. Resultado — a
         * dona fixava alguém na sexta 17h numa sexta de tarde, o horário fixo
         * era salvo, as sextas seguintes entravam, e a sexta DAQUELA semana
         * ficava vazia. Ela olhava a agenda, não via o aluno na turma, e
         * concluía que o sistema não estava fixando ninguém. Colocar o mesmo
         * aluno na mesma aula pela aba Agenda funcionava, porque aquela rota
         * já é a do estúdio.
         *
         * De quebra, o caminho do aluno revoga um crédito de reposição da
         * semana ao remarcar — regra que existe para o aluno não fabricar
         * crédito cancelando e remarcando. Quando é o estúdio montando o
         * horário fixo, aquilo só queimava um crédito legítimo em silêncio.
         */
        await this.agendamentosService.criarComoAdmin({
          usuarioId: fixo.usuarioId,
          horarioId: fixo.horarioId,
          dataAula: dia.format('YYYY-MM-DD'),
        });
        criados++;
        datas.push(dia.format('YYYY-MM-DD'));
      } catch (e) {
        if (e instanceof ConflictException) {
          ignorados++;
          continue;
        }
        erros++;
        const motivo = mensagemDoErro(e);
        if (motivo && !motivos.includes(motivo)) motivos.push(motivo);
        this.logger.warn(
          `Falha ao auto-agendar usuario=${fixo.usuarioId} horario=${fixo.horarioId} data=${dia.format('YYYY-MM-DD')}: ${motivo}`,
        );
      }
    }
    return { criados, ignorados, erros, motivos, datas };
  }
}
