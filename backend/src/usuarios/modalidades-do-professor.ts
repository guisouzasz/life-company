import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Solicitante = { id: string; tipo: string };

/**
 * Modalidades em que o professor dá aula.
 *
 * Um professor pode ser de mais de uma (a Gabriele é de Musculação e de
 * Funcional), e é esta lista que decide o que ele enxerga: a agenda, os
 * treinos, as cargas e a anamnese dos alunos dessas modalidades.
 *
 * Soma a tabela nova com a modalidade principal (`modalidadeProfessorId`):
 * as duas andam juntas, mas se alguma versão anterior da API tiver trocado só
 * a principal, o professor não perde o acesso por causa disso.
 */
export async function modalidadesDoProfessor(prisma: PrismaService, professorId: string): Promise<string[]> {
  const u = await prisma.usuario.findUnique({
    where: { id: professorId },
    select: {
      modalidadeProfessorId: true,
      modalidadesProfessor: { select: { modalidadeId: true } },
    },
  });
  if (!u) return [];
  const ids = [
    ...(u.modalidadeProfessorId ? [u.modalidadeProfessorId] : []),
    ...(u.modalidadesProfessor ?? []).map((m) => m.modalidadeId),
  ];
  return [...new Set(ids)];
}

/**
 * Modalidades que limitam o que o solicitante vê: `null` para a dona (vê
 * tudo), a lista do professor para ele. Professor sem nenhuma é barrado — sem
 * isso ele enxergaria o estúdio inteiro.
 */
export async function modalidadesQueLimitam(
  prisma: PrismaService,
  solicitante: Solicitante,
  aviso = 'Seu cadastro de professor não tem modalidade definida — fale com a administração',
): Promise<string[] | null> {
  if (solicitante.tipo !== 'PROFESSOR') return null;
  const ids = await modalidadesDoProfessor(prisma, solicitante.id);
  if (ids.length === 0) throw new ForbiddenException(aviso);
  return ids;
}

/**
 * Com qual modalidade carimbar algo que o professor está criando para um
 * aluno (ficha de treino, registro de carga).
 *
 * Com uma modalidade só, é ela. Com mais de uma, a ordem de preferência é:
 * a que veio pedida, a que o registro já tinha (na edição), a do plano do
 * aluno — o Rubens, de Musculação e Funcional, montando treino para uma aluna
 * de Musculação carimba Musculação sem ninguém precisar escolher —, e por
 * último a principal do professor.
 *
 * `null` quando nenhuma das `opcoes` serve para o que foi pedido: quem chama
 * decide a mensagem.
 */
export async function escolherModalidade(
  prisma: PrismaService,
  opcoes: string[],
  alunoId: string | undefined,
  preferidas: (string | null | undefined)[],
): Promise<string | null> {
  if (opcoes.length === 0) return null;
  for (const p of preferidas) if (p && opcoes.includes(p)) return p;
  if (alunoId) {
    const planos = await prisma.usuarioPlano.findMany({
      where: { usuarioId: alunoId, vigenciaFim: null, modalidadeId: { in: opcoes } },
      select: { modalidadeId: true },
    });
    if (planos.length > 0) return planos[0].modalidadeId;
  }
  return opcoes[0];
}

type Mod = { id: string; nome: string };

/**
 * A lista que sai para as telas: a principal primeiro, depois as outras em
 * ordem alfabética, sem repetir. É como a dona vê o professor ("Musculação e
 * Funcional") e o que o app do professor usa para montar as telas.
 */
export function juntarModalidades(
  principal: Mod | null | undefined,
  outras: { modalidade: Mod }[] | null | undefined,
): Mod[] {
  const resto = (outras ?? [])
    .map((o) => o.modalidade)
    .filter((m) => m.id !== principal?.id)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return [...(principal ? [principal] : []), ...resto];
}
