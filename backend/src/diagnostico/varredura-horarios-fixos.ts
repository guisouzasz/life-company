import { PrismaClient } from '@prisma/client';
import { capacidadeEfetiva } from '../horarios/capacidade';

/**
 * Confere se todo aluno com horário fixo está mesmo na turma dele.
 *
 * Isto aqui é SÓ LEITURA e não depende do Nest: recebe um cliente do Prisma e
 * devolve o resultado em dados. Por isso serve para os dois caminhos — a tela
 * de diagnóstico do painel e o `npm run auditoria:fixos` da linha de comando.
 * Ter uma lógica só evita o que sempre acontece com duas: elas divergem, e aí
 * a tela e o comando passam a discordar sobre o mesmo estúdio.
 */

type ClientePrisma = Pick<PrismaClient, 'horarioFixo' | 'horario' | 'agendamento'>;

export type ItemDoAchado = {
  texto: string;
  /** Quando o achado é sobre uma pessoa: deixa a tela levar direto ao cadastro. */
  usuarioId?: string;
};

export type Achado = {
  tipo: string;
  gravidade: 'grave' | 'atencao';
  titulo: string;
  itens: ItemDoAchado[];
  oQueFazer: string;
  /**
   * Quando o próprio sistema consegue desfazer o achado, isto diz qual botão
   * a tela deve mostrar. Os outros achados dependem de uma decisão da dona
   * (tirar quem da turma cheia?) e por isso não têm.
   */
  acao?: 'restaurar-horarios-fixos';
};

export type Varredura = {
  rodadaEm: string;
  resumo: {
    fixosAtivos: number;
    turmas: number;
    turmasAtivas: number;
    graves: number;
    atencao: number;
  };
  achados: Achado[];
};

const DIA_LEGIVEL: Record<string, string> = {
  SEGUNDA: 'segunda', TERCA: 'terça', QUARTA: 'quarta', QUINTA: 'quinta', SEXTA: 'sexta',
};
/** Segunda = 1 … sexta = 5, igual ao resto do sistema. */
const DIA_NUMERO: Record<string, number> = {
  SEGUNDA: 1, TERCA: 2, QUARTA: 3, QUINTA: 4, SEXTA: 5,
};

const inicioDoDia = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const soData = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
const brasileiro = (d: Date | string) => {
  const [a, m, dia] = soData(d).split('-');
  return `${dia}/${m}/${a}`;
};

/** As próximas vezes em que este dia da semana acontece, a partir de hoje. */
function proximasDatasDo(diaSemana: string, quantas: number): Date[] {
  const alvo = DIA_NUMERO[diaSemana];
  const datas: Date[] = [];
  const hoje = inicioDoDia();
  for (let i = 0; i < 60 && datas.length < quantas; i++) {
    const dia = new Date(hoje);
    dia.setDate(hoje.getDate() + i);
    // getDay(): domingo = 0, então segunda = 1 bate com DIA_NUMERO.
    if (dia.getDay() === alvo) datas.push(new Date(dia));
  }
  return datas;
}

