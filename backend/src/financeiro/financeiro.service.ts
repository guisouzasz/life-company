import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';

export type StatusMensalidade = 'EM_DIA' | 'A_VENCER' | 'ATRASADO' | 'SEM_REGISTRO';

/**
 * Financeiro manual SEM valores: o aluno paga direto para o estúdio e o
 * admin apenas marca "pagou" no mês. Nenhuma cobrança é feita pelo app e
 * o aluno NUNCA é inativado/bloqueado por atraso — o status é informativo.
 * Status calculado dinamicamente a partir do mês de competência — sem cron.
 */
@Injectable()
export class FinanceiroService {
  constructor(private prisma: PrismaService) {}

  /** 1º dia do mês (competência) de uma referência YYYY-MM. */
  private mesRef(ref?: string): Date {
    const base = ref ? dayjs(`${ref}-01`) : dayjs();
    if (!base.isValid()) throw new BadRequestException('Referência inválida (use YYYY-MM)');
    return base.startOf('month').toDate();
  }

  /**
   * `temHistorico`: o controle é opt-in — aluno que nunca teve pagamento
   * registrado fica SEM_REGISTRO (sem atraso e sem alerta) até o estúdio
   * marcar o primeiro mês como pago.
   */
  private statusDe(pagoMes: boolean, diaVencimento: number, temHistorico: boolean) {
    const hoje = dayjs().startOf('day');
    const vencimento = hoje.date(Math.min(diaVencimento, hoje.daysInMonth()));
    if (pagoMes) return { status: 'EM_DIA' as StatusMensalidade, vencimento: vencimento.toDate(), dias: 0 };
    if (!temHistorico) return { status: 'SEM_REGISTRO' as StatusMensalidade, vencimento: vencimento.toDate(), dias: 0 };
    if (hoje.isAfter(vencimento)) {
      return { status: 'ATRASADO' as StatusMensalidade, vencimento: vencimento.toDate(), dias: hoje.diff(vencimento, 'day') };
    }
    return { status: 'A_VENCER' as StatusMensalidade, vencimento: vencimento.toDate(), dias: vencimento.diff(hoje, 'day') };
  }

