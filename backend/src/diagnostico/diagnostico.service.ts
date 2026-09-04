import { Injectable, Logger } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { AutoAgendamentoService } from '../auto-agendamento/auto-agendamento.service';
import { varrerHorariosFixos, type Varredura } from './varredura-horarios-fixos';

/**
 * Até onde as aulas são remarcadas ao devolver os horários fixos.
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
   * Devolve os horários fixos desligados de quem TREINA.
   *
   * A única ação de escrita do diagnóstico, e ela existe porque o estrago que
   * conserta não tem outra saída pela tela: a combinação está apagada, então
   * nenhuma aula nova nasce e não há nada em que a dona possa tocar para
   * trazê-la de volta.
   *
   * Só mexe em aluno ATIVO. Quem está marcado como "não treina mais" não é
   * tocado — devolver turma a quem saiu é decisão da dona, feita no botão da
   * lista de alunos.
   *
   * E remarca as aulas na hora, sem esperar a Agenda ser aberta.
   *
   * Ligar a combinação de volta e parar aí deixava um buraco feio: a
   * conferência rodada logo em seguida acusava, em vermelho, os MESMOS alunos
   * — agora por "horário fixo sem aula marcada" — e mandava recadastrar um por
   * um. Quem apertou o botão concluía que não tinha funcionado e ia fazer à
   * mão exatamente o que o botão acabou de fazer.
   *
   * A geração é a mesma do cron e da Agenda (`criarComoAdmin`), então a
   * lotação da turma e a cota do plano continuam valendo: nenhuma aula entra
   * aqui que não entraria por lá.
   */
  async restaurarHorariosFixos() {
    const { count } = await this.prisma.horarioFixo.updateMany({
      where: { ativo: false, usuario: { ativo: true, tipoUsuario: 'ALUNO' } },
      data: { ativo: true },
    });

    if (count === 0) {
      return { devolvidos: 0, aulasRemarcadas: 0, mensagem: 'Não havia horário fixo desligado para devolver.' };
    }

    /**
     * A remarcação é o acabamento, não o serviço. Se ela falhar — turma que
     * encheu no meio tempo, banco lento — os horários fixos já estão de volta
     * e o cron das 3h termina o trabalho. Melhor devolver com menos aulas do
     * que derrubar tudo e deixar a grade apagada mais um dia.
     */
    let aulasRemarcadas = 0;
    try {
      const hoje = dayjs().startOf('day');
      const geracao = await this.autoAgendamento.gerarAgendamentosFixosNoPeriodo(
        hoje.toDate(),
        hoje.add(JANELA_DIAS, 'day').toDate(),
      );
      aulasRemarcadas = geracao.criados;
    } catch (e: any) {
      this.logger.warn(`Horários fixos devolvidos, mas a remarcação falhou: ${e?.message ?? e}`);
    }

    return {
      devolvidos: count,
      aulasRemarcadas,
      mensagem:
        aulasRemarcadas > 0
          ? `${count} horário(s) fixo(s) devolvido(s) e ${aulasRemarcadas} aula(s) remarcada(s) até ${hojeMais(JANELA_DIAS)}.`
          : `${count} horário(s) fixo(s) devolvido(s). As aulas aparecem ao abrir a Agenda da semana.`,
    };
  }
}
