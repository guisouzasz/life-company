import { Prisma } from '@prisma/client';
import * as dayjs from 'dayjs';
import { DIAS_PERIODO_REPOSICOES, MAX_REPOSICOES_POR_PERIODO } from './creditos.constantes';

type Banco = Prisma.TransactionClient;

/**
 * Quantas reposições o aluno ainda pode MARCAR agora (Termo de Normas,
 * seção 3: até 3 a cada 30 dias).
 *
 * Mora aqui porque duas pontas precisam da mesma conta: a marcação, que
 * recusa a 4ª reposição, e o app, que mostra o botão "Usar crédito de
 * reposição". O app mostrava quantos CRÉDITOS o aluno tinha guardados — a
 * dona viu "(13)" e entendeu que dava para usar 13, quando o servidor só
 * deixaria marcar 3.
 *
 * Conta pela data em que a reposição foi marcada (é o ato de marcar que
 * ocupa a vaga de outra pessoa); reposição cancelada não conta.
 */
export async function reposicoesNaJanela(db: Banco, usuarioId: string, agora = new Date()) {
  const desde = dayjs(agora).subtract(DIAS_PERIODO_REPOSICOES, 'day').toDate();
  const marcadas = await db.agendamento.findMany({
    where: { usuarioId, reposicao: true, status: { not: 'CANCELADO' }, createdAt: { gte: desde } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  const restantes = Math.max(0, MAX_REPOSICOES_POR_PERIODO - marcadas.length);
  return {
    marcadas: marcadas.length,
    restantes,
    /** Quando a mais antiga sai da janela e abre uma vaga de novo (só quando acabou). */
    liberaEm: restantes === 0 ? dayjs(marcadas[0].createdAt).add(DIAS_PERIODO_REPOSICOES, 'day').toDate() : null,
  };
}
