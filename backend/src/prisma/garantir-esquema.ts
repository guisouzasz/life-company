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
  {
    // Sem esta tabela o primeiro acesso quebraria: ele grava o aceite do termo
    // na mesma transação que cria a senha do aluno.
    descricao: 'aceites_termo: aceite do termo de normas no primeiro acesso',
    sql: `CREATE TABLE IF NOT EXISTS "aceites_termo" (
            "id" TEXT NOT NULL,
            "usuario_id" TEXT NOT NULL,
            "versao" TEXT NOT NULL,
            "aceito_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "aceites_termo_pkey" PRIMARY KEY ("id")
          )`,
  },
  {
    descricao: 'aceites_termo: um aceite por versão, por aluno',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "aceites_termo_usuario_id_versao_key"
            ON "aceites_termo" ("usuario_id", "versao")`,
  },
  {
    // Mesma chave estrangeira que o `db push` cria, para a tabela nascer aqui
    // idêntica à que o Prisma espera. Postgres não tem ADD CONSTRAINT IF NOT
    // EXISTS, daí o bloco que engole o erro de constraint repetida.
    descricao: 'aceites_termo: chave estrangeira para usuarios',
    sql: `DO $$ BEGIN
            ALTER TABLE "aceites_termo"
              ADD CONSTRAINT "aceites_termo_usuario_id_fkey"
              FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
              ON DELETE RESTRICT ON UPDATE CASCADE;
          EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  },
  {
    // A marca do dono. Coluna com DEFAULT false: no Postgres moderno isso não
    // reescreve a tabela, então o lock é instantâneo mesmo com gente usando.
    descricao: 'usuarios: marca de dono (vê o registro de ações)',
    sql: `ALTER TABLE "usuarios"
            ADD COLUMN IF NOT EXISTS "dono" BOOLEAN NOT NULL DEFAULT false`,
  },
  {
    // Sem esta tabela o interceptador de auditoria falharia em toda escrita —
    // e escrita é justamente o que o estúdio faz o dia inteiro.
    descricao: 'logs_acao: registro do que o estúdio fez',
    sql: `CREATE TABLE IF NOT EXISTS "logs_acao" (
            "id" TEXT NOT NULL,
            "usuario_id" TEXT,
            "usuario_nome" TEXT NOT NULL,
            "usuario_tipo" TEXT NOT NULL,
            "metodo" TEXT NOT NULL,
            "rota" TEXT NOT NULL,
            "resumo" TEXT NOT NULL,
            "entidade_id" TEXT,
            "detalhe" TEXT,
            "status" INTEGER NOT NULL,
            "ip" TEXT,
            "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "logs_acao_pkey" PRIMARY KEY ("id")
          )`,
  },
  {
    // Um comando por ajuste: `$executeRawUnsafe` roda UMA instrução, e dois
    // CREATE INDEX separados por ponto e vírgula fazem o boot falhar.
    descricao: 'logs_acao: índice de data (a lista do mais recente)',
    sql: `CREATE INDEX IF NOT EXISTS "logs_acao_criado_em_idx" ON "logs_acao"("criado_em")`,
  },
  {
    descricao: 'logs_acao: índice de autor + data (o filtro por pessoa)',
    sql: `CREATE INDEX IF NOT EXISTS "logs_acao_usuario_id_criado_em_idx" ON "logs_acao"("usuario_id", "criado_em")`,
  },
  {
    descricao: 'logs_acao: chave estrangeira para usuarios',
    sql: `DO $$ BEGIN
            ALTER TABLE "logs_acao"
              ADD CONSTRAINT "logs_acao_usuario_id_fkey"
              FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
              ON DELETE SET NULL ON UPDATE CASCADE;
          EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  },
  {
    // A ficha de anamnese foi reescrita a pedido do estúdio: contato de
    // emergência, fatores da profissão, patologias em lista, PAR-Q e as
    // regiões de dor marcadas no boneco. Tudo anulável e aditivo — as
    // colunas antigas ficam, porque guardam o que os alunos já responderam.
    descricao: 'anamneses: ficha reescrita (emergência, profissão, patologias, PAR-Q, dor)',
    sql: `ALTER TABLE "anamneses"
            ADD COLUMN IF NOT EXISTS "contato_emergencia_nome" TEXT,
            ADD COLUMN IF NOT EXISTS "contato_emergencia_telefone" TEXT,
            ADD COLUMN IF NOT EXISTS "objetivos" TEXT,
            ADD COLUMN IF NOT EXISTS "experiencia" TEXT,
            ADD COLUMN IF NOT EXISTS "profissao" TEXT,
            ADD COLUMN IF NOT EXISTS "postura_predominante" TEXT,
            ADD COLUMN IF NOT EXISTS "movimentos_repetitivos" BOOLEAN,
            ADD COLUMN IF NOT EXISTS "movimentos_repetitivos_quais" TEXT,
            ADD COLUMN IF NOT EXISTS "patologias" TEXT,
            ADD COLUMN IF NOT EXISTS "patologia_outra" TEXT,
            ADD COLUMN IF NOT EXISTS "usa_medicamento" BOOLEAN,
            ADD COLUMN IF NOT EXISTS "fez_cirurgia" BOOLEAN,
            ADD COLUMN IF NOT EXISTS "cirurgia_qual" TEXT,
            ADD COLUMN IF NOT EXISTS "tem_lesao" BOOLEAN,
            ADD COLUMN IF NOT EXISTS "tem_dor" BOOLEAN,
            ADD COLUMN IF NOT EXISTS "regioes_dor" TEXT,
            ADD COLUMN IF NOT EXISTS "parq" TEXT`,
  },
  {
    // Professor em mais de uma modalidade (Gabriele: Musculação e Funcional).
    // Sem esta tabela, qualquer tela de professor quebraria: é daqui que sai
    // o que ele enxerga na agenda e nos treinos.
    descricao: 'professor_modalidades: modalidades de cada professor',
    sql: `CREATE TABLE IF NOT EXISTS "professor_modalidades" (
            "professor_id" TEXT NOT NULL,
            "modalidade_id" TEXT NOT NULL,
            CONSTRAINT "professor_modalidades_pkey" PRIMARY KEY ("professor_id", "modalidade_id")
          )`,
  },
  {
    descricao: 'professor_modalidades: chave estrangeira para usuarios',
    sql: `DO $$ BEGIN
            ALTER TABLE "professor_modalidades"
              ADD CONSTRAINT "professor_modalidades_professor_id_fkey"
              FOREIGN KEY ("professor_id") REFERENCES "usuarios"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  },
  {
    descricao: 'professor_modalidades: chave estrangeira para modalidades',
    sql: `DO $$ BEGIN
            ALTER TABLE "professor_modalidades"
              ADD CONSTRAINT "professor_modalidades_modalidade_id_fkey"
              FOREIGN KEY ("modalidade_id") REFERENCES "modalidades"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  },
  {
    /**
     * Traz para a tabela nova a modalidade que cada professor já tinha.
     *
     * Roda em todo boot e não desfaz nada: a modalidade principal
     * (`modalidade_professor_id`) é sempre a primeira da lista — a edição
     * mantém as duas em dia —, então ela já está na tabela e o INSERT não
     * encontra nada a fazer. Só tem efeito na primeira subida, e se uma versão
     * anterior da API trocar a principal de alguém no meio do caminho.
     */
    descricao: 'professor_modalidades: modalidade que cada professor já tinha',
    sql: `INSERT INTO "professor_modalidades" ("professor_id", "modalidade_id")
            SELECT "id", "modalidade_professor_id" FROM "usuarios"
            WHERE "tipo_usuario" = 'PROFESSOR' AND "modalidade_professor_id" IS NOT NULL
          ON CONFLICT DO NOTHING`,
  },
  {
    // Aquecimento antes dos exercícios e a ordem das fichas, pedidos pelo
    // professor da musculação. Colunas anuláveis: nada muda no que existe.
    descricao: 'treinos: texto antes dos exercícios e ordem da ficha',
    sql: `ALTER TABLE "treinos"
            ADD COLUMN IF NOT EXISTS "texto_antes" TEXT,
            ADD COLUMN IF NOT EXISTS "ordem" INTEGER`,
  },
  {
    // Feriado e recesso: o dia que a dona fecha na agenda. Sem esta tabela a
    // marcação de aula quebraria — é ela que diz se o dia está aberto.
    descricao: 'dias_fechados: dias em que a academia não abre',
    sql: `CREATE TABLE IF NOT EXISTS "dias_fechados" (
            "id" TEXT NOT NULL,
            "data" TIMESTAMP(3) NOT NULL,
            "motivo" TEXT NOT NULL,
            "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "dias_fechados_pkey" PRIMARY KEY ("id")
          )`,
  },
  {
    descricao: 'dias_fechados: um registro por dia',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "dias_fechados_data_key" ON "dias_fechados"("data")`,
  },
  {
    descricao: 'agendamentos: dia fechado que tirou a aula da agenda',
    sql: `ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "dia_fechado_id" TEXT`,
  },
  {
    descricao: 'agendamentos: chave estrangeira para dias_fechados',
    sql: `DO $$ BEGIN
            ALTER TABLE "agendamentos"
              ADD CONSTRAINT "agendamentos_dia_fechado_id_fkey"
              FOREIGN KEY ("dia_fechado_id") REFERENCES "dias_fechados"("id")
              ON DELETE SET NULL ON UPDATE CASCADE;
          EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
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
