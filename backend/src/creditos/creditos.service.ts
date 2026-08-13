import { Injectable, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { DIAS_VALIDADE_CREDITO } from './creditos.constantes';

type Credito = {
  id: string;
  usado: boolean;
  revogado: boolean;
  expiraEm: Date;
};

export type StatusCredito = 'VALIDO' | 'USADO' | 'EXPIRADO' | 'REVOGADO';

@Injectable()
export class CreditosService {
  constructor(private prisma: PrismaService) {}

  private statusDe(c: Credito): StatusCredito {
    if (c.revogado) return 'REVOGADO';
    if (c.usado) return 'USADO';
    if (dayjs().isAfter(c.expiraEm)) return 'EXPIRADO';
    return 'VALIDO';
  }

  /** Créditos do aluno logado, com status calculado. */
  async meus(usuarioId: string) {
    const creditos = await this.prisma.creditoReposicao.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },
    });
    return creditos.map((c) => ({ ...c, status: this.statusDe(c) }));
  }

  /** Quantidade de créditos válidos (disponíveis para uso). */
  async saldo(usuarioId: string) {
    const disponiveis = await this.prisma.creditoReposicao.count({
      where: { usuarioId, usado: false, revogado: false, expiraEm: { gt: new Date() } },
    });
    return { disponiveis };
  }

  // ── Admin ──────────────────────────────────────────────────────────
  async listar(usuarioId?: string) {
    const creditos = await this.prisma.creditoReposicao.findMany({
      where: usuarioId ? { usuarioId } : {},
      include: { usuario: { select: { id: true, nome: true, email: true } } },
      orderBy: { criadoEm: 'desc' },
    });
    return creditos.map((c) => ({ ...c, status: this.statusDe(c) }));
  }

  async conceder(usuarioId: string, dias = DIAS_VALIDADE_CREDITO) {
    const expiraEm = dayjs().add(dias, 'day').endOf('day').toDate();
    return this.prisma.creditoReposicao.create({
      data: { usuarioId, concedidoAdmin: true, expiraEm },
    });
  }

  async atualizar(id: string, data: { expiraEm?: string; revogado?: boolean }) {
    const existe = await this.prisma.creditoReposicao.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Crédito não encontrado');
    return this.prisma.creditoReposicao.update({
      where: { id },
      data: {
        ...(data.expiraEm ? { expiraEm: new Date(data.expiraEm) } : {}),
        ...(data.revogado !== undefined ? { revogado: data.revogado } : {}),
      },
    });
  }

  async remover(id: string) {
    const existe = await this.prisma.creditoReposicao.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Crédito não encontrado');
    await this.prisma.creditoReposicao.update({ where: { id }, data: { revogado: true } });
    return { mensagem: 'Crédito revogado' };
  }
}
