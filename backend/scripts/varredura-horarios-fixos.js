/**
 * Varredura dos horários fixos — SOMENTE LEITURA.
 *
 * Confere se todo aluno com horário fixo está mesmo na turma dele, e aponta o
 * que estiver fora do lugar. Não escreve nada: nenhum INSERT, UPDATE ou
 * DELETE. Pode rodar com o estúdio funcionando.
 *
 *   cd backend && node scripts/varredura-horarios-fixos.js
 *
 * O DATABASE_URL vem do ambiente (no Railway já vem pronto).
 *
 * Cada achado diz o que está errado, quem está envolvido e o que fazer no
 * painel — sem pedir para ninguém mexer no banco na mão.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DIAS = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];
const DIA_LEGIVEL = {
  SEGUNDA: 'segunda', TERCA: 'terça', QUARTA: 'quarta', QUINTA: 'quinta', SEXTA: 'sexta',
};
/** Segunda = 1 … sexta = 5, igual ao resto do sistema. */
const DIA_NUMERO = { SEGUNDA: 1, TERCA: 2, QUARTA: 3, QUINTA: 4, SEXTA: 5 };

/** Teto por sala, igual ao backend (backend/src/horarios/capacidade.ts). */
const TETO_POR_MODALIDADE = { musculacao: 4, funcional: 4, pilates: 3 };
const TETO_PADRAO = 4;
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const capacidadeEfetiva = (capacidadeMaxima, modalidade) =>
  Math.min(capacidadeMaxima, TETO_POR_MODALIDADE[semAcento(modalidade ?? '')] ?? TETO_PADRAO);

const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const soData = (d) => new Date(d).toISOString().slice(0, 10);
const brasileiro = (d) => { const [a, m, dia] = soData(d).split('-'); return `${dia}/${m}/${a}`; };

/** As próximas datas em que este dia da semana acontece, a partir de hoje. */
function proximasDatasDo(diaSemana, quantas) {
  const alvo = DIA_NUMERO[diaSemana];
  const datas = [];
  const d = hoje();
  for (let i = 0; i < 60 && datas.length < quantas; i++) {
    const dia = new Date(d);
    dia.setDate(d.getDate() + i);
    // getDay(): domingo = 0. Segunda = 1 bate com DIA_NUMERO.
    if (dia.getDay() === alvo) datas.push(new Date(dia));
  }
  return datas;
}

const achados = [];
const anotar = (tipo, gravidade, titulo, linhas, oQueFazer) =>
  achados.push({ tipo, gravidade, titulo, linhas, oQueFazer });

