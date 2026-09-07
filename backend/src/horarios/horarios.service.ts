import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AtualizarHorarioDto, CriarHorarioDto } from './dto/criar-horario.dto';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { capacidadeEfetiva, tetoDaModalidade } from './capacidade';
import { AutoAgendamentoService } from '../auto-agendamento/auto-agendamento.service';

(dayjs as any).extend((isoWeek as any).default || isoWeek);

const DIA_PARA_NUMERO: Record<string, number> = {
  SEGUNDA: 1, TERCA: 2, QUARTA: 3, QUINTA: 4, SEXTA: 5,
};

@Injectable()
export class HorariosService {
  constructor(
    private prisma: PrismaService,
    private autoAgendamento: AutoAgendamentoService,
  ) {}

  /** Próxima vez que este dia da semana acontece (hoje conta). */
  private proximaDataDo(diaSemana: string): Date {
    const alvo = DIA_PARA_NUMERO[diaSemana] ?? 1;
    const hoje = dayjs().startOf('day');
    return hoje.add((alvo - hoje.isoWeekday() + 7) % 7, 'day').toDate();
  }

  /**
   * A semana inteira do estúdio: segunda a sexta, cada turma com quem está
   * dentro.
   *
   * A tela de horários mostra uma turma por vez, e só a próxima ocorrência
   * dela — dá para gerenciar a grade, mas não para enxergar o dia. Esta visão
   * existe para a pergunta que a dona faz o tempo todo: "quem está na quinta
   * às 19h?", e para ela poder pôr alguém ali sem passar pelo horário fixo.
   *
   * `inicio` pode ser qualquer data da semana desejada — a função ancora na
   * segunda-feira daquela semana, então a tela pode mandar simplesmente o dia
   * que o usuário está olhando.
   *
   * Uma consulta para as turmas e outra para os agendamentos da semana toda; o
   * cruzamento é em memória. Buscar aula por aula seriam ~50 idas ao banco
   * para montar uma tela só.
   */
  async listarSemana(inicio?: string) {
    const base = inicio ? dayjs(inicio) : dayjs();
    const segunda = base.startOf('isoWeek').startOf('day');
    const sexta = segunda.add(4, 'day');

    await this.autoAgendamento.gerarAgendamentosFixosNoPeriodo(
      segunda.toDate(),
      sexta.endOf('day').toDate(),
    );

    const [horarios, agendamentos] = await Promise.all([
      this.prisma.horario.findMany({
        where: { ativo: true },
        include: { modalidade: true },
        orderBy: [{ horaInicio: 'asc' }],
      }),
      this.prisma.agendamento.findMany({
        where: {
          status: 'CONFIRMADO',
          dataAula: { gte: segunda.toDate(), lte: sexta.endOf('day').toDate() },
        },
        include: { usuario: { select: { id: true, nome: true } } },
      }),
    ]);

    // Chave (turma + dia) → quem está marcado. Evita varrer a lista de
    // agendamentos uma vez por célula da grade.
    const porTurmaEDia = new Map<string, typeof agendamentos>();
    for (const ag of agendamentos) {
      const chave = `${ag.horarioId}|${dayjs(ag.dataAula).format('YYYY-MM-DD')}`;
      const lista = porTurmaEDia.get(chave);
      if (lista) lista.push(ag);
      else porTurmaEDia.set(chave, [ag]);
    }

    const dias = [0, 1, 2, 3, 4].map((n) => {
      const dia = segunda.add(n, 'day');
      const data = dia.format('YYYY-MM-DD');
      const nomeDoDia = Object.keys(DIA_PARA_NUMERO).find(
        (k) => DIA_PARA_NUMERO[k] === dia.isoWeekday(),
      )!;

      const aulas = horarios
        .filter((h) => h.diaSemana === nomeDoDia)
        .map((h) => {
          const dentro = porTurmaEDia.get(`${h.id}|${data}`) ?? [];
          // O teto da modalidade, não só o número gravado na turma: turma
          // antiga salva com capacidade maior mostraria vaga que a API recusa.
          const capacidade = capacidadeEfetiva(h.capacidadeMaxima, h.modalidade?.nome);
          return {
            horarioId: h.id,
            horaInicio: h.horaInicio,
            horaFim: h.horaFim,
            modalidade: { id: h.modalidade.id, nome: h.modalidade.nome },
            capacidade,
            vagas: Math.max(capacidade - dentro.length, 0),
            alunos: dentro
              .map((ag) => ({
                agendamentoId: ag.id,
                usuarioId: ag.usuarioId,
                nome: ag.usuario.nome,
                reposicao: ag.reposicao,
              }))
              .sort((a, b) => a.nome.localeCompare(b.nome)),
          };
        });

      return { data, diaSemana: nomeDoDia, aulas };
    });

    return { inicio: segunda.format('YYYY-MM-DD'), fim: sexta.format('YYYY-MM-DD'), dias };
  }

