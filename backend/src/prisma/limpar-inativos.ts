import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Tira das turmas os alunos que já foram desativados.
 *
 * Até agora, desativar um aluno só marcava `ativo: false`: os horários fixos
 * dele continuavam ativos, as aulas futuras continuavam confirmadas, e o cron
 * das 3h seguia gerando aulas novas. Como a lotação conta agendamento
 * confirmado sem olhar se a pessoa ainda é aluna, as turmas do estúdio foram
 * enchendo de gente que não treina mais — e a dona levava "turma lotada" ao
 * tentar colocar alguém num horário fixo.
 *
 * O conserto está no `excluir()`, mas ele só vale para quem for desativado de
 * agora em diante. Esta rotina arruma o que já ficou para trás. Roda em todo
 * boot porque é barata e idempotente: depois da primeira vez não há mais nada
 * para corrigir e ela não faz nada.
 *
 * O critério é só `ativo`: o campo quer dizer "treina aqui" e nada mais.
 * Cadastro novo nasce treinando, então ele não cai aqui por engano — o que
 * antes exigia checar `senhaHash` junto.
 */
export async function limparInativos(prisma: PrismaService): Promise<void> {
  const log = new Logger('Inativos');

  const desativados = await prisma.usuario.findMany({
    where: { ativo: false, tipoUsuario: 'ALUNO' },
    select: { id: true },
  });
  if (desativados.length === 0) return;

  const ids = desativados.map((u) => u.id);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const { count: fixos } = await prisma.horarioFixo.updateMany({
    where: { usuarioId: { in: ids }, ativo: true },
    data: { ativo: false },
  });

  const { count: aulas } = await prisma.agendamento.updateMany({
    where: {
      usuarioId: { in: ids },
      status: 'CONFIRMADO',
      dataAula: { gte: hoje },
    },
    data: { status: 'CANCELADO' },
  });

  if (fixos > 0 || aulas > 0) {
    log.log(
      `alunos desativados que ainda ocupavam turma: ${fixos} horário(s) fixo(s) desligado(s) ` +
        `e ${aulas} aula(s) futura(s) cancelada(s). As vagas voltaram para as turmas.`,
    );
  }
}
