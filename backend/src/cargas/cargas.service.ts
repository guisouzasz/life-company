import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrarCargaDto } from './dto/registrar-carga.dto';
import { escolherModalidade, modalidadesQueLimitam } from '../usuarios/modalidades-do-professor';

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

  /** Modalidades do professor (null = admin, sem filtro). */
  private modalidadesDe(solicitante: Solicitante): Promise<string[] | null> {
    return modalidadesQueLimitam(this.prisma, solicitante);
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

  /** Evolução do aluno em todos os exercícios (professor vê só as modalidades dele). */
  async doAluno(alunoId: string, solicitante: Solicitante): Promise<EvolucaoExercicio[]> {
    const modalidades = await this.modalidadesDe(solicitante);
    const registros = await this.prisma.registroCarga.findMany({
      where: { alunoId, ...(modalidades ? { modalidadeId: { in: modalidades } } : {}) },
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
    const modalidades = await this.modalidadesDe(solicitante);
    const aluno = await this.prisma.usuario.findUnique({ where: { id: dto.alunoId } });
    if (!aluno || aluno.tipoUsuario !== 'ALUNO') throw new NotFoundException('Aluno não encontrado');
    // A dona registra sem carimbo, como sempre. O professor de mais de uma
    // modalidade carimba a da ficha em que o exercício está — a carga do leg
    // press é da ficha de musculação, mesmo que ele também dê funcional.
    let modalidadeId: string | null = null;
    if (modalidades) {
      const ficha =
        modalidades.length > 1 && !dto.modalidadeId
          ? await this.prisma.treino.findFirst({
              where: {
                alunoId: dto.alunoId,
                ativo: true,
                modalidadeId: { in: modalidades },
                exercicios: { some: { nome: dto.exercicio.trim() } },
              },
              orderBy: { updatedAt: 'desc' },
              select: { modalidadeId: true },
            })
          : null;
      modalidadeId = await escolherModalidade(this.prisma, modalidades, dto.alunoId, [
        dto.modalidadeId,
        ficha?.modalidadeId,
      ]);
    }

    const registro = await this.prisma.registroCarga.create({
      data: {
        alunoId: dto.alunoId,
        professorId: solicitante.id,
        modalidadeId,
        exercicio: dto.exercicio.trim(),
        peso: dto.peso,
        repeticoes: dto.repeticoes,
        observacao: dto.observacao,
        // O dia, não o instante: gravado como `new Date()`, a carga das 21h em
        // diante (aula das 20h) caía em UTC no dia seguinte, e o histórico do
        // aluno mostrava um treino "de amanhã". Meia-noite local, como a data
        // escolhida e como as aulas.
        data: dto.data ? dayjs(dto.data).startOf('day').toDate() : dayjs().startOf('day').toDate(),
      },
    });
    return { ...registro, peso: Number(registro.peso) };
  }

  async remover(id: string, solicitante: Solicitante) {
    const registro = await this.prisma.registroCarga.findUnique({ where: { id } });
    if (!registro) throw new NotFoundException('Registro não encontrado');
    const modalidades = await this.modalidadesDe(solicitante);
    if (modalidades && !modalidades.includes(registro.modalidadeId ?? '')) {
      throw new ForbiddenException('Este registro é de outra modalidade');
    }
    await this.prisma.registroCarga.delete({ where: { id } });
    return { mensagem: 'Registro de carga removido' };
  }
}
