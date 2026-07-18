import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrarCargaDto } from './dto/registrar-carga.dto';

type Solicitante = { id: string; tipo: string };

export interface EvolucaoExercicio {
  exercicio: string;
  registros: { id: string; peso: number; repeticoes: string | null; observacao: string | null; data: Date }[];
  /** Última carga registrada (a mais recente). */
  atual: number;
  /** Primeira carga registrada (a mais antiga). */
  inicial: number;
  /** Maior carga já registrada. */
  recorde: number;
  /** Diferença entre a atual e a inicial (kg). */
  evolucaoKg: number;
  /** Evolução percentual da inicial até a atual. */
  evolucaoPct: number;
}

/**
 * Registro de carga (peso) por exercício — o professor anota o que o aluno
 * levantou e acompanha a evolução. O histórico é identificado por
 * (aluno + nome do exercício + modalidade), então sobrevive à edição do treino.
 */
@Injectable()
export class CargasService {
  constructor(private prisma: PrismaService) {}

  /** Modalidade do professor (null = admin, sem filtro). */
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

  private montarEvolucao(
    registros: { id: string; exercicio: string; peso: any; repeticoes: string | null; observacao: string | null; data: Date }[],
  ): EvolucaoExercicio[] {
    const porExercicio = new Map<string, typeof registros>();
    registros.forEach((r) => {
      const lista = porExercicio.get(r.exercicio) ?? [];
      lista.push(r);
      porExercicio.set(r.exercicio, lista);
    });

    return [...porExercicio.entries()]
      .map(([exercicio, lista]) => {
        // do mais antigo para o mais novo (evolução lida da esquerda p/ direita)
        const ordenados = [...lista].sort((a, b) => a.data.getTime() - b.data.getTime());
        const pesos = ordenados.map((r) => Number(r.peso));
        const inicial = pesos[0];
        const atual = pesos[pesos.length - 1];
        const recorde = Math.max(...pesos);
        return {
          exercicio,
          registros: ordenados.map((r) => ({
            id: r.id,
            peso: Number(r.peso),
            repeticoes: r.repeticoes,
            observacao: r.observacao,
            data: r.data,
          })),
          atual,
          inicial,
          recorde,
          evolucaoKg: Math.round((atual - inicial) * 100) / 100,
          evolucaoPct: inicial > 0 ? Math.round(((atual - inicial) / inicial) * 100) : 0,
        };
      })
      .sort((a, b) => a.exercicio.localeCompare(b.exercicio));
  }

  /** Evolução do aluno em todos os exercícios (professor vê só a modalidade dele). */
  async doAluno(alunoId: string, solicitante: Solicitante): Promise<EvolucaoExercicio[]> {
    const modalidadeId = await this.modalidadeDe(solicitante);
    const registros = await this.prisma.registroCarga.findMany({
      where: { alunoId, ...(modalidadeId ? { modalidadeId } : {}) },
      select: { id: true, exercicio: true, peso: true, repeticoes: true, observacao: true, data: true },
      orderBy: { data: 'asc' },
    });
    return this.montarEvolucao(registros);
  }

  /** Evolução do aluno logado (todas as modalidades). */
  async meus(alunoId: string): Promise<EvolucaoExercicio[]> {
    const registros = await this.prisma.registroCarga.findMany({
      where: { alunoId },
      select: { id: true, exercicio: true, peso: true, repeticoes: true, observacao: true, data: true },
      orderBy: { data: 'asc' },
    });
    return this.montarEvolucao(registros);
  }

  async registrar(solicitante: Solicitante, dto: RegistrarCargaDto) {
    const modalidadeId = await this.modalidadeDe(solicitante);
    const aluno = await this.prisma.usuario.findUnique({ where: { id: dto.alunoId } });
    if (!aluno || aluno.tipoUsuario !== 'ALUNO') throw new NotFoundException('Aluno não encontrado');

    const registro = await this.prisma.registroCarga.create({
      data: {
        alunoId: dto.alunoId,
        professorId: solicitante.id,
        modalidadeId,
        exercicio: dto.exercicio.trim(),
        peso: dto.peso,
        repeticoes: dto.repeticoes,
        observacao: dto.observacao,
        data: dto.data ? dayjs(dto.data).startOf('day').toDate() : new Date(),
      },
    });
    return { ...registro, peso: Number(registro.peso) };
  }

  async remover(id: string, solicitante: Solicitante) {
    const registro = await this.prisma.registroCarga.findUnique({ where: { id } });
    if (!registro) throw new NotFoundException('Registro não encontrado');
    if (solicitante.tipo === 'PROFESSOR') {
      const modalidadeId = await this.modalidadeDe(solicitante);
      if (registro.modalidadeId !== modalidadeId) {
        throw new ForbiddenException('Este registro é de outra modalidade');
      }
    }
    await this.prisma.registroCarga.delete({ where: { id } });
    return { mensagem: 'Registro de carga removido' };
  }
}
