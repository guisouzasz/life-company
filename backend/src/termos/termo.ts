/**
 * O termo que o aluno aceita no primeiro acesso.
 *
 * Fica aqui, e não no app, para o texto exibido e a versão gravada saírem
 * sempre da mesma fonte: se o app trouxesse a própria cópia, uma versão
 * antiga na loja registraria aceite de um texto que o estúdio já trocou.
 *
 * COMO ATUALIZAR: mude o texto e mude a `VERSAO` junto, sempre. A versão vai
 * gravada no aceite de cada aluno — é ela que diz qual redação a pessoa leu.
 * Quem já aceitou continua com a versão antiga registrada; para exigir o
 * aceite do texto novo de quem já usa o sistema é preciso uma tela à parte,
 * porque este termo só barra o primeiro acesso.
 */
export const VERSAO_TERMO = '2026-09-09';

export interface SecaoDoTermo {
  titulo: string;
  /** Parágrafo de abertura da seção, quando ela tem um. */
  texto?: string;
  itens: string[];
}

export const TERMO = {
  versao: VERSAO_TERMO,
  titulo: 'Termo de Normas, Políticas de Agendamento e Pagamento',
  abertura:
    'Seja muito bem-vindo(a)! Para mantermos a excelência do nosso atendimento, ' +
    'a organização das turmas e o respeito aos horários de todos, estabelecemos ' +
    'as seguintes diretrizes internas:',
  secoes: [
    {
      titulo: '1. Canal oficial e horário de atendimento',
      itens: [
        'Canal exclusivo: Todo o suporte administrativo e dúvidas devem ser realizados unicamente pelo WhatsApp oficial da academia.',
        'Horário de atendimento: De segunda a sexta-feira, das 08h às 20h (com intervalo para almoço das 12h às 13h).',
        'Retorno de mensagens: Mensagens enviadas fora do horário de atendimento serão respondidas no próximo turno útil.',
      ],
    },
    {
      titulo: '2. Prazos para aviso de faltas',
      texto:
        'Para ter direito ao crédito de reposição, o aviso prévio de ausência deve ser enviado dentro dos seguintes prazos:',
      itens: [
        'Turno da Manhã (05h30 às 11h30): Avisar até as 20h do dia anterior.',
        'Turno da Tarde (13h00 às 17h00): Avisar até as 10h do mesmo dia.',
        'Turno da Noite (18h00 às 22h00): Avisar até as 14h do mesmo dia.',
        'Faltas não registradas ou informadas fora desses prazos serão contabilizadas normalmente como aula realizada, sem direito a reposição.',
      ],
    },
    {
      titulo: '3. Política de reposição de aulas',
      itens: [
        'Agendamento autônomo: A marcação de reposições é feita exclusivamente pelo aluno através do site oficial da academia. Não serão aceitos agendamentos via WhatsApp.',
        'Limite e validade: Cada aluno pode agendar até 3 (três) reposições a cada 30 dias. O crédito gerado por uma falta expira em 30 dias corridos a contar da data da aula cancelada.',
        'Disponibilidade de vagas: As reposições estão sujeitas à existência de vagas nos horários desejados.',
        'Compromisso de presença: Uma vez agendada no sistema, a reposição é confirmada e não permite novo cancelamento ou reagendamento.',
        'Regras gerais: O crédito de reposição é pessoal e intransferível. Faltas em dias de feriados (quando a academia não abre) não geram direito a reposição.',
      ],
    },
    {
      titulo: '4. Recesso de fim de ano',
      itens: [
        'A academia suspende suas atividades no período compreendido entre o Natal e o Ano Novo.',
        'As aulas deste período integram o planejamento anual do plano e são contabilizadas regularmente, não havendo direito a desconto, reposição ou abatimento na mensalidade.',
      ],
    },
    {
      titulo: '5. Mensalidades e cancelamentos',
      itens: [
        'Pagamento antecipado: As mensalidades devem ser quitadas previamente à data de início do ciclo para assegurar a permanência da vaga.',
        'Forma de pagamento: Efetuado exclusivamente pelo site oficial, sendo obrigatório o envio/upload do comprovante de pagamento.',
        'Manutenção de horário: Em caso de viagens, licenças médicas ou ausências temporárias, o pagamento integral da mensalidade é indispensável para manter o horário e a vaga reservados na grade.',
        'Cancelamento ou pausa: Solicitações de cancelamento ou pausa devem ser formalizadas via WhatsApp oficial antes da data de vencimento da próxima mensalidade. Solicitações feitas a partir da data de vencimento não isentam a cobrança do ciclo.',
      ],
    },
  ] as SecaoDoTermo[],
  declaracao:
    'Declaro que li, compreendi e concordo integralmente com todas as normas, ' +
    'prazos e condições descritas neste termo.',
} as const;