export async function varrerHorariosFixos(prisma: ClientePrisma): Promise<Varredura> {
  const hoje = inicioDoDia();
  const achados: Achado[] = [];
  const anotar = (a: Achado) => { if (a.itens.length) achados.push(a); };

  const fixos = await prisma.horarioFixo.findMany({
    where: { ativo: true },
    include: {
      usuario: {
        select: {
          id: true, nome: true, ativo: true, senhaHash: true,
          usuarioPlanos: { where: { vigenciaFim: null }, include: { plano: true } },
        },
      },
      horario: { include: { modalidade: true } },
    },
  });
  const horarios = await prisma.horario.findMany({ include: { modalidade: true } });
  const porId = new Map(horarios.map((h) => [h.id, h]));

  const quando = (f: (typeof fixos)[number]) =>
    `${DIA_LEGIVEL[f.horario.diaSemana]} ${f.horario.horaInicio}`;

  // ── 1. Fixo de aluno que a dona desativou ───────────────────────────────
  const deDesativado = fixos.filter((f) => !f.usuario.ativo);
  anotar({
    tipo: 'fixo-de-aluno-desativado', gravidade: 'grave',
    titulo: `${deDesativado.length} horário(s) fixo(s) de aluno DESATIVADO ainda ocupando vaga`,
    itens: deDesativado.map((f) => ({
      usuarioId: f.usuarioId,
      texto: `${f.usuario.nome} — ${quando(f)} (${f.horario.modalidade.nome})`,
    })),
    oQueFazer:
      'A limpeza automática do boot resolve. Se preferir na mão: abra o aluno, ' +
      'Plano e horário fixo, e remova. A vaga volta para a turma na hora.',
  });

  // ── 2. Fixo apontando para turma desligada ou apagada ───────────────────
  const emTurmaMorta = fixos.filter((f) => {
    const h = porId.get(f.horarioId);
    return !h || !h.ativo;
  });
  anotar({
    tipo: 'fixo-em-turma-desligada', gravidade: 'grave',
    titulo: `${emTurmaMorta.length} horário(s) fixo(s) apontando para turma desligada`,
    itens: emTurmaMorta.map((f) => {
      const h = porId.get(f.horarioId);
      return {
        usuarioId: f.usuarioId,
        texto: `${f.usuario.nome} — ${h ? `${DIA_LEGIVEL[h.diaSemana]} ${h.horaInicio} (turma desligada)` : 'turma apagada'}`,
      };
    }),
    oQueFazer: 'Esses alunos não vão receber aula nenhuma. Remaneje cada um para uma turma ativa.',
  });

  // ── 3. Fixo sem plano ativo ─────────────────────────────────────────────
  const semPlano = fixos.filter((f) => f.usuario.ativo && f.usuario.usuarioPlanos.length === 0);
  anotar({
    tipo: 'fixo-sem-plano', gravidade: 'atencao',
    titulo: `${semPlano.length} horário(s) fixo(s) de aluno SEM plano ativo`,
    itens: semPlano.map((f) => ({ usuarioId: f.usuarioId, texto: `${f.usuario.nome} — ${quando(f)}` })),
    oQueFazer:
      'Sem plano o sistema não sabe quantas aulas por semana ele pode ter. ' +
      'Defina o plano no cadastro, ou remova o horário fixo.',
  });

  // ── 4. Mais fixos do que o plano permite ────────────────────────────────
  const porAluno = new Map<string, typeof fixos>();
  for (const f of fixos) {
    if (!porAluno.has(f.usuarioId)) porAluno.set(f.usuarioId, [] as any);
    porAluno.get(f.usuarioId)!.push(f);
  }
  const acimaDaCota: ItemDoAchado[] = [];
  const idsAcimaDaCota = new Set<string>();
  for (const [, lista] of porAluno) {
    const u = lista[0].usuario;
    const plano = u.usuarioPlanos[0]?.plano;
    if (!plano || lista.length <= plano.aulasSemanais) continue;
    idsAcimaDaCota.add(u.id);
    acimaDaCota.push({
      usuarioId: u.id,
      texto:
        `${u.nome} — plano ${plano.nome} (${plano.aulasSemanais}x) mas tem ${lista.length} fixos: ` +
        lista.map(quando).join(', '),
    });
  }
  anotar({
    tipo: 'fixos-acima-do-plano', gravidade: 'grave',
    titulo: `${acimaDaCota.length} aluno(s) com mais horários fixos do que o plano permite`,
    itens: acimaDaCota,
    oQueFazer:
      'A cota semanal segura as aulas, então na prática um dos dias falha em silêncio ' +
      '— e qual deles ganha varia. Remova os fixos que sobram, ou suba o plano.',
  });

  // ── 5. Turma acima da capacidade, e vaga ocupada por quem saiu ──────────
  const duasSemanas = new Date(hoje);
  duasSemanas.setDate(hoje.getDate() + 14);
  const confirmados = await prisma.agendamento.findMany({
    where: { status: 'CONFIRMADO', dataAula: { gte: hoje, lte: duasSemanas } },
    include: {
      usuario: { select: { id: true, nome: true, ativo: true, senhaHash: true } },
      horario: { include: { modalidade: true } },
    },
  });

  const porTurmaEData = new Map<string, typeof confirmados>();
  for (const a of confirmados) {
    const chave = `${a.horarioId}|${soData(a.dataAula)}`;
    if (!porTurmaEData.has(chave)) porTurmaEData.set(chave, [] as any);
    porTurmaEData.get(chave)!.push(a);
  }

  const lotadas: ItemDoAchado[] = [];
  const comFantasma: ItemDoAchado[] = [];
  /** Turmas sem vaga numa data — explica um fixo que não conseguiu entrar. */
  const semVagaEm = new Set<string>();
  for (const [chave, lista] of porTurmaEData) {
    const h = lista[0].horario;
    const cap = capacidadeEfetiva(h.capacidadeMaxima, h.modalidade?.nome);
    const rotulo = `${DIA_LEGIVEL[h.diaSemana]} ${h.horaInicio} em ${brasileiro(chave.split('|')[1])}`;
    if (lista.length >= cap) semVagaEm.add(chave);
    if (lista.length > cap) {
      lotadas.push({
        texto: `${rotulo} — ${lista.length} alunos para ${cap} vagas: ${lista.map((a) => a.usuario.nome).join(', ')}`,
      });
    }
    const fantasmas = lista.filter((a) => !a.usuario.ativo);
    if (fantasmas.length) {
      comFantasma.push({
        texto: `${rotulo} — ${fantasmas.length} de ${lista.length}: ${fantasmas.map((a) => a.usuario.nome).join(', ')}`,
      });
    }
  }
  anotar({
    tipo: 'turma-acima-da-capacidade', gravidade: 'grave',
    titulo: `${lotadas.length} aula(s) com mais alunos do que a sala comporta`,
    itens: lotadas,
    oQueFazer: 'Tire alguém de cada uma. Se o excesso for de aluno desativado, o primeiro item resolve sozinho.',
  });
  anotar({
    tipo: 'aula-de-aluno-desativado', gravidade: 'grave',
    titulo: `${comFantasma.length} aula(s) futura(s) ocupadas por aluno DESATIVADO`,
    itens: comFantasma,
    oQueFazer: 'São as vagas que somem sem explicação. A limpeza automática do boot devolve todas.',
  });

  // ── 6. Fixo ativo, mas a próxima aula não foi marcada ───────────────────
  // Roda depois da contagem das turmas de propósito: boa parte dos casos tem
  // explicação — turma cheia, aluno sem plano, fixos demais para o plano.
  // Misturar tudo numa lista só transforma o achado que importa (fixo em ordem
  // e mesmo assim sem aula) em agulha no palheiro.
  const explicados = new Map<string, string>();
  for (const f of deDesativado) explicados.set(f.usuarioId, 'aluno desativado');
  for (const f of emTurmaMorta) explicados.set(f.usuarioId, 'turma desligada');
  for (const f of semPlano) explicados.set(f.usuarioId, 'sem plano ativo');
  for (const id of idsAcimaDaCota) explicados.set(id, 'mais fixos do que o plano permite');

  const emOrdem = fixos.filter((f) => {
    const h = porId.get(f.horarioId);
    return h && h.ativo && f.usuario.ativo;
  });

  const semMotivo: ItemDoAchado[] = [];
  const comMotivo: ItemDoAchado[] = [];
  for (const f of emOrdem) {
    const inicio = inicioDoDia(f.dataInicio);
    const datas = proximasDatasDo(f.horario.diaSemana, 2).filter((d) => {
      if (d < inicio) return false;
      if (f.dataFim && d > new Date(f.dataFim)) return false;
      return true;
    });
    if (!datas.length) continue;

    const marcadas = confirmados.filter((a) => a.usuarioId === f.usuarioId && a.horarioId === f.horarioId);
    const tem = new Set(marcadas.map((a) => soData(a.dataAula)));
    const faltando = datas.filter((d) => !tem.has(soData(d)));
    if (!faltando.length) continue;

    const onde = `${f.usuario.nome} — ${quando(f)}`;
    const datasTexto = faltando.map(brasileiro).join(' e ');
    const motivoDoAluno = explicados.get(f.usuarioId);
    const cheiaEm = faltando.filter((d) => semVagaEm.has(`${f.horarioId}|${soData(d)}`));

    if (motivoDoAluno) {
      comMotivo.push({ usuarioId: f.usuarioId, texto: `${onde}: ${datasTexto} — ${motivoDoAluno}` });
    } else if (cheiaEm.length === faltando.length) {
      comMotivo.push({ usuarioId: f.usuarioId, texto: `${onde}: ${datasTexto} — turma sem vaga nessa data` });
    } else {
      semMotivo.push({ usuarioId: f.usuarioId, texto: `${onde}: sem aula marcada em ${datasTexto}` });
    }
  }
  anotar({
    tipo: 'fixo-sem-aula-sem-motivo', gravidade: 'grave',
    titulo: `${semMotivo.length} horário(s) fixo(s) SEM aula marcada e SEM motivo aparente`,
    itens: semMotivo,
    oQueFazer:
      'Estes são os que precisam de olho: o aluno está ativo, tem plano, a turma tem vaga ' +
      'e mesmo assim a aula não foi criada. Abra o aluno, remova e recadastre o horário ' +
      'fixo — ao salvar, a tela diz em que datas ele entrou.',
  });
  anotar({
    tipo: 'fixo-sem-aula-explicado', gravidade: 'atencao',
    titulo: `${comMotivo.length} horário(s) fixo(s) sem aula, mas com motivo conhecido`,
    itens: comMotivo,
    oQueFazer: 'Resolvendo os itens graves acima, estes se resolvem junto.',
  });

  // ── 7. Aula recorrente sem horário fixo por trás ────────────────────────
  // O contrário do item 6: o aluno aparece toda semana na turma, mas não há
  // combinação registrada. Some se alguém desmarcar — e enquanto está lá,
  // ocupa a cota da semana e derruba o horário novo.
  const chaveFixo = new Set(fixos.map((f) => `${f.usuarioId}|${f.horarioId}`));
  const repeticoes = new Map<string, typeof confirmados>();
  for (const a of confirmados) {
    if (a.reposicao) continue; // reposição é avulsa de propósito
    const k = `${a.usuarioId}|${a.horarioId}`;
    if (chaveFixo.has(k)) continue;
    if (!repeticoes.has(k)) repeticoes.set(k, [] as any);
    repeticoes.get(k)!.push(a);
  }
  const semCombinacao: ItemDoAchado[] = [];
  for (const [, lista] of repeticoes) {
    if (lista.length < 2) continue; // uma aula solta é encaixe, não combinação
    const a = lista[0];
    semCombinacao.push({
      usuarioId: a.usuarioId,
      texto:
        `${a.usuario.nome} — ${DIA_LEGIVEL[a.horario.diaSemana]} ${a.horario.horaInicio}: ` +
        `${lista.length} semanas seguidas, sem horário fixo registrado`,
    });
  }
  anotar({
    tipo: 'aula-repetida-sem-fixo', gravidade: 'atencao',
    titulo: `${semCombinacao.length} aluno(s) repetindo a mesma turma sem horário fixo`,
    itens: semCombinacao,
    oQueFazer:
      'Na prática são fixos, mas o sistema não sabe: se alguém desmarcar, não volta sozinho. ' +
      'E enquanto estão lá ocupam a cota da semana. Vale cadastrar o horário fixo de verdade.',
  });

  // Histórico desligado não prova erro: pode ser uma remoção intencional.
  // Só sugere revisão se o aluno não tiver nenhum fixo ativo.
  const desligadosDeQuemTreina = await prisma.horarioFixo.findMany({
    where: {
      ativo: false,
      horario: { ativo: true },
      OR: [{ dataFim: null }, { dataFim: { gte: hoje } }],
      usuario: { ativo: true, tipoUsuario: 'ALUNO', horariosFixos: { none: { ativo: true } } },
    },
    include: {
      usuario: { select: { id: true, nome: true } },
      horario: { include: { modalidade: true } },
    },
    orderBy: [{ usuario: { nome: 'asc' } }],
  });

  const porAlunoDesligado = new Map<string, typeof desligadosDeQuemTreina>();
  for (const f of desligadosDeQuemTreina) {
    if (!porAlunoDesligado.has(f.usuarioId)) porAlunoDesligado.set(f.usuarioId, [] as any);
    porAlunoDesligado.get(f.usuarioId)!.push(f);
  }
  anotar({
    tipo: 'fixo-desligado-de-quem-treina', gravidade: 'atencao',
    titulo: `${porAlunoDesligado.size} aluno(s) sem fixo ativo e com histórico para revisar`,
    itens: [...porAlunoDesligado.values()].map((lista) => ({
      usuarioId: lista[0].usuarioId,
      texto:
        `${lista[0].usuario.nome} — ` +
        lista.map((f) => `${DIA_LEGIVEL[f.horario.diaSemana]} ${f.horario.horaInicio}`).join(', '),
    })),
    oQueFazer:
      'Esses horários podem ter sido removidos de propósito. Abra cada aluno e confirme ' +
      'os dias atuais em Plano e horários. Não restaure o histórico inteiro.',
  });

  const graves = achados.filter((a) => a.gravidade === 'grave');
  const atencao = achados.filter((a) => a.gravidade === 'atencao');
  return {
    rodadaEm: new Date().toISOString(),
    resumo: {
      fixosAtivos: fixos.length,
      turmas: horarios.length,
      turmasAtivas: horarios.filter((h) => h.ativo).length,
      graves: graves.length,
      atencao: atencao.length,
    },
    achados: [...graves, ...atencao],
  };
}
