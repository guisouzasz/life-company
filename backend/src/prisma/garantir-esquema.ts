import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Ajustes ADITIVOS de esquema, aplicados no boot antes de a API aceitar
 * tráfego.
 *
 * Por que aqui e não numa migration: o projeto nunca usou `prisma migrate`
 * (não há histórico em `_prisma_migrations`), o banco de produção é mantido
 * com `db push` manual, e o deploy da Railway sobe o código novo sem rodar
 * nada antes. Sem esta garantia existiria uma janela em que o código novo
 * consulta colunas que o banco ainda não tem — e como o Prisma lista as
 * colunas explicitamente no SELECT, QUALQUER consulta a `usuarios` quebraria,
 * derrubando login, painel e agendamentos de uma vez.
 *
 * Regras do que pode entrar nesta lista:
 *  - só aditivo: ADD COLUMN anulável, CREATE INDEX, CREATE TABLE. Nunca DROP,
 *    RENAME ou mudança de tipo, que precisam de janela e revisão à parte;
 *  - idempotente (IF NOT EXISTS), porque roda em todo boot e em toda réplica;
 *  - barato: coluna anulável sem default não reescreve a tabela no Postgres,
 *    então o lock é instantâneo mesmo com gente usando o sistema.
 *
 * Um ajuste que falha derruba o boot de propósito: na Railway, deploy que não
 * sobe mantém a versão anterior no ar. Prefere-se o sistema continuar
 * funcionando na versão antiga a subir uma versão nova que responde 500.
 */
const AJUSTES: { descricao: string; sql: string }[] = [
  {
    // Confere com o `prisma migrate diff` da mudança da ficha cadastral.
    descricao: 'usuarios: ficha cadastral (rg, endereco, cep, data_nascimento)',
    sql: `ALTER TABLE "usuarios"
            ADD COLUMN IF NOT EXISTS "rg" TEXT,
            ADD COLUMN IF NOT EXISTS "endereco" TEXT,
            ADD COLUMN IF NOT EXISTS "cep" TEXT,
            ADD COLUMN IF NOT EXISTS "data_nascimento" TIMESTAMP(3)`,
  },
];

/**
 * Roda os ajustes em ordem. `$executeRawUnsafe` é necessário porque DDL não
 * aceita parâmetros — e o SQL aqui é constante do próprio código, nunca vem
 * de entrada do usuário.
 */
export async function garantirEsquema(prisma: PrismaService): Promise<void> {
  const log = new Logger('Esquema');
  for (const ajuste of AJUSTES) {
    try {
      await prisma.$executeRawUnsafe(ajuste.sql);
      log.log(`ok — ${ajuste.descricao}`);
    } catch (erro) {
      log.error(
        `falhou — ${ajuste.descricao}. A API não vai subir: com o banco desatualizado ` +
          `o código novo responderia erro em qualquer consulta a usuários.`,
        erro instanceof Error ? erro.stack : String(erro),
      );
      throw erro;
    }
  }
}
