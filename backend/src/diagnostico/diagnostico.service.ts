import { Injectable, Logger } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { AutoAgendamentoService } from '../auto-agendamento/auto-agendamento.service';
import { DevolverHorariosFixosDto } from './dto/devolver-horarios-fixos.dto';
import { varrerHorariosFixos, type Varredura } from './varredura-horarios-fixos';
import { levantarCadastrosRemovidos, type RelatorioRemovidos } from './cadastros-removidos';

/**
 * Até onde as aulas são remarcadas ao devolver um horário fixo.
 *
 * Mesma janela do auto-agendamento: o mês corrente e o seguinte, que é o
 * horizonte em que o estúdio pensa. Daí para frente o cron das 3h e a própria
 * Agenda da semana continuam empurrando sozinhos.
 */
const JANELA_DIAS = 56;

/** "até 30/10" — a data que o estúdio já tem pronta, em português de recado. */
function hojeMais(dias: number) {
  return dayjs().add(dias, 'day').format('DD/MM');
}

@Injectable()
export class DiagnosticoService {
  private readonly logger = new Logger(DiagnosticoService.name);

  constructor(
    private prisma: PrismaService,
    private autoAgendamento: AutoAgendamentoService,
  ) {}

  /** A varredura dos horários fixos. Só leitura — pode rodar com o estúdio aberto. */
  horariosFixos(): Promise<Varredura> {
    return varrerHorariosFixos(this.prisma);
  }

  /**
   * O que dá para saber de quem foi excluído definitivamente.
   *
   * Só leitura, e não desfaz nada — a exclusão não tem volta. Serve para
   * recadastrar sem depender da memória de ninguém: nome, e-mail, plano e,
   * principalmente, em que turmas a pessoa vinha, que os agendamentos ainda
   * provam.
   */
  cadastrosRemovidos(): Promise<RelatorioRemovidos> {
    return levantarCadastrosRemovidos(this.prisma);
  }

  /**
   * Devolve os horários fixos que o dono MARCOU na conferência.
   *
   * Existe porque o estrago que conserta não tem outra saída pela tela: a
   * combinação está apagada, então nenhuma aula nova nasce e não há nada em
   * que tocar para trazê-la de volta. Sem isto, remontar a grade de um estúdio
   * inteiro é abrir trinta cadastros.
   *
   * O que ela NÃO faz é devolver tudo. Um horário removido de propósito e um
   * apagado por engano são a mesma linha no banco — a tabela não guarda quando
   * cada um foi desligado. Em vez de escolher por conta própria (e às vezes
   * errar em silêncio), a rota pede a lista: quem sabe a resposta é quem
   * administra o estúdio, e ele acabou de ler os nomes na tela.
   *
   * Cada id ainda passa pelas mesmas regras de sempre. Devolver não é abrir
   * exceção: é refazer o caminho normal para uma linha que já existia.
   */
  async restaurarHorariosFixos(dto: DevolverHorariosFixosDto) {
    const pedidos = [...new Set(dto.ids)];

    const fixos = await this.prisma.horarioFixo.findMany({
      where: { id: { in: pedidos }, ativo: false },
      include: {
        usuario: {
          select: {
            id: true, nome: true, ativo: true, tipoUsuario: true,
            usuarioPlanos: { where: { vigenciaFim: null }, include: { plano: true } },
            horariosFixos: { where: { ativo: true }, select: { id: true } },
          },
        },
        horario: { select: { id: true, ativo: true, diaSemana: true, horaInicio: true } },
      },
    });

    const devolvidos: string[] = [];
    const recusados: { nome: string; motivo: string }[] = [];
    /**
     * Quantos fixos cada aluno já tem valendo, contando os que acabaram de
     * entrar nesta mesma chamada. Sem este acumulador, devolver três horários
     * de um aluno de plano 2x passaria os três: cada um olharia a contagem
     * antes de qualquer devolução e concluiria que ainda cabe.
     */
    const jaAtivos = new Map<string, number>();

    for (const fixo of fixos) {
      const { usuario, horario } = fixo;
      const chave = `${usuario.nome} — ${horario.diaSemana.toLowerCase()} ${horario.horaInicio}`;

      if (usuario.tipoUsuario !== 'ALUNO' || !usuario.ativo) {
        recusados.push({ nome: chave, motivo: 'está marcado como "não treina mais"' });
        continue;
      }
      if (!horario.ativo) {
        recusados.push({ nome: chave, motivo: 'a turma está desligada' });
        continue;
      }
      const plano = usuario.usuarioPlanos[0]?.plano;
      if (!plano) {
        recusados.push({ nome: chave, motivo: 'não tem plano ativo' });
        continue;
      }

      const atuais = jaAtivos.get(usuario.id) ?? usuario.horariosFixos.length;
      if (atuais >= plano.aulasSemanais) {
        recusados.push({
          nome: chave,
          motivo: `o plano ${plano.nome} já está completo (${plano.aulasSemanais}x)`,
        });
        continue;
      }

      await this.prisma.horarioFixo.update({ where: { id: fixo.id }, data: { ativo: true } });
      jaAtivos.set(usuario.id, atuais + 1);
      devolvidos.push(fixo.id);
    }

    /**
     * A remarcação é o acabamento, não o serviço. Se ela falhar — turma que
     * encheu no meio tempo, banco lento — os horários já estão de volta e o
     * cron das 3h termina. Melhor devolver com menos aulas do que derrubar
     * tudo e deixar a grade apagada mais um dia.
     *
     * Ela também é o que faz a conferência seguinte vir limpa: devolver a
     * combinação e parar aí fazia a tela acusar os MESMOS alunos, agora por
     * "fixo sem aula marcada", e quem apertou o botão concluía que não tinha
     * funcionado.
     */
    let aulasRemarcadas = 0;
    if (devolvidos.length > 0) {
      try {
        const hoje = dayjs().startOf('day');
        const geracao = await this.autoAgendamento.gerarAgendamentosFixosNoPeriodo(
          hoje.toDate(),
          hoje.add(JANELA_DIAS, 'day').toDate(),
        );
        aulasRemarcadas = geracao.criados;
      } catch (e: any) {
        this.logger.warn(`Horários devolvidos, mas a remarcação falhou: ${e?.message ?? e}`);
      }
    }

    return {
      devolvidos: devolvidos.length,
      aulasRemarcadas,
      recusados,
      mensagem: montarMensagem(devolvidos.length, aulasRemarcadas, recusados.length),
    };
  }
}

/** O recado da tela: o que entrou, até quando, e o que ficou de fora. */
function montarMensagem(devolvidos: number, aulas: number, recusados: number): string {
  if (devolvidos === 0) {
    return recusados > 0
      ? 'Nenhum horário foi devolvido — veja abaixo o motivo de cada um.'
      : 'Nada a devolver: esses horários já estavam valendo.';
  }
  const inicio =
    aulas > 0
      ? `${devolvidos} horário(s) devolvido(s) e ${aulas} aula(s) remarcada(s) até ${hojeMais(JANELA_DIAS)}.`
      : `${devolvidos} horário(s) devolvido(s). As aulas aparecem ao abrir a Agenda da semana.`;
  return recusados > 0 ? `${inicio} ${recusados} não entrou/entraram — veja o motivo abaixo.` : inicio;
}
