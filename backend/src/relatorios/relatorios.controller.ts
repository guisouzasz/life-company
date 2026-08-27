import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import * as dayjs from 'dayjs';
import { Prisma } from '@prisma/client';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { capacidadeEfetiva } from '../horarios/capacidade';

(dayjs as any).extend((isoWeek as any).default || isoWeek);

@ApiTags('relatorios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('relatorios')
export class RelatoriosController {
  constructor(private prisma: PrismaService) {}

  @Get('dashboard')
  async dashboard() {
    const inicioSemana = dayjs().startOf('isoWeek').toDate();
    const fimSemana = dayjs().endOf('isoWeek').toDate();

    const DIAS = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'] as const;
    const hojeIdx = (dayjs() as any).isoWeekday(); // 1..7
    const diaHoje = hojeIdx <= 5 ? DIAS[hojeIdx - 1] : null; // fim de semana: sem aulas
    const inicioHoje = dayjs().startOf('day').toDate();
    const fimHoje = dayjs().endOf('day').toDate();

    const ontemIni = dayjs().subtract(1, 'day').startOf('day').toDate();
    const ontemFim = dayjs().subtract(1, 'day').endOf('day').toDate();

    const [totalAlunos, alunosAtivos, aulasSemana, presencas, faltas, agsSemana, horariosHoje, canceladosOntemRaw, creditosValidos, aguardandoAcessoRaw] = await Promise.all([
      this.prisma.usuario.count({ where: { tipoUsuario: 'ALUNO' } }),
      this.prisma.usuario.count({ where: { tipoUsuario: 'ALUNO', ativo: true } }),
      /**
       * A aula dada continua sendo aula da semana.
       *
       * Contar só CONFIRMADO fazia o número MINGUAR conforme a semana
       * acontecia — na sexta a dona via menos aulas do que na segunda, porque
       * cada presença registrada muda o agendamento para REALIZADO. E como a
       * ocupação divide as presenças por este total, ela passava de 100%
       * (chegou a 255% com três semanas de histórico).
       */
      this.prisma.agendamento.count({ where: { status: { in: ['CONFIRMADO', 'REALIZADO'] }, dataAula: { gte: inicioSemana, lte: fimSemana } } }),
      this.prisma.presenca.count({ where: { compareceu: true, registradoEm: { gte: inicioSemana } } }),
      this.prisma.presenca.count({ where: { compareceu: false, registradoEm: { gte: inicioSemana } } }),
      // Agrupamos pelo diaSemana do horário (evita ambiguidade de fuso do dataAula)
      this.prisma.agendamento.findMany({
        where: { status: { in: ['CONFIRMADO', 'REALIZADO'] }, dataAula: { gte: inicioSemana, lte: fimSemana } },
        select: { horario: { select: { diaSemana: true } } },
      }),
      diaHoje
        ? this.prisma.horario.findMany({
            where: { ativo: true, diaSemana: diaHoje },
            include: {
              modalidade: { select: { nome: true } },
              _count: { select: { agendamentos: { where: { status: 'CONFIRMADO', dataAula: { gte: inicioHoje, lte: fimHoje } } } } },
            },
            orderBy: { horaInicio: 'asc' },
          })
        : Promise.resolve([]),
      // Resumo de ontem: aulas de ontem que constam como canceladas
      this.prisma.agendamento.findMany({
        where: { status: 'CANCELADO', dataAula: { gte: ontemIni, lte: ontemFim } },
        include: {
          usuario: { select: { nome: true } },
          horario: { select: { horaInicio: true, modalidade: { select: { nome: true } } } },
        },
        orderBy: { horario: { horaInicio: 'asc' } },
      }),
      // Reposições pendentes: créditos válidos ainda não usados (quem falta remarcar)
      this.prisma.creditoReposicao.findMany({
        where: { usado: false, revogado: false, expiraEm: { gt: new Date() } },
        include: { usuario: { select: { nome: true } } },
      }),
      // Alunos cadastrados que ainda não ativaram a conta
      this.prisma.usuario.findMany({
        where: { tipoUsuario: 'ALUNO', ativo: false, senhaHash: null },
        select: { nome: true },
      }),
    ]);

    const ocupacao = aulasSemana > 0 ? Math.round((presencas / aulasSemana) * 100) : 0;
    const aulasPorDia = DIAS.map((dia) => ({
      dia,
      total: agsSemana.filter((a) => a.horario.diaSemana === dia).length,
    }));
    const aulasHoje = horariosHoje.map((h) => ({
      horarioId: h.id,
      horaInicio: h.horaInicio,
      horaFim: h.horaFim,
      modalidade: h.modalidade.nome,
      agendados: h._count.agendamentos,
      // O teto da modalidade, não só o número gravado: turma de Pilates salva
      // com 4 mostraria "3/4" no painel e pareceria ter vaga que a API recusa.
      capacidade: capacidadeEfetiva(h.capacidadeMaxima, h.modalidade.nome),
    }));

    const canceladosOntem = canceladosOntemRaw.map((a) => ({
      nome: a.usuario.nome,
      horaInicio: a.horario.horaInicio,
      modalidade: a.horario.modalidade.nome,
    }));

    // Agrupa créditos válidos por aluno (quem cancelou e ainda não remarcou)
    const porAluno = new Map<string, number>();
    creditosValidos.forEach((c) => porAluno.set(c.usuario.nome, (porAluno.get(c.usuario.nome) ?? 0) + 1));
    const reposicoesPendentes = {
      total: creditosValidos.length,
      alunos: [...porAluno.entries()].map(([nome, creditos]) => ({ nome, creditos })),
    };

    const aguardandoAcesso = {
      total: aguardandoAcessoRaw.length,
      nomes: aguardandoAcessoRaw.map((u) => u.nome),
    };

    return {
      totalAlunos, alunosAtivos, aulasSemana, presencas, faltas, ocupacao, aulasPorDia, aulasHoje,
      canceladosOntem, reposicoesPendentes, aguardandoAcesso,
      aniversariantes: await this.aniversariantesDaSemana(),
    };
  }

  /**
   * Alunos que fazem aniversário na semana corrente. Lista vazia quando não
   * há ninguém — é o que faz o card sumir da tela em vez de aparecer vazio.
   *
   * As datas vêm do Node, que roda no fuso do estúdio (ver timezone.ts), e
   * NÃO de CURRENT_DATE: o Postgres da Railway está em UTC e depois das 21h
   * já teria virado o dia, marcando como "hoje" quem é de amanhã.
   *
   * Só entram alunos ativos: quem foi desativado não deve mais aparecer no
   * painel.
   */
  private async aniversariantesDaSemana() {
    /**
     * A semana inteira, de segunda a domingo, marcando quem é do dia.
     *
     * Antes só mostrava o dia: na maioria dos dias o card sumia, e quando
     * aparecia já era em cima da hora. Com a semana à vista, a dona consegue
     * preparar o parabéns antes — e continua vendo em destaque quem é hoje.
     */
    const hoje = dayjs().startOf('day');
    const inicio = hoje.startOf('isoWeek');

    // Um par (mês, dia) por data da semana. Montado em JS de propósito: a
    // semana atravessa mês (e às vezes ano), e comparar por intervalo de data
    // não funciona para aniversário, que ignora o ano.
    const diasDaSemana = Array.from({ length: 7 }, (_, i) => inicio.add(i, 'day'));
    const pares = diasDaSemana.map((d) => {
      const ano = d.year();
      const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
      // Quem nasceu em 29/02 comemora no dia 28 nos anos não bissextos,
      // senão passaria três anos sem aparecer.
      const dias = !bissexto && d.month() + 1 === 2 && d.date() === 28 ? [28, 29] : [d.date()];
      return { data: d, mes: d.month() + 1, dias };
    });

    const condicoes = Prisma.join(
      pares.map(
        (p) => Prisma.sql`(EXTRACT(MONTH FROM data_nascimento) = ${p.mes}
                       AND EXTRACT(DAY FROM data_nascimento) IN (${Prisma.join(p.dias)}))`,
      ),
      ' OR ',
    );

    const linhas = await this.prisma.$queryRaw<
      { id: string; nome: string; ano: number; mes: number; dia: number }[]
    >`
      SELECT id, nome,
             EXTRACT(YEAR FROM data_nascimento)::int  AS ano,
             EXTRACT(MONTH FROM data_nascimento)::int AS mes,
             EXTRACT(DAY FROM data_nascimento)::int   AS dia
      FROM usuarios
      WHERE tipo_usuario = 'ALUNO'
        AND ativo = true
        AND cpf NOT LIKE 'REMOVIDO-%'
        AND data_nascimento IS NOT NULL
        AND (${condicoes})
      ORDER BY nome
    `;

    return linhas
      .map((l) => {
        // A qual dia da semana este aniversário corresponde (o 29/02 cai no
        // 28 quando o ano não é bissexto, por isso a busca é pelo par).
        const alvo =
          pares.find((p) => p.mes === l.mes && p.dias.includes(l.dia)) ?? pares[0];
        return {
          id: l.id,
          nome: l.nome,
          idade: alvo.data.year() - l.ano,
          data: alvo.data.format('YYYY-MM-DD'),
          hoje: alvo.data.isSame(hoje, 'day'),
        };
      })
      .sort((a, b) => (a.data === b.data ? a.nome.localeCompare(b.nome) : a.data.localeCompare(b.data)));
  }

  @Get('frequencia')
  async frequencia() {
    return this.prisma.usuario.findMany({
      where: { tipoUsuario: 'ALUNO', ativo: true },
      select: {
        id: true, nome: true,
        agendamentos: { where: { status: 'CONFIRMADO' }, include: { presenca: true }, orderBy: { dataAula: 'desc' }, take: 20 },
        usuarioPlanos: { include: { plano: true, modalidade: true }, where: { vigenciaFim: null } },
      },
    });
  }
}
