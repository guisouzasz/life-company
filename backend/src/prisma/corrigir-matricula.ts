import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Cadastros sem senha podem ter sido desligados de propósito.
 * O boot apenas informa a quantidade; a reativação depende da dona.
 */
export async function corrigirMatricula(prisma: PrismaService): Promise<void> {
  const count = await prisma.usuario.count({
    where: { tipoUsuario: 'ALUNO', ativo: false, senhaHash: null, NOT: { cpf: { startsWith: 'REMOVIDO-' } } },
  });
  if (count > 0) {
    new Logger('Matricula').log(
      `${count} aluno(s) inativo(s) sem primeiro acesso. Estado preservado; revisão disponível no cadastro.`,
    );
  }
}