async function main() {
  const agora = hoje();

  const fixos = await prisma.horarioFixo.findMany({
    where: { ativo: true },
    include: {
      usuario: {
        select: {
          id: true, nome: true, ativo: true, senhaHash: true, tipoUsuario: true,
          usuarioPlanos: {
            where: { vigenciaFim: null },
            include: { plano: true },
          },
        },
      },
      horario: { include: { modalidade: true } },
    },
  });

  const horarios = await prisma.horario.findMany({ include: { modalidade: true } });
  const porId = new Map(horarios.map((h) => [h.id, h]));

  console.log('═'.repeat(64));
  console.log('VARREDURA DOS HORÁRIOS FIXOS — somente leitura');
  console.log(`rodada em ${brasileiro(agora)}`);
  console.log('═'.repeat(64));
  console.log(`horários fixos ativos: ${fixos.length}`);
  console.log(`turmas cadastradas: ${horarios.length} (${horarios.filter((h) => h.ativo).length} ativas)`);

  // ── 1. Fixo de aluno que a dona desativou ─────────────────────────────
  // Ocupa vaga sem ninguém treinar: é o que deixava a turma "lotada".
  const deDesativado = fixos.filter((f) => !f.usuario.ativo && f.usuario.senhaHash);
  if (deDesativado.length) {
    anotar(
      'fixo-de-aluno-desativado', 'grave',
      `${deDesativado.length} horário(s) fixo(s) de aluno DESATIVADO ainda ocupando vaga`,
      deDesativado.map((f) =>
        `${f.usuario.nome} — ${DIA_LEGIVEL[f.horario.diaSemana]} ${f.horario.horaInicio} (${f.horario.modalidade.nome})`),
      'A limpeza automática do boot resolve. Se preferir na mão: abra o aluno, ' +
      'Plano e horário fixo, e remova. A vaga volta para a turma na hora.',
    );
  }

  // ── 2. Fixo apontando para turma desligada ou apagada ─────────────────
  const emTurmaMorta = fixos.filter((f) => {
    const h = porId.get(f.horarioId);
    return !h || !h.ativo;
  });
  if (emTurmaMorta.length) {
    anotar(
      'fixo-em-turma-desligada', 'grave',
      `${emTurmaMorta.length} horário(s) fixo(s) apontando para turma desligada`,
      emTurmaMorta.map((f) => {
        const h = porId.get(f.horarioId);
        return `${f.usuario.nome} — ${h ? `${DIA_LEGIVEL[h.diaSemana]} ${h.horaInicio} (turma desligada)` : 'turma apagada'}`;
      }),
      'Esses alunos não vão receber aula nenhuma. Remaneje cada um para uma turma ativa.',
    );
  }

  // ── 3. Fixo sem plano ativo ───────────────────────────────────────────
  const semPlano = fixos.filter(
    (f) => f.usuario.ativo && (f.usuario.usuarioPlanos?.length ?? 0) === 0,
  );
  if (semPlano.length) {
    anotar(
      'fixo-sem-plano', 'atencao',
      `${semPlano.length} horário(s) fixo(s) de aluno SEM plano ativo`,
      semPlano.map((f) =>
        `${f.usuario.nome} — ${DIA_LEGIVEL[f.horario.diaSemana]} ${f.horario.horaInicio}`),
      'Sem plano o sistema não sabe quantas aulas por semana ele pode ter. ' +
      'Defina o plano no cadastro, ou remova o horário fixo.',
    );
  }

  // ── 4. Mais fixos do que o plano permite ──────────────────────────────
  const porAluno = new Map();
  for (const f of fixos) {
    if (!porAluno.has(f.usuarioId)) porAluno.set(f.usuarioId, []);
    porAluno.get(f.usuarioId).push(f);
  }
  const acimaDaCota = [];
  const idsAcimaDaCota = new Set();
  for (const [, lista] of porAluno) {
    const u = lista[0].usuario;
    const plano = u.usuarioPlanos?.[0]?.plano;
    if (!plano) continue;
    if (lista.length > plano.aulasSemanais) {
      idsAcimaDaCota.add(u.id);
      acimaDaCota.push(
        `${u.nome} — plano ${plano.nome} (${plano.aulasSemanais}x) mas tem ${lista.length} fixos: ` +
        lista.map((f) => `${DIA_LEGIVEL[f.horario.diaSemana]} ${f.horario.horaInicio}`).join(', '),
      );
    }
  }
  if (acimaDaCota.length) {
    anotar(
      'fixos-acima-do-plano', 'grave',
      `${acimaDaCota.length} aluno(s) com mais horários fixos do que o plano permite`,
      acimaDaCota,
      'A cota semanal segura as aulas, então na prática um dos dias falha em silêncio ' +
      '— e qual deles ganha varia. Remova os fixos que sobram, ou suba o plano.',
    );
  }

  // ── 5. Turma acima da capacidade, e vaga ocupada por quem saiu ────────
  const daquiDuasSemanas = new Date(agora);
  daquiDuasSemanas.setDate(agora.getDate() + 14);
  const confirmados = await prisma.agendamento.findMany({
    where: { status: 'CONFIRMADO', dataAula: { gte: agora, lte: daquiDuasSemanas } },
    include: {
      usuario: { select: { nome: true, ativo: true, senhaHash: true } },
      horario: { include: { modalidade: true } },
    },
  });

  const porTurmaEData = new Map();
  for (const a of confirmados) {
    const chave = `${a.horarioId}|${soData(a.dataAula)}`;
    if (!porTurmaEData.has(chave)) porTurmaEData.set(chave, []);
    porTurmaEData.get(chave).push(a);
  }
  const lotadas = [];
  const comFantasma = [];
  /** Turmas sem vaga numa data — explica um fixo que não conseguiu entrar. */
  const semVagaEm = new Set();
  for (const [chave, lista] of porTurmaEData) {
    const h = lista[0].horario;
    const cap = capacidadeEfetiva(h.capacidadeMaxima, h.modalidade?.nome);
    const quando = `${DIA_LEGIVEL[h.diaSemana]} ${h.horaInicio} em ${brasileiro(chave.split('|')[1])}`;
    if (lista.length >= cap) semVagaEm.add(chave);
    if (lista.length > cap) {
      lotadas.push(`${quando} — ${lista.length} alunos para ${cap} vagas: ` +
        lista.map((a) => a.usuario.nome).join(', '));
    }
    const fantasmas = lista.filter((a) => !a.usuario.ativo && a.usuario.senhaHash);
    if (fantasmas.length) {
      comFantasma.push(`${quando} — ${fantasmas.length} de ${lista.length}: ` +
        fantasmas.map((a) => a.usuario.nome).join(', '));
    }
  }
  if (lotadas.length) {
    anotar(
      'turma-acima-da-capacidade', 'grave',
      `${lotadas.length} aula(s) com mais alunos do que a sala comporta`,
      lotadas,
      'Tire alguém de cada uma. Se o excesso for de aluno desativado, o item 1 resolve sozinho.',
    );
  }
  if (comFantasma.length) {
    anotar(
      'aula-de-aluno-desativado', 'grave',
      `${comFantasma.length} aula(s) futura(s) ocupadas por aluno DESATIVADO`,
      comFantasma,
      'São as vagas que somem sem explicação. A limpeza automática do boot devolve todas.',
    );
  }

  // ── 6. Fixo ativo, mas a próxima aula não foi marcada ─────────────────
  // O sintoma que a dona relata: "coloquei no fixo e ele não aparece".
  //
  // Roda depois da contagem das turmas de propósito: boa parte dos casos tem
  // explicação — a turma estava cheia, o aluno está sem plano, tem fixo demais
  // para o plano dele. Misturar tudo numa lista só transforma o achado que
  // importa (fixo em ordem e mesmo assim sem aula) em agulha no palheiro.
  const explicados = new Map();
  for (const f of deDesativado) explicados.set(f.usuarioId, 'aluno desativado');
  for (const f of emTurmaMorta) explicados.set(f.usuarioId, 'turma desligada');
  for (const f of semPlano) explicados.set(f.usuarioId, 'sem plano ativo');
  for (const id of idsAcimaDaCota) explicados.set(id, 'mais fixos do que o plano permite');

  const ativosDeVerdade = fixos.filter((f) => {
    const h = porId.get(f.horarioId);
    return h && h.ativo && !(!f.usuario.ativo && f.usuario.senhaHash);
  });

  const semExplicacao = [];
  const comExplicacao = [];
  for (const f of ativosDeVerdade) {
    const inicio = new Date(f.dataInicio); inicio.setHours(0, 0, 0, 0);
    const datas = proximasDatasDo(f.horario.diaSemana, 2).filter((d) => {
      if (d < inicio) return false;
      if (f.dataFim && d > new Date(f.dataFim)) return false;
      return true;
    });
    if (!datas.length) continue;

    const marcadas = await prisma.agendamento.findMany({
      where: {
        usuarioId: f.usuarioId,
        horarioId: f.horarioId,
        status: 'CONFIRMADO',
        dataAula: { in: datas },
      },
      select: { dataAula: true },
    });
    const temNaData = new Set(marcadas.map((a) => soData(a.dataAula)));
    const faltando = datas.filter((d) => !temNaData.has(soData(d)));
    if (!faltando.length) continue;

    const onde = `${f.usuario.nome} — ${DIA_LEGIVEL[f.horario.diaSemana]} ${f.horario.horaInicio}`;
    const quando = faltando.map(brasileiro).join(' e ');

    const motivoDoAluno = explicados.get(f.usuarioId);
    const cheiaEm = faltando.filter((d) => semVagaEm.has(`${f.horarioId}|${soData(d)}`));

    if (motivoDoAluno) {
      comExplicacao.push(`${onde}: ${quando} — ${motivoDoAluno}`);
    } else if (cheiaEm.length === faltando.length) {
      comExplicacao.push(`${onde}: ${quando} — turma sem vaga nessa data`);
    } else {
      semExplicacao.push(`${onde}: sem aula marcada em ${quando}`);
    }
  }

  if (semExplicacao.length) {
    anotar(
      'fixo-sem-aula-sem-motivo', 'grave',
      `${semExplicacao.length} horário(s) fixo(s) SEM aula marcada e SEM motivo aparente`,
      semExplicacao,
      'Estes são os que precisam de olho: o aluno está ativo, tem plano, a turma tem vaga ' +
      'e mesmo assim a aula não foi criada. Abra o aluno, remova e recadastre o horário ' +
      'fixo — ao salvar, a tela diz em que datas ele entrou.',
    );
  }
  if (comExplicacao.length) {
    anotar(
      'fixo-sem-aula-explicado', 'atencao',
      `${comExplicacao.length} horário(s) fixo(s) sem aula, mas com motivo conhecido`,
      comExplicacao,
      'Resolvendo os itens graves acima, estes se resolvem junto.',
    );
  }

  // ── 7. Aula recorrente sem horário fixo por trás ──────────────────────
  // O contrário do item 5: o aluno aparece toda semana na turma, mas não há
  // combinação registrada. Some se alguém desmarcar.
  const chaveFixo = new Set(fixos.map((f) => `${f.usuarioId}|${f.horarioId}`));
  const repeticoes = new Map();
  for (const a of confirmados) {
    const k = `${a.usuarioId}|${a.horarioId}`;
    if (chaveFixo.has(k)) continue;
    if (!repeticoes.has(k)) repeticoes.set(k, []);
    repeticoes.get(k).push(a);
  }
  const semCombinacao = [];
  for (const [, lista] of repeticoes) {
    if (lista.length < 2) continue; // uma aula solta é reposição, não combinação
    const a = lista[0];
    semCombinacao.push(
      `${a.usuario.nome} — ${DIA_LEGIVEL[a.horario.diaSemana]} ${a.horario.horaInicio}: ` +
      `${lista.length} semanas seguidas, sem horário fixo registrado`,
    );
  }
  if (semCombinacao.length) {
    anotar(
      'aula-repetida-sem-fixo', 'atencao',
      `${semCombinacao.length} aluno(s) repetindo a mesma turma sem horário fixo`,
      semCombinacao,
      'Na prática são fixos, mas o sistema não sabe: se alguém desmarcar, não volta sozinho. ' +
      'Vale cadastrar o horário fixo de verdade.',
    );
  }

  // ── Relatório ─────────────────────────────────────────────────────────
  console.log();
  if (!achados.length) {
    console.log('✓ Nenhum problema encontrado. Todo aluno com horário fixo está na turma dele.');
    return;
  }

  const graves = achados.filter((a) => a.gravidade === 'grave');
  const atencao = achados.filter((a) => a.gravidade === 'atencao');
  for (const a of [...graves, ...atencao]) {
    console.log('─'.repeat(64));
    console.log(`${a.gravidade === 'grave' ? '‼' : '•'} ${a.titulo}`);
    console.log();
    for (const l of a.linhas.slice(0, 40)) console.log(`   ${l}`);
    if (a.linhas.length > 40) console.log(`   … e mais ${a.linhas.length - 40}`);
    console.log();
    console.log(`   → ${a.oQueFazer}`);
  }
  console.log('─'.repeat(64));
  console.log(`\n${graves.length} problema(s) grave(s), ${atencao.length} ponto(s) de atenção.`);
}

main()
  .catch((e) => {
    console.error('\nA varredura não terminou:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
