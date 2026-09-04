import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { PrismaService } from '../prisma/prisma.service';
import { AgendamentosService } from '../agendamentos/agendamentos.service';

(dayjs as any).extend((isoWeek as any).default || isoWeek);

const DIA_MAP: Record<number, string> = { 1: 'SEGUNDA', 2: 'TERCA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA' };

/**
 * Até onde as aulas do horário fixo já ficam criadas.
 *
 * O horário fixo em si não tem prazo: enquanto estiver ativo e sem `dataFim`,
 * ele vale para sempre. Isto aqui é só até onde as aulas ficam PRONTAS no
 * banco antes de alguém pedir.
 *
 * Eram 14 dias, e duas semanas é pouco para quem paga mensalidade: o aluno
 * abria o app, via duas aulas e concluía que a combinação dele tinha prazo de
 * validade. Oito semanas cobrem o mês inteiro e o seguinte, que é o horizonte
 * em que o estúdio pensa.
 *
 * Não precisa ser infinito, e não deve: cada aula criada é uma vaga ocupada de
 * verdade. Materializar um ano à frente deixaria todas as turmas lotadas até
 * 2027 e a dona sem conseguir encaixar ninguém. O cron das 3h empurra a janela
 * um dia por vez, então na prática ela nunca acaba — e a agenda da semana
 * materializa sob demanda quando a dona navega para além disto.
 */
const JANELA_DIAS = 56;

type ResultadoGeracao = {
  criados: number;
  ignorados: number;
  erros: number;
  motivos: string[];
  datas: string[];
};

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

function resultadoVazio(): ResultadoGeracao {
  return { criados: 0, ignorados: 0, erros: 0, motivos: [], datas: [] };
}

function somarResultado(total: ResultadoGeracao, parcial: ResultadoGeracao) {
  total.criados += parcial.criados;
  total.ignorados += parcial.ignorados;
  total.erros += parcial.erros;

  for (const motivo of parcial.motivos) {
    if (motivo && !total.motivos.includes(motivo)) total.motivos.push(motivo);
  }

  for (const data of parcial.datas) {
    if (data && !total.datas.includes(data)) total.datas.push(data);
  }
}

function chaveAgendamento(usuarioId: string, horarioId: string, dataAula: Date | string) {
  return `${usuarioId}|${horarioId}|${dayjs(dataAula).format('YYYY-MM-DD')}`;
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
    const total = await this.gerarAgendamentosFixosNoPeriodo(hoje.toDate(), fimJanela.toDate());

    this.logger.log(`Auto-agendamento: ${total.criados} criados, ${total.ignorados} já existentes, ${total.erros} falhas`);
    return total;
  }

  async gerarAgendamentosFixosNoPeriodo(inicio: Date, fim: Date): Promise<ResultadoGeracao> {
    const inicioPeriodo = dayjs(inicio).startOf('day');
    const fimPeriodo = dayjs(fim).endOf('day');
    const total = resultadoVazio();

    if (fimPeriodo.isBefore(inicioPeriodo, 'day')) return total;

    const fixos = await this.prisma.horarioFixo.findMany({
      where: {
        ativo: true,
        dataInicio: { lte: fimPeriodo.toDate() },
        OR: [{ dataFim: null }, { dataFim: { gte: inicioPeriodo.toDate() } }],
        /**
         * Não gera para quem a dona desativou.
         *
         * Desativar já remove os horários fixos, então em tese não sobra nada
         * para este filtro pegar — ele é a segunda tranca, para um fixo órfão
         * não voltar a encher a turma.
         *
         * Ficou mais importante desde que a agenda materializa os fixos da
         * semana ao ser aberta: sem o filtro, cada visita à agenda recria as
         * aulas de quem já saiu do estúdio — o mesmo estrago de antes, só que
         * a cada abertura de tela em vez de uma vez por madrugada.
         *
         * O critério é só `ativo`, e agora pode ser: o campo quer dizer uma
         * coisa só — a pessoa treina aqui. Cadastro novo nasce treinando, e
         * "já fez o primeiro acesso" é `senhaHash != null`, que é outra
         * pergunta. Antes os dois viviam no mesmo booleano e o filtro
         * precisava de duas partes para não derrubar quem tinha acabado de
         * ser cadastrado.
         */
        usuario: { ativo: true },
      },
      include: { horario: true },
    });

    if (fixos.length === 0) return total;

    const existentes = await this.prisma.agendamento.findMany({
      where: {
        status: 'CONFIRMADO',
        dataAula: { gte: inicioPeriodo.toDate(), lte: fimPeriodo.toDate() },
        OR: fixos.map((fixo) => ({
          usuarioId: fixo.usuarioId,
          horarioId: fixo.horarioId,
        })),
      },
      select: { usuarioId: true, horarioId: true, dataAula: true },
    });
    const jaConfirmados = new Set(
      existentes.map((agendamento) =>
        chaveAgendamento(
          agendamento.usuarioId,
          agendamento.horarioId,
          agendamento.dataAula,
        ),
      ),
    );

    for (const fixo of fixos) {
      const r = await this.gerarParaFixo(
        fixo,
        inicioPeriodo,
        fimPeriodo,
        jaConfirmados,
      );
      somarResultado(total, r);
    }

    return total;
  }

  /** Gera imediatamente os agendamentos de UM horário fixo (usado ao criar/reativar). */
  async gerarParaHorarioFixoId(horarioFixoId: string) {
    const fixo = await this.prisma.horarioFixo.findUnique({
      where: { id: horarioFixoId },
      include: { horario: true },
    });
    if (!fixo || !fixo.ativo) {
      return resultadoVazio();
    }
    return this.gerarParaFixo(fixo);
  }

  private async gerarParaFixo(
    fixo: {
      usuarioId: string;
      horarioId: string;
      dataInicio: Date;
      dataFim: Date | null;
      horario: { diaSemana: string };
    },
    inicioPeriodo = dayjs().startOf('day'),
    fimPeriodo = inicioPeriodo.add(JANELA_DIAS, 'day'),
    jaConfirmados = new Set<string>(),
  ) {
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

    for (
      let dia = inicioPeriodo.startOf('day');
      !dia.isAfter(fimPeriodo, 'day');
      dia = dia.add(1, 'day')
    ) {
      if (dia.isBefore(dayjs(fixo.dataInicio), 'day')) continue;
      if (fixo.dataFim && dia.isAfter(dayjs(fixo.dataFim), 'day')) continue;
      if (dia.isoWeekday() > 5) continue;
      if (DIA_MAP[dia.isoWeekday()] !== fixo.horario.diaSemana) continue;

      const dataAula = dia.format('YYYY-MM-DD');
      const chave = chaveAgendamento(fixo.usuarioId, fixo.horarioId, dataAula);
      if (jaConfirmados.has(chave)) {
        ignorados++;
        continue;
      }

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
          dataAula,
        });
        criados++;
        datas.push(dataAula);
        jaConfirmados.add(chave);
      } catch (e) {
        if (e instanceof ConflictException) {
          ignorados++;
          continue;
        }
        erros++;
        const motivo = mensagemDoErro(e);
        if (motivo && !motivos.includes(motivo)) motivos.push(motivo);
        this.logger.warn(
          `Falha ao auto-agendar usuario=${fixo.usuarioId} horario=${fixo.horarioId} data=${dataAula}: ${motivo}`,
        );
      }
    }
    return { criados, ignorados, erros, motivos, datas };
  }
}
