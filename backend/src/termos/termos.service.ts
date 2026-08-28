import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TERMO, VERSAO_TERMO } from './termo';

@Injectable()
export class TermosService {
  constructor(private prisma: PrismaService) {}

  /**
   * Situação do aluno logado diante do termo vigente.
   *
   * Serve para quem já usava o sistema antes do termo existir, e para quando
   * o estúdio publicar uma redação nova: o aceite do primeiro acesso barra só
   * quem entra agora, e sem isto a turma antiga nunca veria o texto.
   *
   * Professor e admin nunca precisam — o termo fala de mensalidade e
   * reposição de aula, que é a relação do estúdio com o aluno.
   */
  async situacao(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { tipoUsuario: true },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    if (usuario.tipoUsuario !== 'ALUNO') {
      return { precisaAceitar: false, versao: VERSAO_TERMO, aceitoEm: null };
    }
    const aceite = await this.prisma.aceiteTermo.findUnique({
      where: { usuarioId_versao: { usuarioId, versao: VERSAO_TERMO } },
      select: { aceitoEm: true },
    });
    return {
      precisaAceitar: !aceite,
      versao: VERSAO_TERMO,
      aceitoEm: aceite?.aceitoEm ?? null,
    };
  }

  /**
   * Registra o aceite de quem já está logado.
   *
   * `upsert` em vez de `create`: dois toques no botão, ou a tela reenviando,
   * não podem virar erro de chave repetida na cara do aluno — o aceite é o
   * mesmo fato, e a data que vale é a da primeira vez.
   */
  async aceitar(usuarioId: string, versao: string) {
    if (versao !== VERSAO_TERMO) {
      throw new BadRequestException(
        'O termo foi atualizado enquanto você lia. Recarregue a página e leia a versão nova.',
      );
    }
    const aceite = await this.prisma.aceiteTermo.upsert({
      where: { usuarioId_versao: { usuarioId, versao } },
      create: { usuarioId, versao },
      update: {},
      select: { versao: true, aceitoEm: true },
    });
    return { ...aceite, titulo: TERMO.titulo };
  }
}
