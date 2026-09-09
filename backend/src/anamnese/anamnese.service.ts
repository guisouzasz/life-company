import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalvarAnamneseDto } from './dto/salvar-anamnese.dto';

type Solicitante = { id: string; tipo: string };

/** Texto aparado, ou null. Campo em branco é "não respondeu", não string vazia. */
const texto = (v?: string | null) => v?.trim() || null;

/**
 * Lista de respostas em JSON, ou null quando não sobrou nada.
 *
 * Guardar `"[]"` em vez de null faria a ficha do professor achar que o aluno
 * respondeu "nenhuma" quando ele só não chegou àquela pergunta.
 */
const lista = (v?: string[] | null) => {
  const limpa = (v ?? []).map((x) => x.trim()).filter(Boolean);
  return limpa.length ? JSON.stringify(limpa) : null;
};

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
      contatoEmergenciaNome: texto(dto.contatoEmergenciaNome),
      contatoEmergenciaTelefone: texto(dto.contatoEmergenciaTelefone),

      objetivos: lista(dto.objetivos),
      experiencia: texto(dto.experiencia),

      profissao: texto(dto.profissao),
      posturaPredominante: texto(dto.posturaPredominante),
      movimentosRepetitivos: dto.movimentosRepetitivos ?? null,
      /**
       * O texto do "qual?" só é gravado quando a resposta é sim.
       *
       * Sem isso, quem escrevesse a resposta e depois voltasse para "não"
       * deixaria a explicação para trás, e a ficha do professor mostraria
       * "movimentos repetitivos: não" com um detalhe embaixo contando quais —
       * contradição que ninguém sabe resolver na hora da aula. Vale para os
       * quatro pares sim/texto abaixo.
       */
      movimentosRepetitivosQuais: dto.movimentosRepetitivos
        ? texto(dto.movimentosRepetitivosQuais)
        : null,

      patologias: lista(dto.patologias),
      patologiaOutra: texto(dto.patologiaOutra),

      usaMedicamento: dto.usaMedicamento ?? null,
      medicamentos: dto.usaMedicamento ? texto(dto.medicamentos) : null,
      fezCirurgia: dto.fezCirurgia ?? null,
      cirurgiaQual: dto.fezCirurgia ? texto(dto.cirurgiaQual) : null,
      temLesao: dto.temLesao ?? null,
      lesoes: dto.temLesao ? texto(dto.lesoes) : null,
      temDor: dto.temDor ?? null,
      dores: dto.temDor ? texto(dto.dores) : null,
      regioesDor: dto.temDor ? lista(dto.regioesDor) : null,

      parq: lista(dto.parq),
      observacoes: texto(dto.observacoes),
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
