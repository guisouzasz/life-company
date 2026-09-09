import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Apaga fichas de anamnese de cadastros que já foram excluídos.
 *
 * A exclusão definitiva anonimiza o cadastro e apaga treinos, cargas e
 * horários — mas deixava a anamnese para trás. Sobraram fichas de saúde
 * completas (lesão, cirurgia, medicamento controlado, patologia) penduradas em
 * registros que nem nome têm mais.
 *
 * O buraco já foi tapado na rota de exclusão. Isto aqui é a outra metade:
 * consertar o código não remove o que ficou, e o que ficou é justamente o dado
 * que não devia ter ficado.
 *
 * Roda em todo boot porque é barato e idempotente — depois da primeira
 * limpeza, a consulta não acha mais nada e a rotina não faz nada. Uma exclusão
 * feita por uma versão antiga do backend, num deploy em andamento, é pega no
 * boot seguinte.
 *
 * O critério é o `cpf` marcado com `REMOVIDO-`, que é a assinatura que a
 * exclusão deixa. Aluno apenas desativado ("não treina mais") NÃO entra: ele
 * pode voltar, e a ficha dele tem que estar lá quando voltar.
 */
export async function limparAnamneseOrfa(prisma: PrismaService): Promise<void> {
  const { count } = await prisma.anamnese.deleteMany({
    where: { usuario: { cpf: { startsWith: 'REMOVIDO-' } } },
  });

  if (count > 0) {
    new Logger('Anamnese').log(
      `${count} ficha(s) de anamnese de cadastro(s) excluído(s) foram apagadas — ` +
        'dado de saúde que não deveria ter sobrevivido à exclusão.',
    );
  }
}
