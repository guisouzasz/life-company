import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Conserta o significado de `ativo` nos cadastros antigos.
 *
 * O campo carregava duas perguntas ao mesmo tempo: "já fez o primeiro acesso?"
 * e "treina aqui?". Cadastro novo nascia `ativo: false` só para dizer que
 * ainda não tinha aberto o app — e, na tela, isso aparecia como aluno
 * desligado. Pior: não havia como marcar "parou de treinar" em quem nunca
 * tinha entrado, porque já estava falso.
 *
 * Agora `ativo` quer dizer uma coisa só: treina aqui. "Já fez o primeiro
 * acesso" é `senhaHash != null`.
 *
 * Esta rotina traz para o novo significado quem ficou preso no antigo: aluno
 * inativo que NUNCA teve senha estava assim só por não ter aberto o app, e
 * portanto treina. Quem a dona desligou de verdade tem senha e não é tocado.
 *
 * Roda em todo boot porque é barata e idempotente. E roda ANTES da limpeza
 * dos inativos — que agora olha só `ativo` e, sem esta correção, tiraria das
 * turmas justamente quem ainda não abriu o app.
 */
export async function corrigirMatricula(prisma: PrismaService): Promise<void> {
  const log = new Logger('Matricula');

  const { count } = await prisma.usuario.updateMany({
    where: { tipoUsuario: 'ALUNO', ativo: false, senhaHash: null },
    data: { ativo: true },
  });

  if (count > 0) {
    log.log(
      `${count} aluno(s) estavam marcados como inativos só por ainda não terem ` +
        'feito o primeiro acesso. Agora constam como treinando.',
    );
  }
}
