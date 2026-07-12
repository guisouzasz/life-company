import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalvarTreinoDto } from './dto/salvar-treino.dto';

/**
 * Treinos montados pelo professor para os alunos.
 * Professor e admin criam/editam; o aluno só lê os próprios.
 */
@Injectable()
export class TreinosService {
  constructor(private prisma: PrismaService) {}

  private readonly incluir = {
    exercicios: { orderBy: { ordem: 'asc' as const } },
    professor: { select: { id: true, nome: true } },
    aluno: { select: { id: true, nome: true } },
  };

  /** Treinos ativos do aluno logado. */
  async meus(alunoId: string) {
    return this.prisma.treino.findMany({
      where: { alunoId, ativo: true },
      include: this.incluir,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Treinos de um aluno (professor/admin) — inclui inativos recentes não. */
  async doAluno(alunoId: string) {
    return this.prisma.treino.findMany({
      where: { alunoId, ativo: true },
      include: this.incluir,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async criar(professorId: string, dto: SalvarTreinoDto) {
    const aluno = await this.prisma.usuario.findUnique({ where: { id: dto.alunoId } });
    if (!aluno || aluno.tipoUsuario !== 'ALUNO') throw new NotFoundException('Aluno não encontrado');
    return this.prisma.treino.create({
      data: {
        alunoId: dto.alunoId,
        professorId,
        titulo: dto.titulo,
        observacoes: dto.observacoes,
        exercicios: {
          create: dto.exercicios.map((e, i) => ({
            ordem: i,
            nome: e.nome,
            series: e.series ?? 3,
            repeticoes: e.repeticoes ?? '12',
            carga: e.carga,
            observacao: e.observacao,
          })),
        },
      },
      include: this.incluir,
    });
  }

  /** Atualiza título/observações e SUBSTITUI a lista de exercícios. */
  async atualizar(id: string, dto: SalvarTreinoDto) {
    const existe = await this.prisma.treino.findUnique({ where: { id } });
    if (!existe || !existe.ativo) throw new NotFoundException('Treino não encontrado');
    return this.prisma.treino.update({
      where: { id },
      data: {
        titulo: dto.titulo,
        observacoes: dto.observacoes,
        exercicios: {
          deleteMany: {},
          create: dto.exercicios.map((e, i) => ({
            ordem: i,
            nome: e.nome,
            series: e.series ?? 3,
            repeticoes: e.repeticoes ?? '12',
            carga: e.carga,
            observacao: e.observacao,
          })),
        },
      },
      include: this.incluir,
    });
  }

  async remover(id: string) {
    const existe = await this.prisma.treino.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Treino não encontrado');
    await this.prisma.treino.update({ where: { id }, data: { ativo: false } });
    return { mensagem: 'Treino removido' };
  }
}
