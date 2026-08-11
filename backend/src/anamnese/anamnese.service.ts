import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalvarAnamneseDto } from './dto/salvar-anamnese.dto';

type Solicitante = { id: string; tipo: string };

/**
 * Ficha de anamnese: uma por aluno, preenchida pelo próprio no primeiro acesso
 * (ou depois, pelo perfil). Professor e admin leem, mas não editam — o dado é
 * declarado pelo aluno.
 */
@Injectable()
export class AnamneseService {
  constructor(private prisma: PrismaService) {}

  /** Ficha do aluno logado (null quando ainda não preencheu). */
  async minha(usuarioId: string) {
    return this.prisma.anamnese.findUnique({ where: { usuarioId } });
  }

  /** Cria ou substitui a ficha do aluno logado. */
  async salvar(usuarioId: string, dto: SalvarAnamneseDto) {
    const dados = {
      objetivo: dto.objetivo?.trim() || null,
      nivelAtividade: dto.nivelAtividade?.trim() || null,
      problemasSaude: dto.problemasSaude?.trim() || null,
      lesoes: dto.lesoes?.trim() || null,
      dores: dto.dores?.trim() || null,
      medicamentos: dto.medicamentos?.trim() || null,
      alergias: dto.alergias?.trim() || null,
      gestante: !!dto.gestante,
      fumante: !!dto.fumante,
      liberacaoMedica: !!dto.liberacaoMedica,
      observacoes: dto.observacoes?.trim() || null,
    };
    return this.prisma.anamnese.upsert({
      where: { usuarioId },
      create: { usuarioId, ...dados },
      update: dados,
    });
  }

  /** Ficha de um aluno — professor só vê aluno da própria modalidade. */
  async doAluno(alunoId: string, solicitante: Solicitante) {
    const aluno = await this.prisma.usuario.findUnique({
      where: { id: alunoId },
      select: { id: true, tipoUsuario: true },
    });
    if (!aluno || aluno.tipoUsuario !== 'ALUNO') throw new NotFoundException('Aluno não encontrado');

    if (solicitante.tipo === 'PROFESSOR') {
      const prof = await this.prisma.usuario.findUnique({
        where: { id: solicitante.id },
        select: { modalidadeProfessorId: true },
      });
      if (!prof?.modalidadeProfessorId) {
        throw new ForbiddenException('Seu cadastro de professor não tem modalidade definida');
      }
      // O professor precisa ter o aluno na própria modalidade (plano vigente).
      const vinculo = await this.prisma.usuarioPlano.findFirst({
        where: { usuarioId: alunoId, vigenciaFim: null, modalidadeId: prof.modalidadeProfessorId },
        select: { id: true },
      });
      if (!vinculo) throw new ForbiddenException('Este aluno não é da sua modalidade');
    }

    return this.prisma.anamnese.findUnique({ where: { usuarioId: alunoId } });
  }
}
