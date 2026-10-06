import type { PrismaClient } from '@prisma/client';
import { capacidadeEfetiva } from '../horarios/capacidade';

/**
 * A conferência diária dos horários fixos — o que a dona revisa às 08:00.
 *
 * Pergunta uma coisa só: nos próximos 7 dias, todo mundo está no seu horário
 * fixo, e as turmas fecham? Só leitura. A conferência do dono (diagnóstico)
 * é outra: olha a estrutura inteira e fala a língua de quem mantém o sistema.
 * Esta fala com a dona e só aponta o que ela consegue resolver pela tela.
 *
 * O cuidado maior é NÃO dar alarme falso — alerta que toca todo dia à toa
 * vira alerta que ninguém lê. Aula do fixo que tem qualquer linha no dia
 * (o aluno cancelou no prazo, a dona tirou, a academia fechou) é decisão de
 * alguém e não aparece. Só entra a aula que NUNCA foi marcada.
 */

type Banco = Pick<PrismaClient, 'horarioFixo' | 'agendamento' | 'usuario'>;

export type ItemDaConferencia = { texto: string; usuarioId?: string; nome?: string };

export type PontoDaConferencia = {
  tipo: string;
  /** `revisar` acende o alerta da dona; `aviso` só aparece na lista. */
  nivel: 'revisar' | 'aviso';
  titulo: string;
  oQueFazer: string;
  itens: ItemDaConferencia[];
};

export type ResultadoDaConferencia = {
  /** Primeiro e último dia conferidos (YYYY-MM-DD). */
  de: string;
  ate: string;
  /** Itens que pedem revisão (acendem o alerta). */
  pendencias: number;
  /** Itens só de aviso. */
  avisos: number;
  pontos: PontoDaConferencia[];
};

const JANELA_DIAS = 7;
const DIA_LEGIVEL: Record<string, string> = {
  SEGUNDA: 'segunda', TERCA: 'terça', QUARTA: 'quarta', QUINTA: 'quinta', SEXTA: 'sexta',
};
const DIA_DO_NUMERO: Record<number, string> = { 1: 'SEGUNDA', 2: 'TERCA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA' };

const dois = (n: number) => String(n).padStart(2, '0');
/** Datas no fuso do estúdio (o processo roda em America/Sao_Paulo — timezone.ts). */
const chaveDia = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const ddmm = (d: Date) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
const inicioDoDia = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const segundaDaSemana = (d: Date) => {
  const x = inicioDoDia(d);
  x.setDate(x.getDate() - ((x.getDay() || 7) - 1));
  return x;
};
const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
/** "Academia" é o nome no banco; para as pessoas é Musculação. */
const modalidade = (nome?: string | null) =>
  (nome ?? '').trim().toLowerCase() === 'academia' ? 'Musculação' : (nome ?? '').trim();

