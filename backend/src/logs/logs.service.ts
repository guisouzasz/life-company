import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Quantas linhas por página. O suficiente para uma tela sem pesar no celular. */
const POR_PAGINA = 50;

/**
 * Quanto tempo o registro fica guardado.
 *
 * Seis meses cobrem a pergunta real ("o que aconteceu com a turma da sexta no
 * mês passado?") sem deixar a tabela crescer para sempre. Passado isso a linha
 * não responde mais nada e só ocupa espaço — e, sendo dado de movimentação do
 * estúdio, guardar indefinidamente é o oposto de prudente.
 */
export const DIAS_DE_RETENCAO = 180;

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  async listar(filtros: {
    usuarioId?: string;
    desde?: string;
    ate?: string;
    busca?: string;
    pagina?: number;
  }) {
    const pagina = Math.max(1, Number(filtros.pagina) || 1);

    const onde: any = {};
    if (filtros.usuarioId) onde.usuarioId = filtros.usuarioId;
    if (filtros.desde || filtros.ate) {
      onde.criadoEm = {};
      if (filtros.desde) onde.criadoEm.gte = new Date(`${filtros.desde}T00:00:00`);
      // O `ate` é inclusivo: quem digita 05/09 quer o dia 05 inteiro, não até
      // a meia-noite do 05.
      if (filtros.ate) onde.criadoEm.lte = new Date(`${filtros.ate}T23:59:59.999`);
    }
    if (filtros.busca?.trim()) {
      const termo = filtros.busca.trim();
      onde.OR = [
        { resumo: { contains: termo, mode: 'insensitive' } },
        { usuarioNome: { contains: termo, mode: 'insensitive' } },
        { rota: { contains: termo, mode: 'insensitive' } },
      ];
    }

    const [total, itens] = await Promise.all([
      this.prisma.logAcao.count({ where: onde }),
      this.prisma.logAcao.findMany({
        where: onde,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
      }),
    ]);

    return {
      itens,
      total,
      pagina,
      paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    };
  }

  /**
   * Quem aparece no registro — para montar o filtro "por pessoa" sem listar
   * o estúdio inteiro.
   */
  async autores() {
    const linhas = await this.prisma.logAcao.groupBy({
      by: ['usuarioId', 'usuarioNome', 'usuarioTipo'],
      _count: { _all: true },
      orderBy: { _count: { usuarioId: 'desc' } },
      take: 30,
    });
    return linhas.map((l) => ({
      usuarioId: l.usuarioId,
      nome: l.usuarioNome,
      tipo: l.usuarioTipo,
      acoes: l._count._all,
    }));
  }

  /** Apaga o que passou da retenção. Chamado pelo cron diário. */
  async limparAntigos(): Promise<number> {
    const corte = new Date();
    corte.setDate(corte.getDate() - DIAS_DE_RETENCAO);
    const { count } = await this.prisma.logAcao.deleteMany({
      where: { criadoEm: { lt: corte } },
    });
    return count;
  }
}
