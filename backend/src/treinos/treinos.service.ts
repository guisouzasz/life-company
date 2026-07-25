import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { SalvarTreinoDto } from './dto/salvar-treino.dto';
import { SalvarTreinoDiaDto } from './dto/salvar-treino-dia.dto';

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
      orderBy: [{ concluido: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  /** Treinos de um aluno — professor vê só os da própria modalidade. */
  async doAluno(alunoId: string, solicitante: Solicitante) {
    const modalidadeId = await this.modalidadeDe(solicitante);
    return this.prisma.treino.findMany({
      where: { alunoId, ativo: true, ...(modalidadeId ? { modalidadeId } : {}) },
      include: this.incluir,
      orderBy: [{ concluido: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  /** Metadados opcionais da ficha (vencimento, frequência, pausa, velocidade). */
  private metaDados(dto: SalvarTreinoDto) {
    return {
      vencimento: dto.vencimento ? new Date(dto.vencimento + 'T00:00:00') : null,
      frequencia: dto.frequencia?.trim() || null,
      pausaSeries: dto.pausaSeries?.trim() || null,
      velocidade: dto.velocidade?.trim() || null,
    };
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
        ...this.metaDados(dto),
        exercicios: {
          create: (dto.exercicios ?? []).map((e, i) => ({
            ordem: i,
            grupo: e.grupo?.trim() || null,
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
        ...this.metaDados(dto),
        exercicios: {
          deleteMany: {},
          create: (dto.exercicios ?? []).map((e, i) => ({
            ordem: i,
            grupo: e.grupo?.trim() || null,
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

  /** Marca a ficha como concluída (arquivada) ou reativa. */
  async definirStatus(id: string, concluido: boolean, solicitante: Solicitante) {
    await this.buscarComPermissao(id, solicitante);
    return this.prisma.treino.update({ where: { id }, data: { concluido }, include: this.incluir });
  }

  async remover(id: string, solicitante: Solicitante) {
    await this.buscarComPermissao(id, solicitante);
    await this.prisma.treino.update({ where: { id }, data: { ativo: false } });
    return { mensagem: 'Treino removido' };
  }

  // ── Treino do DIA (Funcional): um por modalidade+data ──────────────

  private normalizarData(data: string): Date {
    return dayjs(data).startOf('day').toDate();
  }

  /** Treino do dia da modalidade (professor usa a própria; admin passa modalidadeId). */
  async diaVer(solicitante: Solicitante, data: string, modalidadeIdParam?: string) {
    const modalidadeId = (await this.modalidadeDe(solicitante)) ?? modalidadeIdParam;
    if (!modalidadeId) throw new BadRequestException('Informe a modalidade');
    return this.prisma.treinoDia.findUnique({
      where: { modalidadeId_data: { modalidadeId, data: this.normalizarData(data) } },
      include: { modalidade: { select: { id: true, nome: true } }, professor: { select: { id: true, nome: true } } },
    });
  }

  /** Cria ou substitui o treino do dia (upsert por modalidade+data). */
  async diaSalvar(solicitante: Solicitante, dto: SalvarTreinoDiaDto) {
    const modalidadeId = (await this.modalidadeDe(solicitante)) ?? dto.modalidadeId;
    if (!modalidadeId) throw new BadRequestException('Informe a modalidade');
    const data = this.normalizarData(dto.data);
    return this.prisma.treinoDia.upsert({
      where: { modalidadeId_data: { modalidadeId, data } },
      create: { professorId: solicitante.id, modalidadeId, data, conteudo: dto.conteudo.trim() },
      update: { professorId: solicitante.id, conteudo: dto.conteudo.trim() },
      include: { modalidade: { select: { id: true, nome: true } }, professor: { select: { id: true, nome: true } } },
    });
  }

  async diaRemover(id: string, solicitante: Solicitante) {
    const treino = await this.prisma.treinoDia.findUnique({ where: { id } });
    if (!treino) throw new NotFoundException('Treino do dia não encontrado');
    if (solicitante.tipo === 'PROFESSOR') {
      const modalidadeId = await this.modalidadeDe(solicitante);
      if (treino.modalidadeId !== modalidadeId) throw new ForbiddenException('Este treino é de outra modalidade');
    }
    await this.prisma.treinoDia.delete({ where: { id } });
    return { mensagem: 'Treino do dia removido' };
  }

  /** Treinos do dia de HOJE das modalidades em que o aluno tem aula hoje. */
  async diaMeu(alunoId: string) {
    const hoje = dayjs().startOf('day').toDate();
    const aulas = await this.prisma.agendamento.findMany({
      where: { usuarioId: alunoId, status: 'CONFIRMADO', dataAula: hoje },
      select: { horario: { select: { modalidadeId: true } } },
    });
    const modalidades = [...new Set(aulas.map((a) => a.horario.modalidadeId))];
    if (modalidades.length === 0) return [];
    return this.prisma.treinoDia.findMany({
      where: { data: hoje, modalidadeId: { in: modalidades } },
      include: { modalidade: { select: { id: true, nome: true } }, professor: { select: { id: true, nome: true } } },
    });
  }
}
