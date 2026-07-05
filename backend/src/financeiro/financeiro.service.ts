import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';

export type StatusMensalidade = 'EM_DIA' | 'A_VENCER' | 'ATRASADO' | 'SEM_VALOR';

/**
 * Financeiro manual: o aluno paga direto para o estúdio (PIX/dinheiro) e o
 * admin apenas registra o recebimento. Nenhuma cobrança é feita pelo app.
 * Status é calculado dinamicamente a partir do mês de competência — sem cron.
 */
@Injectable()
export class FinanceiroService {
  constructor(private prisma: PrismaService) {}

  /** 1º dia do mês (competência) de uma data/string YYYY-MM. */
  private mesRef(ref?: string): Date {
    const base = ref ? dayjs(`${ref}-01`) : dayjs();
    if (!base.isValid()) throw new BadRequestException('Referência inválida (use YYYY-MM)');
    return base.startOf('month').toDate();
  }

  /** Valor efetivo da mensalidade: override do aluno > preço padrão do plano. */
  private valorEfetivo(usuario: { valorMensalidade: any }, plano?: { precoPadrao: any } | null): number | null {
    const v = usuario.valorMensalidade ?? plano?.precoPadrao ?? null;
    return v === null ? null : Number(v);
  }

  private statusDe(pagoMes: boolean, diaVencimento: number, valor: number | null) {
    if (valor === null) return { status: 'SEM_VALOR' as StatusMensalidade, vencimento: null, dias: 0 };
    const hoje = dayjs().startOf('day');
    const diasNoMes = hoje.daysInMonth();
    const vencimento = hoje.date(Math.min(diaVencimento, diasNoMes));
    if (pagoMes) return { status: 'EM_DIA' as StatusMensalidade, vencimento: vencimento.toDate(), dias: 0 };
    if (hoje.isAfter(vencimento)) {
      return { status: 'ATRASADO' as StatusMensalidade, vencimento: vencimento.toDate(), dias: hoje.diff(vencimento, 'day') };
    }
    return { status: 'A_VENCER' as StatusMensalidade, vencimento: vencimento.toDate(), dias: vencimento.diff(hoje, 'day') };
  }