function agrupar<T>(lista: T[], chave: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of lista) {
    const k = chave(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return m;
}

export async function conferirHorariosFixos(db: Banco, agora = new Date()): Promise<ResultadoDaConferencia> {
  const hoje = inicioDoDia(agora);
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + JANELA_DIAS);
  const dias: Date[] = [];
  for (let i = 0; i < JANELA_DIAS; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    if (d.getDay() >= 1 && d.getDay() <= 5) dias.push(d);
  }
  // A semana do plano inteira das datas conferidas: a da hoje e a do último dia.
  const inicioSemanas = segundaDaSemana(hoje);
  const fimSemanas = segundaDaSemana(dias.length ? dias[dias.length - 1] : hoje);
  fimSemanas.setDate(fimSemanas.getDate() + 7);

  const [fixos, aulas, alunos] = await Promise.all([
    db.horarioFixo.findMany({
      where: { ativo: true, usuario: { tipoUsuario: 'ALUNO' } },
      include: {
        usuario: {
          select: {
            id: true, nome: true, ativo: true,
            usuarioPlanos: { where: { vigenciaFim: null }, include: { plano: true } },
          },
        },
        horario: { include: { modalidade: true } },
      },
    }),
    db.agendamento.findMany({
      where: { dataAula: { gte: inicioSemanas, lt: fimSemanas } },
      select: {
        usuarioId: true, horarioId: true, dataAula: true, status: true, reposicao: true, diaFechadoId: true,
        usuario: { select: { nome: true } },
        horario: {
          select: {
            diaSemana: true, horaInicio: true, horaFim: true, capacidadeMaxima: true,
            modalidade: { select: { nome: true } },
          },
        },
      },
    }),
    db.usuario.findMany({
      where: {
        tipoUsuario: 'ALUNO',
        ativo: true,
        NOT: { cpf: { startsWith: 'REMOVIDO-' } },
        usuarioPlanos: { some: { vigenciaFim: null } },
      },
      select: {
        id: true, nome: true,
        usuarioPlanos: { where: { vigenciaFim: null }, include: { plano: true } },
      },
      orderBy: { nome: 'asc' },
    }),
  ]);

  const naJanela = (d: Date) => d >= hoje && d < fim;
  /** Qualquer linha (marcada ou cancelada) é decisão de alguém naquele dia. */
  const temLinha = new Set(aulas.map((a) => `${a.usuarioId}|${a.horarioId}|${chaveDia(a.dataAula)}`));
  const marcadas = aulas.filter((a) => a.status === 'CONFIRMADO' || a.status === 'REALIZADO');
  const porTurmaDia = agrupar(marcadas, (a) => `${a.horarioId}|${chaveDia(a.dataAula)}`);
  const porAlunoDia = agrupar(marcadas, (a) => `${a.usuarioId}|${chaveDia(a.dataAula)}`);
  /** A semana do plano, pela mesma régua da cota: aulas do plano + as do dia fechado. */
  const usoDaSemana = new Map<string, number>();
  for (const a of aulas) {
    if (a.reposicao) continue;
    const conta = a.status === 'CONFIRMADO' || a.status === 'REALIZADO' || (a.status === 'CANCELADO' && !!a.diaFechadoId);
    if (!conta) continue;
    const k = `${a.usuarioId}|${chaveDia(segundaDaSemana(a.dataAula))}`;
    usoDaSemana.set(k, (usoDaSemana.get(k) ?? 0) + 1);
  }

  const pontos: PontoDaConferencia[] = [];
  const anotar = (p: PontoDaConferencia) => {
    if (p.itens.length) pontos.push(p);
  };
  const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();

  // ── 1. A aula do horário fixo não está marcada ──────────────────────
  const semAula: ItemDaConferencia[] = [];
  for (const f of fixos) {
    if (!f.usuario.ativo || !f.horario.ativo) continue;
    for (const d of dias) {
      if (DIA_DO_NUMERO[d.getDay()] !== f.horario.diaSemana) continue;
      if (d < inicioDoDia(f.dataInicio)) continue;
      if (f.dataFim && d > f.dataFim) continue;
      // A de hoje que já começou não tem mais o que fazer.
      if (chaveDia(d) === chaveDia(hoje) && minutos(f.horario.horaInicio) <= agoraMin) continue;
      if (temLinha.has(`${f.usuarioId}|${f.horarioId}|${chaveDia(d)}`)) continue;

      const plano = f.usuario.usuarioPlanos[0]?.plano;
      const naTurma = porTurmaDia.get(`${f.horarioId}|${chaveDia(d)}`)?.length ?? 0;
      const cabem = capacidadeEfetiva(f.horario.capacidadeMaxima, f.horario.modalidade?.nome);
      const choque = (porAlunoDia.get(`${f.usuarioId}|${chaveDia(d)}`) ?? []).find(
        (a) => a.horario.horaInicio < f.horario.horaFim && f.horario.horaInicio < a.horario.horaFim,
      );
      const usadas = usoDaSemana.get(`${f.usuarioId}|${chaveDia(segundaDaSemana(d))}`) ?? 0;
      const motivo = !plano
        ? 'sem plano ativo'
        : naTurma >= cabem
          ? `turma cheia nesse dia (${naTurma}/${cabem})`
          : choque
            ? `já está em ${modalidade(choque.horario.modalidade?.nome)} às ${choque.horario.horaInicio}`
            : usadas >= plano.aulasSemanais
              ? `a semana do plano já está completa (${usadas}/${plano.aulasSemanais})`
              : '';
      semAula.push({
        usuarioId: f.usuarioId,
        nome: f.usuario.nome,
        texto:
          `${f.usuario.nome} — ${DIA_LEGIVEL[f.horario.diaSemana]} ${ddmm(d)} às ${f.horario.horaInicio} ` +
          `(${modalidade(f.horario.modalidade?.nome)})${motivo ? ` · ${motivo}` : ''}`,
      });
    }
  }
  anotar({
    tipo: 'fixo-sem-aula',
    nivel: 'revisar',
    titulo: `${plural(semAula.length, 'aula de horário fixo não está marcada', 'aulas de horário fixo não estão marcadas')}`,
    oQueFazer:
      'Abra a Agenda no dia e coloque o aluno na turma. Se aparecer um motivo ao lado ' +
      '(turma cheia, semana completa), resolva ele primeiro.',
    itens: semAula,
  });

  // ── 2. Turma com mais alunos do que vagas ───────────────────────────
  const lotadas: ItemDaConferencia[] = [];
  for (const lista of porTurmaDia.values()) {
    const d = lista[0].dataAula;
    if (!naJanela(d)) continue;
    const h = lista[0].horario;
    const cabem = capacidadeEfetiva(h.capacidadeMaxima, h.modalidade?.nome);
    if (lista.length <= cabem) continue;
    lotadas.push({
      texto:
        `${DIA_LEGIVEL[h.diaSemana]} ${ddmm(d)} às ${h.horaInicio} (${modalidade(h.modalidade?.nome)}) — ` +
        `${lista.length} alunos para ${cabem} vagas: ${lista.map((a) => a.usuario.nome).join(', ')}`,
    });
  }
  anotar({
    tipo: 'turma-acima-da-capacidade',
    nivel: 'revisar',
    titulo: plural(lotadas.length, 'aula com mais alunos do que vagas', 'aulas com mais alunos do que vagas'),
    oQueFazer: 'Tire alguém de cada uma pela Agenda (a lixeira ao lado do nome), ou passe para outra turma.',
    itens: lotadas,
  });

  // ── 3. A mesma pessoa em duas aulas no mesmo horário ────────────────
  const duasAulas: ItemDaConferencia[] = [];
  for (const lista of porAlunoDia.values()) {
    const d = lista[0].dataAula;
    if (!naJanela(d) || lista.length < 2) continue;
    const ordem = [...lista].sort((a, b) => a.horario.horaInicio.localeCompare(b.horario.horaInicio));
    for (let i = 1; i < ordem.length; i++) {
      const a = ordem[i - 1];
      const b = ordem[i];
      if (b.horario.horaInicio < a.horario.horaFim) {
        duasAulas.push({
          usuarioId: a.usuarioId,
          nome: a.usuario.nome,
          texto:
            `${a.usuario.nome} — ${ddmm(d)}: ${modalidade(a.horario.modalidade?.nome)} às ${a.horario.horaInicio} ` +
            `e ${modalidade(b.horario.modalidade?.nome)} às ${b.horario.horaInicio}`,
        });
        break;
      }
    }
  }
  anotar({
    tipo: 'aluno-em-duas-aulas',
    nivel: 'revisar',
    titulo: plural(duasAulas.length, 'aluno em duas aulas no mesmo horário', 'alunos em duas aulas no mesmo horário'),
    oQueFazer: 'Tire de uma das duas pela Agenda ("Tirar sem crédito").',
    itens: duasAulas,
  });

  // ── 4. Mais horários fixos do que o plano ───────────────────────────
  const acima: ItemDaConferencia[] = [];
  for (const lista of agrupar(fixos.filter((f) => f.usuario.ativo), (f) => f.usuarioId).values()) {
    const u = lista[0].usuario;
    const plano = u.usuarioPlanos[0]?.plano;
    if (!plano || lista.length <= plano.aulasSemanais) continue;
    acima.push({
      usuarioId: u.id,
      nome: u.nome,
      texto:
        `${u.nome} — plano ${plano.nome}, com ${lista.length} horários fixos: ` +
        lista.map((f) => `${DIA_LEGIVEL[f.horario.diaSemana]} ${f.horario.horaInicio}`).join(', '),
    });
  }
  anotar({
    tipo: 'fixos-acima-do-plano',
    nivel: 'revisar',
    titulo: plural(acima.length, 'aluno com mais horários fixos do que o plano', 'alunos com mais horários fixos do que o plano'),
    oQueFazer: 'Tire o horário que sobra (Alunos → Plano e horários), ou aumente o plano.',
    itens: acima,
  });

  // ── 5. Horário fixo numa turma desligada ────────────────────────────
  const desligada = fixos
    .filter((f) => f.usuario.ativo && !f.horario.ativo)
    .map((f) => ({
      usuarioId: f.usuarioId,
      nome: f.usuario.nome,
      texto: `${f.usuario.nome} — ${DIA_LEGIVEL[f.horario.diaSemana]} às ${f.horario.horaInicio} (${modalidade(f.horario.modalidade?.nome)}): a turma está desligada`,
    }));
  anotar({
    tipo: 'fixo-em-turma-desligada',
    nivel: 'revisar',
    titulo: plural(desligada.length, 'horário fixo numa turma desligada', 'horários fixos em turmas desligadas'),
    oQueFazer: 'Esse aluno não recebe aula nenhuma ali. Passe para uma turma ativa (Alunos → Plano e horários).',
    itens: desligada,
  });

  // ── 6. Horário fixo que termina nos próximos dias (aviso) ───────────
  const terminando = fixos
    .filter((f) => f.usuario.ativo && f.dataFim && f.dataFim >= hoje && f.dataFim < fim)
    .map((f) => ({
      usuarioId: f.usuarioId,
      nome: f.usuario.nome,
      texto: `${f.usuario.nome} — ${DIA_LEGIVEL[f.horario.diaSemana]} às ${f.horario.horaInicio}: termina em ${ddmm(f.dataFim!)}`,
    }));
  anotar({
    tipo: 'fixo-terminando',
    nivel: 'aviso',
    titulo: plural(terminando.length, 'horário fixo termina nos próximos 7 dias', 'horários fixos terminam nos próximos 7 dias'),
    oQueFazer:
      'Se continua, abra Plano e horários, tire esse horário e coloque de novo com "Sem prazo". ' +
      'Se é para acabar mesmo, não precisa fazer nada.',
    itens: terminando,
  });

  // ── 7. Treinando, sem horário fixo e sem aula marcada (aviso) ───────
  const comFixo = new Set(fixos.map((f) => f.usuarioId));
  const comAula = new Set(marcadas.filter((a) => naJanela(a.dataAula)).map((a) => a.usuarioId));
  const soltos = alunos
    .filter((u) => !comFixo.has(u.id) && !comAula.has(u.id))
    .map((u) => ({
      usuarioId: u.id,
      nome: u.nome,
      texto: `${u.nome} — ${u.usuarioPlanos[0]?.plano?.nome ?? 'plano'}: sem horário fixo e sem aula nos próximos 7 dias`,
    }));
  anotar({
    tipo: 'sem-fixo-e-sem-aula',
    nivel: 'aviso',
    titulo: plural(soltos.length, 'aluno sem horário fixo e sem aula marcada', 'alunos sem horário fixo e sem aula marcada'),
    oQueFazer:
      'Se tem dias certos, cadastre o horário fixo (Alunos → Plano e horários). ' +
      'Se marca sozinho pelo app, pode ignorar.',
    itens: soltos,
  });

  const conta = (nivel: 'revisar' | 'aviso') =>
    pontos.filter((p) => p.nivel === nivel).reduce((t, p) => t + p.itens.length, 0);
  return {
    de: chaveDia(hoje),
    ate: chaveDia(dias.length ? dias[dias.length - 1] : hoje),
    pendencias: conta('revisar'),
    avisos: conta('aviso'),
    // O que pede revisão primeiro.
    pontos: [...pontos.filter((p) => p.nivel === 'revisar'), ...pontos.filter((p) => p.nivel === 'aviso')],
  };
}
