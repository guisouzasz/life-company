import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma.service';

/**
 * Cria (ou promove) o dono do sistema a partir de variáveis de ambiente.
 *
 * Por que por variável e não por uma tela: uma tela que dá poder de dono é
 * uma escada de privilégio — quem invadisse a conta da dona subiria sozinho.
 * A variável fica no painel da Railway, atrás de outro login, e é o único
 * lugar de onde essa marca pode nascer.
 *
 * Como usar, uma vez só:
 *   DONO_EMAIL=voce@exemplo.com
 *   DONO_SENHA_INICIAL=<senha longa>   ← só na PRIMEIRA vez
 *
 * Se já existe alguém com esse e-mail, só recebe a marca — a senha não é
 * tocada. Se não existe, o usuário é criado como ADMIN + dono com a senha
 * inicial.
 *
 * Depois do primeiro boot, APAGUE `DONO_SENHA_INICIAL` das variáveis e troque
 * a senha pelo app. Enquanto ela estiver lá, é uma senha guardada em texto no
 * painel.
 */
export async function garantirDono(prisma: PrismaService): Promise<void> {
  const log = new Logger('Dono');
  const email = process.env.DONO_EMAIL?.trim().toLowerCase();
  if (!email) return;

  const existente = await prisma.usuario.findUnique({ where: { email } });

  if (existente) {
    if (!existente.dono) {
      await prisma.usuario.update({ where: { id: existente.id }, data: { dono: true } });
      log.log(`marca de dono concedida a ${email}`);
    }
    return;
  }

  const senha = process.env.DONO_SENHA_INICIAL;
  if (!senha || senha.length < 10) {
    log.warn(
      `DONO_EMAIL=${email} não corresponde a nenhum cadastro. Para criar o ` +
        `usuário, defina também DONO_SENHA_INICIAL (mínimo 10 caracteres).`,
    );
    return;
  }

  /**
   * O CPF é obrigatório e único no cadastro, mas o dono não é aluno — não há
   * ficha, plano nem cobrança. Um marcador fixo evita pedir um CPF de verdade
   * só para satisfazer a coluna, e deixa claro na tabela que aquele registro
   * é o do sistema.
   */
  await prisma.usuario.create({
    data: {
      nome: process.env.DONO_NOME?.trim() || 'Dono do sistema',
      email,
      cpf: 'dono-do-sistema',
      senhaHash: await bcrypt.hash(senha, 10),
      tipoUsuario: 'ADMIN',
      dono: true,
      ativo: true,
    },
  });
  log.log(`usuário dono criado para ${email} — APAGUE DONO_SENHA_INICIAL das variáveis agora`);
}
