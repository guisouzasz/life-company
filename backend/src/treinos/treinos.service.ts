import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalvarTreinoDto } from './dto/salvar-treino.dto';

type Solicitante = { id: string; tipo: string };

/**
 * Treinos montados pelo professor para os alunos.
 * Cada professor pertence a UMA modalidade: cria treinos carimbados com ela
 * e só vê/edita treinos da própria modalidade. Admin vê e gerencia tudo.
 * O aluno lê os próprios treinos (todas as modalidades).
 */
@Injectable()
export class TreinosService {
  constructor(private prisma: PrismaService) {}

  private readonly incluir = {
    exercicios: { orderBy: { ordem: 'asc' as const } },
    professor: { select: { id: true, nome: true } },
    aluno: { select: { id: true, nome: true } },
    modalidade: { select: { id: true, nome: true } },
  };

  /** Modalidade do professor (null para admin). Professor sem modalidade é barrado. */
  private async modalidadeDe(solicitante: Solicitante): Promise<string | null> {
    if (solicitante.tipo !== 'PROFESSOR') return null;
    const prof = await this.prisma.usuario.findUnique({
      where: { id: solicitante.id },
      select: { modalidadeProfessorId: true },
    });
    if (!prof?.modalidadeProfessorId) {
      throw new ForbiddenException('Seu cadastro de professor não tem modalidade definida — fale com a administração');
    }
    return prof.modalidadeProfessorId;
  }

  /** Treinos ativos do aluno logado (todas as modalidades). */
  async meus(alunoId: string) {
    return this.prisma.treino.findMany({
      where: { alunoId, ativo: true },
      include: this.incluir,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Treinos de um aluno — professor vê só os da própria modalidade. */
  async doAluno(alunoId: string, solicitante: Solicitante) {
    const modalidadeId = await this.modalidadeDe(solicitante);
    return this.prisma.treino.findMany({
      where: { alunoId, ativo: true, ...(modalidadeId ? { modalidadeId } : {}) },
      include: this.incluir,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Treino de Musculação usa exercicios[]; Funcional/Pilates usa texto livre. */
  private validarFormato(dto: SalvarTreinoDto) {
    const temExercicios = (dto.exercicios?.length ?? 0) > 0;
    const temConteudo = !!dto.conteudo?.trim();
    if (!temExercicios && !temConteudo) {
      throw new BadRequestException('Informe os exercícios ou o texto do treino');
    }
  }

  async criar(solicitante: Solicitante, dto: SalvarTreinoDto) {
    this.validarFormato(dto);
    const modalidadeId = await this.modalidadeDe(solicitante);
    const aluno = await this.prisma.usuario.findUnique({ where: { id: dto.alunoId } });
    if (!aluno || aluno.tipoUsuario !== 'ALUNO') throw new NotFoundException('Aluno não encontrado');
    return this.prisma.treino.create({
      data: {
        alunoId: dto.alunoId,
        professorId: solicitante.id,
        modalidadeId, // null quando criado pelo admin
        titulo: dto.titulo,
        conteudo: dto.conteudo?.trim() || null,
        observacoes: dto.observacoes,
        exercicios: {
          create: (dto.exercicios ?? []).map((e, i) => ({
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

  /** Garante que o professor só mexe em treinos da própria modalidade. */
  private async buscarComPermissao(id: string, solicitante: Solicitante) {
    const treino = await this.prisma.treino.findUnique({ where: { id } });
    if (!treino || !treino.ativo) throw new NotFoundException('Treino não encontrado');
    if (solicitante.tipo === 'PROFESSOR') {
      const modalidadeId = await this.modalidadeDe(solicitante);
      if (treino.modalidadeId !== modalidadeId) {
        throw new ForbiddenException('Este treino é de outra modalidade');
      }
    }
    return treino;
  }

  /** Atualiza título/observações/conteúdo e SUBSTITUI a lista de exercícios. */
  async atualizar(id: string, dto: SalvarTreinoDto, solicitante: Solicitante) {
    this.validarFormato(dto);
    await this.buscarComPermissao(id, solicitante);
    return this.prisma.treino.update({
      where: { id },
      data: {
        titulo: dto.titulo,
        conteudo: dto.conteudo?.trim() || null,
        observacoes: dto.observacoes,
        exercicios: {
          deleteMany: {},
          create: (dto.exercicios ?? []).map((e, i) => ({
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

  async remover(id: string, solicitante: Solicitante) {
    await this.buscarComPermissao(id, solicitante);
    await this.prisma.treino.update({ where: { id }, data: { ativo: false } });
    return { mensagem: 'Treino removido' };
  }
}