  /** Resumo do mês + situação de cada aluno ativo (tela Financeiro do admin). */
  async resumo() {
    const inicioMes = dayjs().startOf('month').toDate();
    const fimMes = dayjs().endOf('month').toDate();

    const [alunos, pagamentosMes, recebidoAgg] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { tipoUsuario: 'ALUNO', ativo: true },
        select: {
          id: true, nome: true, cpf: true, valorMensalidade: true, diaVencimento: true,
          usuarioPlanos: { where: { vigenciaFim: null }, include: { plano: true }, take: 1 },
        },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.pagamento.findMany({ where: { referencia: this.mesRef() } }),
      this.prisma.pagamento.aggregate({ _sum: { valor: true }, where: { pagoEm: { gte: inicioMes, lte: fimMes } } }),
    ]);

    const pagosPorAluno = new Map(pagamentosMes.map((p) => [p.usuarioId, p]));

    const linhas = alunos.map((a) => {
      const plano = a.usuarioPlanos[0]?.plano ?? null;
      const valor = this.valorEfetivo(a, plano);
      const pagamento = pagosPorAluno.get(a.id) ?? null;
      const { status, vencimento, dias } = this.statusDe(!!pagamento, a.diaVencimento, valor);
      return {
        usuarioId: a.id,
        nome: a.nome,
        cpf: a.cpf,
        plano: plano ? { id: plano.id, nome: plano.nome } : null,
        valor,
        valorPersonalizado: a.valorMensalidade !== null,
        diaVencimento: a.diaVencimento,
        status,
        vencimento,
        dias, // dias de atraso (ATRASADO) ou dias até vencer (A_VENCER)
        pagamento: pagamento
          ? { id: pagamento.id, valor: Number(pagamento.valor), pagoEm: pagamento.pagoEm, formaPagamento: pagamento.formaPagamento }
          : null,
      };
    });

    const aReceber = linhas
      .filter((l) => l.status === 'A_VENCER' || l.status === 'ATRASADO')
      .reduce((acc, l) => acc + (l.valor ?? 0), 0);

    return {
      recebidoMes: Number(recebidoAgg._sum.valor ?? 0),
      aReceber,
      atrasados: linhas.filter((l) => l.status === 'ATRASADO').length,
      semValor: linhas.filter((l) => l.status === 'SEM_VALOR').length,
      alunos: linhas,
    };
  }

  /** Histórico de pagamentos de um aluno (admin). */
  async historicoDoAluno(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Aluno não encontrado');
    const pagamentos = await this.prisma.pagamento.findMany({
      where: { usuarioId },
      orderBy: { referencia: 'desc' },
      take: 24,
    });
    return pagamentos.map((p) => ({ ...p, valor: Number(p.valor) }));
  }

  /** Registrar recebimento manual (admin). */
  async registrar(dto: { usuarioId: string; valor: number; referencia?: string; formaPagamento?: string; observacao?: string }) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: dto.usuarioId } });
    if (!usuario) throw new NotFoundException('Aluno não encontrado');
    if (!dto.valor || dto.valor <= 0) throw new BadRequestException('Valor deve ser maior que zero');

    const referencia = this.mesRef(dto.referencia);
    const jaExiste = await this.prisma.pagamento.findUnique({
      where: { usuarioId_referencia: { usuarioId: dto.usuarioId, referencia } },
    });
    if (jaExiste) throw new ConflictException(`Já existe pagamento registrado para ${dayjs(referencia).format('MM/YYYY')}`);

    return this.prisma.pagamento.create({
      data: {
        usuarioId: dto.usuarioId,
        valor: dto.valor,
        referencia,
        formaPagamento: (dto.formaPagamento as any) ?? 'PIX',
        observacao: dto.observacao,
      },
    });
  }

  /** Desfazer um registro (lançado errado). */
  async desfazer(id: string) {
    const existe = await this.prisma.pagamento.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Pagamento não encontrado');
    await this.prisma.pagamento.delete({ where: { id } });
    return { mensagem: 'Registro de pagamento desfeito' };
  }

  /** Configurar valor personalizado / dia de vencimento do aluno (admin). */
  async configurarAluno(usuarioId: string, dto: { valorMensalidade?: number | null; diaVencimento?: number }) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Aluno não encontrado');
    if (dto.diaVencimento !== undefined && (dto.diaVencimento < 1 || dto.diaVencimento > 28)) {
      throw new BadRequestException('Dia de vencimento deve ser entre 1 e 28');
    }
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        ...(dto.valorMensalidade !== undefined ? { valorMensalidade: dto.valorMensalidade } : {}),
        ...(dto.diaVencimento !== undefined ? { diaVencimento: dto.diaVencimento } : {}),
      },
      select: { id: true, valorMensalidade: true, diaVencimento: true },
    });
  }

  /** Definir preço padrão de um plano (admin). */
  async definirPrecoPlano(planoId: string, precoPadrao: number | null) {
    const plano = await this.prisma.plano.findUnique({ where: { id: planoId } });
    if (!plano) throw new NotFoundException('Plano não encontrado');
    if (precoPadrao !== null && precoPadrao < 0) throw new BadRequestException('Preço inválido');
    return this.prisma.plano.update({ where: { id: planoId }, data: { precoPadrao } });
  }

  /** Situação da mensalidade do aluno logado (Meu Plano / notificações). */
  async minhaSituacao(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        valorMensalidade: true, diaVencimento: true,
        usuarioPlanos: { where: { vigenciaFim: null }, include: { plano: true }, take: 1 },
      },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const plano = usuario.usuarioPlanos[0]?.plano ?? null;
    const valor = this.valorEfetivo(usuario, plano);
    const pagamento = await this.prisma.pagamento.findUnique({
      where: { usuarioId_referencia: { usuarioId, referencia: this.mesRef() } },
    });
    const { status, vencimento, dias } = this.statusDe(!!pagamento, usuario.diaVencimento, valor);

    const historico = await this.prisma.pagamento.findMany({
      where: { usuarioId },
      orderBy: { referencia: 'desc' },
      take: 6,
    });

    return {
      valor,
      diaVencimento: usuario.diaVencimento,
      status,
      vencimento,
      dias,
      pagamento: pagamento ? { pagoEm: pagamento.pagoEm, valor: Number(pagamento.valor) } : null,
      historico: historico.map((p) => ({ referencia: p.referencia, valor: Number(p.valor), pagoEm: p.pagoEm })),
    };
  }
}