  /** `incluirInativos` (admin): lista também horários desativados, para gestão. */
  async listar(modalidadeId?: string, diaSemana?: string, incluirInativos = false) {
    const horarios = await this.prisma.horario.findMany({
      where: { ...(incluirInativos ? {} : { ativo: true }), ...(modalidadeId && { modalidadeId }), ...(diaSemana && { diaSemana: diaSemana as any }) },
      include: { modalidade: true },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });

    /**
     * Quantos alunos tem a turma NA PRÓXIMA AULA dela.
     *
     * Antes isto contava todo agendamento confirmado de hoje em diante, sem
     * separar por data: como o horário fixo gera várias semanas de uma vez,
     * três alunos em três sextas viravam "9" numa turma de 4. A dona via
     * "9/4" e achava que o sistema tinha deixado entrar gente demais — não
     * tinha; era a mesma gente, contada uma vez por semana.
     *
     * A data de cada turma é a próxima vez que aquele dia da semana acontece,
     * igual ao que a tela de detalhe mostra ("Aula de sexta, 28/08").
     */
    const datas = new Map(horarios.map((h) => [h.id, this.proximaDataDo(h.diaSemana)]));
    const contagens = horarios.length
      ? await this.prisma.agendamento.groupBy({
          by: ['horarioId'],
          where: {
            status: 'CONFIRMADO',
            OR: horarios.map((h) => ({ horarioId: h.id, dataAula: datas.get(h.id)! })),
          },
          _count: { _all: true },
        })
      : [];
    const porHorario = new Map(contagens.map((c) => [c.horarioId, c._count._all]));

    return horarios.map((h) => {
      const cabem = capacidadeEfetiva(h.capacidadeMaxima, h.modalidade?.nome);
      const agendados = porHorario.get(h.id) ?? 0;
      return {
        ...h,
        capacidadeMaxima: cabem,
        agendados,
        vagas: Math.max(cabem - agendados, 0),
        proximaData: datas.get(h.id),
      };
    });
  }

  /**
   * `modalidadeId` opcional: sem ele, retorna todas as modalidades.
   * PROFESSOR sempre enxerga apenas a própria modalidade (filtro forçado).
   */
  async listarComVagas(
    modalidadeId: string | undefined,
    dataAula: string,
    solicitante?: { id: string; tipo: string },
  ) {
    if (solicitante?.tipo === 'PROFESSOR') {
      const prof = await this.prisma.usuario.findUnique({
        where: { id: solicitante.id },
        select: { modalidadeProfessorId: true },
      });
      modalidadeId = prof?.modalidadeProfessorId ?? '__sem_modalidade__';
    }
    // `new Date('2026-08-17')` é meia-noite em UTC — 21h do dia anterior no
    // fuso do estúdio. Como o agendamento é gravado à meia-noite LOCAL, a
    // comparação nunca batia e toda aula aparecia com 0 agendados e livre,
    // mesmo lotada. dayjs respeita o fuso do processo, igual ao que grava.
    const data = dayjs(dataAula).startOf('day').toDate();
    const horarios = await this.prisma.horario.findMany({
      where: { ativo: true, ...(modalidadeId ? { modalidadeId } : {}) },
      include: {
        modalidade: true,
        agendamentos: { where: { dataAula: data, status: 'CONFIRMADO' } },
      },
      orderBy: { horaInicio: 'asc' },
    });
    return horarios.map((h) => {
      // O que vale é o teto da modalidade, não só o que está gravado no
      // horário: turma antiga salva com capacidade maior continuaria
      // oferecendo vaga que a API recusaria na hora de confirmar.
      const cabem = capacidadeEfetiva(h.capacidadeMaxima, h.modalidade?.nome);
      return {
        id: h.id, horaInicio: h.horaInicio, horaFim: h.horaFim, diaSemana: h.diaSemana,
        modalidade: h.modalidade, capacidadeMaxima: cabem,
        agendados: h.agendamentos.length, vagas: Math.max(cabem - h.agendamentos.length, 0),
        disponivel: h.agendamentos.length < cabem,
      };
    });
  }