  /** Situação do mês de cada aluno ativo (tela Financeiro do admin). */
  async resumo() {
    const [alunos, pagamentosMes, comHistorico] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { tipoUsuario: 'ALUNO', ativo: true },
        select: {
          // telefone alimenta o aviso de vencimento pelo WhatsApp, no painel
          id: true, nome: true, cpf: true, telefone: true, diaVencimento: true,
          valorMensalidade: true,
          usuarioPlanos: { where: { vigenciaFim: null }, include: { plano: true }, take: 1 },
        },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.pagamento.findMany({ where: { referencia: this.mesRef() } }),
      this.prisma.pagamento.groupBy({ by: ['usuarioId'], _count: true }),
    ]);

    const pagosPorAluno = new Map(pagamentosMes.map((p) => [p.usuarioId, p]));
    const idsComHistorico = new Set(comHistorico.map((g) => g.usuarioId));

    const linhas = alunos.map((a) => {
      const plano = a.usuarioPlanos[0]?.plano ?? null;
      const pagamento = pagosPorAluno.get(a.id) ?? null;
      const { status, vencimento, dias } = this.statusDe(!!pagamento, a.diaVencimento, idsComHistorico.has(a.id));
      return {
        usuarioId: a.id,
        nome: a.nome,
        cpf: a.cpf,
        telefone: a.telefone,
        plano: plano ? { id: plano.id, nome: plano.nome } : null,
        diaVencimento: a.diaVencimento,
        // Decimal do Prisma não atravessa JSON como número; convertemos aqui.
        valorMensalidade: a.valorMensalidade === null ? null : Number(a.valorMensalidade),
        status,
        vencimento,
        dias, // dias de atraso (ATRASADO) ou dias até vencer (A_VENCER)
        pagamento: pagamento
          ? {
              id: pagamento.id,
              pagoEm: pagamento.pagoEm,
              formaPagamento: pagamento.formaPagamento,
              valor: Number(pagamento.valor),
            }
          : null,
      };
    });

    /**
     * Dinheiro do mês.
     *
     * `previsto` soma só quem tem valor definido — por isso `semValor` vai
     * junto: um total que ignora em silêncio os alunos sem valor faria a dona
     * planejar em cima de um número menor do que a realidade, sem saber.
     */
    const soma = (ns: number[]) => Math.round(ns.reduce((t, n) => t + n, 0) * 100) / 100;
    const previsto = soma(linhas.map((l) => l.valorMensalidade ?? 0));

    /**
     * Quanto entrou de cada aluno.
     *
     * Pagamento com valor 0 é de antes de existir valor no sistema: o estúdio
     * marcou "pagou o mês" e não havia onde escrever quanto. Nesses casos vale
     * a mensalidade dele — foi o que se combinou, e é a melhor leitura
     * disponível. Zerar tudo faria o mês inteiro aparecer como não recebido no
     * dia em que isto entrar no ar, o que seria falso.
     */
    const recebidoDe = (l: (typeof linhas)[number]) =>
      l.pagamento ? l.pagamento.valor || l.valorMensalidade || 0 : 0;
    const recebido = soma(linhas.map(recebidoDe));

    return {
      pagos: linhas.filter((l) => l.status === 'EM_DIA').length,
      aVencer: linhas.filter((l) => l.status === 'A_VENCER').length,
      atrasados: linhas.filter((l) => l.status === 'ATRASADO').length,
      semRegistro: linhas.filter((l) => l.status === 'SEM_REGISTRO').length,
      previsto,
      recebido,
      /**
       * O que ainda falta entrar. É previsto - recebido de propósito, para os
       * três números fecharem entre si: somar só a mensalidade de quem não
       * pagou esconderia quem pagou menos do que devia. Nunca negativo — quem
       * adianta dois meses num lançamento só não vira "sobra".
       */
      emAberto: Math.max(soma([previsto, -recebido]), 0),
      semValor: linhas.filter((l) => l.valorMensalidade === null).length,
      alunos: linhas,
    };
  }

  /** Histórico de pagamentos de um aluno (admin). */
  async historicoDoAluno(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Aluno não encontrado');
    return this.prisma.pagamento.findMany({
      where: { usuarioId },
      select: { id: true, referencia: true, pagoEm: true, formaPagamento: true, observacao: true, valor: true },
      orderBy: { referencia: 'desc' },
      take: 24,
    }).then((ps) => ps.map((p) => ({ ...p, valor: Number(p.valor) })));
  }

  /** Marcar mês como pago (admin). */
  async registrar(dto: { usuarioId: string; referencia?: string; observacao?: string; valor?: number }) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: dto.usuarioId } });
    if (!usuario) throw new NotFoundException('Aluno não encontrado');
    if (dto.valor !== undefined && (!Number.isFinite(dto.valor) || dto.valor < 0)) {
      throw new BadRequestException('Valor inválido');
    }

    const referencia = this.mesRef(dto.referencia);
    const jaExiste = await this.prisma.pagamento.findUnique({
      where: { usuarioId_referencia: { usuarioId: dto.usuarioId, referencia } },
    });
    if (jaExiste) throw new ConflictException(`${dayjs(referencia).format('MM/YYYY')} já está marcado como pago`);

    /**
     * O valor fica gravado NO pagamento, não lido do aluno na hora de exibir:
     * a mensalidade muda de preço, e o histórico tem de continuar mostrando o
     * que foi pago à época. Sem valor informado, vale o do aluno.
     */
    const valor = dto.valor ?? Number(usuario.valorMensalidade ?? 0);

    return this.prisma.pagamento.create({
      data: { usuarioId: dto.usuarioId, referencia, observacao: dto.observacao, valor },
    });
  }

  /** Desfazer uma marcação (lançada por engano). */
  async desfazer(id: string) {
    const existe = await this.prisma.pagamento.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Pagamento não encontrado');
    await this.prisma.pagamento.delete({ where: { id } });
    return { mensagem: 'Marcação de pagamento desfeita' };
  }

  /**
   * Mensalidade do aluno: dia de vencimento e valor (admin).
   *
   * O valor é por aluno, não pelo plano: o estúdio combina preço caso a caso
   * (aluno antigo, indicação, dois da mesma casa), e amarrar ao plano obrigaria
   * a inventar um plano novo a cada combinação. `null` limpa o valor.
   */
  async configurarAluno(
    usuarioId: string,
    dto: { diaVencimento?: number; valorMensalidade?: number | null },
  ) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Aluno não encontrado');
    if (dto.diaVencimento !== undefined && (dto.diaVencimento < 1 || dto.diaVencimento > 28)) {
      throw new BadRequestException('Dia de vencimento deve ser entre 1 e 28');
    }
    if (
      dto.valorMensalidade !== undefined &&
      dto.valorMensalidade !== null &&
      (!Number.isFinite(dto.valorMensalidade) || dto.valorMensalidade < 0 || dto.valorMensalidade > 99999)
    ) {
      throw new BadRequestException('Valor da mensalidade inválido');
    }
    const atualizado = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        ...(dto.diaVencimento !== undefined ? { diaVencimento: dto.diaVencimento } : {}),
        ...(dto.valorMensalidade !== undefined ? { valorMensalidade: dto.valorMensalidade } : {}),
      },
      select: { id: true, diaVencimento: true, valorMensalidade: true },
    });
    return {
      ...atualizado,
      valorMensalidade:
        atualizado.valorMensalidade === null ? null : Number(atualizado.valorMensalidade),
    };
  }

  /** Situação da mensalidade do aluno logado (Meu Plano / notificações). */
  async minhaSituacao(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { diaVencimento: true, valorMensalidade: true },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const pagamento = await this.prisma.pagamento.findUnique({
      where: { usuarioId_referencia: { usuarioId, referencia: this.mesRef() } },
    });
    const historico = await this.prisma.pagamento.findMany({
      where: { usuarioId },
      select: { referencia: true, pagoEm: true },
      orderBy: { referencia: 'desc' },
      take: 6,
    });
    const { status, vencimento, dias } = this.statusDe(!!pagamento, usuario.diaVencimento, historico.length > 0);

    return {
      diaVencimento: usuario.diaVencimento,
      valorMensalidade:
        usuario.valorMensalidade === null ? null : Number(usuario.valorMensalidade),
      status,
      vencimento,
      dias,
      pagamento: pagamento ? { pagoEm: pagamento.pagoEm } : null,
      historico,
    };
  }
}
