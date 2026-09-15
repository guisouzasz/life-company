import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { AutoAgendamentoService } from '../auto-agendamento/auto-agendamento.service';
import { CriarHorarioFixoDto } from './dto/criar-horario-fixo.dto';
import { nomeCurto } from '../comum/nome';
import { capacidadeEfetiva } from '../horarios/capacidade';

function temErroDeLotacao(motivos: string[]) {
  return motivos.some((motivo) => /lotad|cheio/i.test(motivo));
}

const DIA_LEGIVEL: Record<string, string> = {
  SEGUNDA: 'segunda', TERCA: 'terça', QUARTA: 'quarta', QUINTA: 'quinta', SEXTA: 'sexta',
};

/** "quarta às 08:00", para a recusa dizer de qual turma está falando. */
const apelidoDaTurma = (diaSemana: string, horaInicio: string) =>
  `${DIA_LEGIVEL[diaSemana] ?? diaSemana.toLowerCase()} às ${horaInicio}`;

@Injectable()
export class HorariosFixosService {
  private readonly logger = new Logger(HorariosFixosService.name);
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
    /**
     * Aluno desativado não entra em turma.
     *
     * Desativar já tira a pessoa dos horários fixos, mas nada impedia de
     * colocá-la de volta depois — e aí ela voltava a ocupar vaga sem treinar,
     * que é exatamente o buraco que enchia as turmas do estúdio. Melhor
     * recusar com um aviso do que deixar a vaga sumir em silêncio.
     *
     * Basta olhar `ativo`: o campo quer dizer só "treina aqui". Quem a dona
     * acabou de cadastrar já nasce treinando, então continua podendo entrar
     * na turma antes de abrir o app pela primeira vez.
     */
    const aluno = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nome: true, ativo: true, senhaHash: true },
    });
    if (!aluno) throw new NotFoundException('Aluno não encontrado');
    if (!aluno.ativo) {
      throw new BadRequestException(
        `${nomeCurto(aluno.nome)} está marcado como "não treina mais". ` +
          'Marque como treinando antes de colocar num horário fixo.',
      );
    }

    const usuarioPlano = await this.prisma.usuarioPlano.findFirst({
      where: { usuarioId, vigenciaFim: null },
      include: { plano: true },
    });
    if (!usuarioPlano) throw new ForbiddenException('Aluno não possui plano ativo');

    const horario = await this.prisma.horario.findUnique({ where: { id: dto.horarioId } });
    if (!horario || !horario.ativo) throw new NotFoundException('Horário não encontrado ou inativo');

    const dataInicio = dayjs(dto.dataInicio).startOf('day').toDate();
    const dataFim = dto.dataFim ? dayjs(dto.dataFim).endOf('day').toDate() : null;
    if (dataFim && dataFim < dataInicio) {
      throw new BadRequestException('A data final não pode ser anterior à data inicial');
    }

    /**
     * Contar os fixos e gravar o novo tem que ser uma coisa só.
     *
     * Sem a trava, dois envios quase simultâneos — dois toques no "+", ou o app
     * reenviando numa conexão ruim — liam os dois a MESMA contagem e ambos
     * passavam: um aluno de plano 1x ficava com dois horários fixos ativos. A
     * cota semanal ainda segurava as aulas, então o estrago aparecia depois e
     * sem explicação: toda semana o cron gerava por um dos fixos e falhava no
     * outro, e qual dia ganhava era sorteio. A trava é no plano do aluno,
     * mesma linha que o agendamento já usa, então dois alunos diferentes não
     * esperam um pelo outro.
     *
     * A geração das aulas fica FORA daqui de propósito: ela abre transação
     * própria e tranca esta mesma linha do plano.
     */
    const { registro: fixo, jaEstavaAtivo } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM horarios WHERE id = ${dto.horarioId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM usuario_planos WHERE id = ${usuarioPlano.id} FOR UPDATE`;
      const turmaAtual = await tx.horario.findUnique({
        where: { id: dto.horarioId },
        include: { modalidade: true },
      });
      if (!turmaAtual?.ativo) throw new BadRequestException('Turma desligada. Escolha uma turma ativa.');
      const planoAtual = await tx.usuarioPlano.findUnique({ where: { id: usuarioPlano.id } });
      if (!planoAtual || planoAtual.vigenciaFim) {
        throw new BadRequestException('O plano mudou durante a operação. Confira o plano e tente novamente.');
      }

      const existente = await tx.horarioFixo.findUnique({
        where: { usuarioId_horarioId: { usuarioId, horarioId: dto.horarioId } },
      });
      const jaEstavaAtivo = !!existente?.ativo;

      if (!existente || !existente.ativo) {
        const ativosCount = await tx.horarioFixo.count({ where: { usuarioId, ativo: true } });
        if (ativosCount >= usuarioPlano.plano.aulasSemanais) {
          throw new BadRequestException(
            `Limite de horários fixos atingido (${usuarioPlano.plano.aulasSemanais}x/semana no plano ${usuarioPlano.plano.nome})`,
          );
        }

        /**
         * Cabe mais um FIXO nesta turma?
         *
         * Esta pergunta não estava sendo feita. O que existia era indireto:
         * tentava-se gerar as aulas e, se NENHUMA entrasse por lotação, o fixo
         * era desfeito. Só que basta uma vaga pontual para a conta dar certo —
         * uma aluna desmarcou a quarta que vem, e essa única brecha deixava
         * entrar um quarto aluno PERMANENTE numa turma de três. Ele pegava
         * aquela aula e mais nenhuma: a partir da semana seguinte ficava como
         * fixo sem aula, e quem perdia a vaga em cada semana virava sorteio do
         * cron.
         *
         * Aqui a pergunta é a estrutural: quantas pessoas moram neste horário.
         * A linha do horário já está travada acima (`FOR UPDATE`), então dois
         * cadastros simultâneos não leem a mesma contagem.
         *
         * Só conta quem divide o período com o novo fixo. Fixo que já terminou
         * não ocupa vaga nenhuma, e é isso que permite a troca combinada — a
         * que sai até o dia 30, a que entra a partir do dia 1º — sem obrigar a
         * dona a apagar o horário de quem ainda está treinando.
         */
        const cabem = capacidadeEfetiva(turmaAtual.capacidadeMaxima, turmaAtual.modalidade?.nome);
        const fixosNaTurma = await tx.horarioFixo.count({
          where: {
            horarioId: dto.horarioId,
            ativo: true,
            usuarioId: { not: usuarioId },
            // O outro ainda não tinha acabado quando este começa…
            OR: [{ dataFim: null }, { dataFim: { gte: dataInicio } }],
            // …e já tinha começado antes de este acabar.
            ...(dataFim ? { dataInicio: { lte: dataFim } } : {}),
          },
        });
        if (fixosNaTurma >= cabem) {
          const turma = apelidoDaTurma(turmaAtual.diaSemana, turmaAtual.horaInicio);
          throw new BadRequestException(
            `A turma de ${turma} já tem ${fixosNaTurma} aluno(s) em horário fixo, que é o limite ` +
              `de ${cabem} da sala. Para colocar ${nomeCurto(aluno.nome)} aqui, tire antes alguém ` +
              'do horário fixo desta turma ou escolha outro horário.',
          );
        }
      }

      const registro = existente
        ? await tx.horarioFixo.update({
            where: { id: existente.id },
            data: { ativo: true, dataInicio, dataFim },
            include: { horario: { include: { modalidade: true } } },
          })
        : await tx.horarioFixo.create({
            data: { usuarioId, horarioId: dto.horarioId, dataInicio, dataFim },
            include: { horario: { include: { modalidade: true } } },
          });

      /**
       * Data final marcada tem que valer também para as aulas JÁ geradas.
       *
       * A geração corre até oito semanas à frente, então quando a dona põe uma
       * data de saída as aulas depois dela já estão na agenda — e continuavam
       * lá, com o aluno ocupando vaga numa turma da qual ele já tinha saído. É
       * o mesmo estrago que `remover()` conserta, e pelo mesmo motivo: a vaga
       * ficava presa, e a próxima pessoa não entrava.
       *
       * Só as futuras, e só as do plano: aula que já aconteceu é histórico, e
       * reposição foi o aluno que marcou com crédito dele.
       */
      if (dataFim) {
        await tx.agendamento.updateMany({
          where: {
            usuarioId,
            horarioId: dto.horarioId,
            status: 'CONFIRMADO',
            reposicao: false,
            dataAula: { gt: dataFim, gte: dayjs().startOf('day').toDate() },
          },
          data: { status: 'CANCELADO' },
        });
      }

      return { registro, jaEstavaAtivo };
    });

    // Gera as próximas aulas na hora — sem esperar o cron das 3h. Falha na
    // geração por turma cheia agora desfaz o fixo recém-criado: salvar a
    // combinação sem conseguir colocar o aluno em nenhuma aula fazia a dona
    // achar que marcou, mas a agenda continuava vazia.
    let geracao: { criados: number; ignorados: number; erros: number; motivos: string[]; datas: string[] } = {
      criados: 0, ignorados: 0, erros: 0, motivos: [], datas: [],
    };
    try {
      geracao = await this.autoAgendamento.gerarParaHorarioFixoId(fixo.id);
    } catch (e) {
      this.logger.warn(`Falha ao gerar aulas do fixo ${fixo.id}: ${e instanceof Error ? e.message : e}`);
      geracao.erros = 1;
      geracao.motivos = ['O horário fixo foi salvo, mas a geração das aulas falhou. Confira a agenda antes de confirmar ao aluno.'];
    }

    if (!jaEstavaAtivo && geracao.criados === 0 && geracao.erros > 0 && temErroDeLotacao(geracao.motivos ?? [])) {
      await this.prisma.horarioFixo.update({ where: { id: fixo.id }, data: { ativo: false } });
      throw new BadRequestException(
        `Horário cheio. Não foi possível colocar ${nomeCurto(aluno.nome)} nesse horário fixo ` +
          'porque a turma não tem vaga. Tire alguém da turma ou escolha outro horário.',
      );
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

    const { count } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM horarios WHERE id = ${hf.horarioId} FOR UPDATE`;
      await tx.horarioFixo.update({ where: { id }, data: { ativo: false } });
      return tx.agendamento.updateMany({
        where: {
          usuarioId: hf.usuarioId,
          horarioId: hf.horarioId,
          status: 'CONFIRMADO',
          reposicao: false,
          dataAula: { gte: dayjs().startOf('day').toDate() },
        },
        data: { status: 'CANCELADO' },
      });
    });
    return {
      mensagem:
        count > 0
          ? `Horário fixo removido e ${count} aula(s) futura(s) cancelada(s).`
          : 'Horário fixo removido.',
      aulasCanceladas: count,
    };
  }
}