  async criar(dto: CriarHorarioDto) {
    // O painel deixa digitar de 1 a 20; a sala é que manda. Pilates aceita 3,
    // e antes toda turma nova nascia com o padrão 4 — uma pessoa a mais do
    // que cabe, toda vez.
    const modalidade = await this.prisma.modalidade.findUnique({
      where: { id: dto.modalidadeId },
      select: { nome: true },
    });
    if (!modalidade) throw new NotFoundException('Modalidade não encontrada');
    const teto = tetoDaModalidade(modalidade.nome);

    return this.prisma.horario.create({
      data: {
        modalidadeId: dto.modalidadeId,
        diaSemana: dto.diaSemana as any,
        horaInicio: dto.horaInicio,
        horaFim: dto.horaFim,
        capacidadeMaxima: Math.min(dto.capacidadeMaxima ?? teto, teto),
        ativo: dto.ativo ?? true,
      },
      include: {
        modalidade: true,
      },
    });
  }

  /** Edição de campos do horário (admin) — não mexe em agendamentos existentes. */
  async atualizar(id: string, dto: AtualizarHorarioDto) {
    const h = await this.prisma.horario.findUnique({
      where: { id },
      include: { modalidade: { select: { nome: true } } },
    });
    if (!h) throw new NotFoundException('Horário não encontrado');

    /**
     * Mudar dia ou hora de uma turma MOVE junto quem já está agendado: o
     * agendamento aponta para a turma, não para o relógio. Foi assim que uma
     * aluna marcada na sexta às 17:00 amanheceu às 19:00 — ninguém mexeu nela,
     * mexeram na turma.
     *
     * Não dá para proibir (estúdio remaneja aula mesmo), mas tem que ser
     * decisão consciente: sem `confirmarMudancaDeHorario`, a API recusa e diz
     * quantos alunos seriam levados junto.
     */
    const mudaQuando =
      (dto.diaSemana !== undefined && dto.diaSemana !== h.diaSemana) ||
      (dto.horaInicio !== undefined && dto.horaInicio !== h.horaInicio) ||
      (dto.horaFim !== undefined && dto.horaFim !== h.horaFim);

    if (mudaQuando && !dto.confirmarMudancaDeHorario) {
      const afetados = await this.prisma.agendamento.count({
        where: {
          horarioId: id,
          status: 'CONFIRMADO',
          dataAula: { gte: dayjs().startOf('day').toDate() },
        },
      });
      if (afetados > 0) {
        throw new ConflictException(
          `Esta turma tem ${afetados} aluno(s) já agendado(s). Mudar o dia ou a hora leva ` +
            `todos eles junto para o novo horário. Se é isso mesmo, confirme a alteração; ` +
            `se não, crie uma turma nova no horário desejado.`,
        );
      }
    }

    // A modalidade pode estar mudando no mesmo update — o teto é o da
    // modalidade que a turma vai ter depois, não a de antes.
    let nomeModalidade = h.modalidade?.nome;
    if (dto.modalidadeId !== undefined && dto.modalidadeId !== h.modalidadeId) {
      const nova = await this.prisma.modalidade.findUnique({
        where: { id: dto.modalidadeId },
        select: { nome: true },
      });
      if (!nova) throw new NotFoundException('Modalidade não encontrada');
      nomeModalidade = nova.nome;
    }
    const teto = tetoDaModalidade(nomeModalidade);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM horarios WHERE id = ${id} FOR UPDATE`;
      if (dto.ativo === false) await this.exigirTurmaSemVinculos(tx, id);
      return tx.horario.update({
        where: { id },
        data: {
          ...(dto.modalidadeId !== undefined ? { modalidadeId: dto.modalidadeId } : {}),
          ...(dto.diaSemana !== undefined ? { diaSemana: dto.diaSemana as any } : {}),
          ...(dto.horaInicio !== undefined ? { horaInicio: dto.horaInicio } : {}),
          ...(dto.horaFim !== undefined ? { horaFim: dto.horaFim } : {}),
          // Vale também quando só a modalidade muda: turma que virou Pilates
          // precisa cair para 3, mesmo sem ninguém mexer na capacidade.
          capacidadeMaxima: Math.min(dto.capacidadeMaxima ?? h.capacidadeMaxima, teto),
          ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        },
        include: { modalidade: true },
      });
    });
  }

  private async exigirTurmaSemVinculos(tx: Prisma.TransactionClient, horarioId: string) {
    const fixos = await tx.horarioFixo.count({ where: { horarioId, ativo: true } });
    const aulas = await tx.agendamento.count({
      where: { horarioId, status: 'CONFIRMADO', dataAula: { gte: dayjs().startOf('day').toDate() } },
    });
    if (fixos || aulas) {
      throw new ConflictException(
        `Esta turma tem ${fixos} horário(s) fixo(s) e ${aulas} agendamento(s) futuro(s). ` +
          'Remaneje os alunos e resolva os agendamentos antes de desligar a turma.',
      );
    }
  }

  async bloquear(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM horarios WHERE id = ${id} FOR UPDATE`;
      const h = await tx.horario.findUnique({ where: { id } });
      if (!h) throw new NotFoundException('Horário não encontrado');
      if (h.ativo) await this.exigirTurmaSemVinculos(tx, id);
      return tx.horario.update({ where: { id }, data: { ativo: !h.ativo } });
    });
  }

  /**
   * Remove o horário de vez quando ele não deixa rastro (sem aulas no
   * histórico e sem aluno com horário fixo). Se tiver, apenas desativa — o
   * histórico do aluno não pode sumir junto.
   *
   * Antes isto era sempre `ativo: false`, então excluir um horário JÁ inativo
   * não fazia nada e ele ficava preso na lista para sempre.
   */
  async excluir(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM horarios WHERE id = ${id} FOR UPDATE`;
      const horario = await tx.horario.findUnique({
        where: { id },
        include: { _count: { select: { agendamentos: true, horariosFixos: true } } },
    });
    if (!horario) throw new NotFoundException('Horário não encontrado');
    await this.exigirTurmaSemVinculos(tx, id);

    const { agendamentos, horariosFixos } = horario._count;
    if (agendamentos > 0 || horariosFixos > 0) {
      if (!horario.ativo) {
        const motivo = [
          agendamentos > 0 ? `${agendamentos} aula(s) no histórico` : null,
          horariosFixos > 0 ? `${horariosFixos} aluno(s) com horário fixo` : null,
        ]
          .filter(Boolean)
          .join(' e ');
        throw new ConflictException(
          `Este horário não pode ser excluído porque tem ${motivo}. Ele fica inativo para preservar o histórico.`,
        );
      }
      await tx.horario.update({ where: { id }, data: { ativo: false } });
      return { mensagem: 'Horário desativado (tem histórico, por isso não foi apagado)' };
    }

    await tx.horario.delete({ where: { id } });
    return { mensagem: 'Horário excluído' };
    });
  }
}
