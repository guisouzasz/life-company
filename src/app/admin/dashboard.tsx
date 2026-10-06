import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { openBrowserAsync } from 'expo-web-browser';
import { useAuthStore } from '../../store/auth';
import { LC } from '../../constants/theme';
import { DIAS_PT } from '../../constants/app';
import { corPorModalidade, iconePorModalidade, nomeModalidade, usaFichaEstruturada } from '../../constants/assets';
import { TabBar } from '../../components/tab-bar';
import { Avatar } from '../../components/ui/avatar';
import { Icon, type IconName } from '../../components/ui/icon';
import { Loading, ErrorState } from '../../components/ui/states';
import { AppModal } from '../../components/ui/modal';
import { AlunosHorarioModal, type HorarioDoModal } from '../../components/admin/alunos-horario-modal';
import { ConferenciaModal } from '../../components/admin/conferencia-modal';
import { useConferenciaHoje } from '../../services/conferencia/conferencia.queries';
import { situacaoDoAluno } from '../../components/professor/situacao';
import { useRelatorioDashboard } from '../../services/relatorios/relatorios.queries';
import { useResumoFinanceiro } from '../../services/financeiro/financeiro.queries';
import { useResumoTreinos } from '../../services/treinos/treinos.queries';
import { useAlunos } from '../../services/usuarios/usuarios.queries';
import { useLogout } from '../../services/auth/auth.mutations';
import { useMe } from '../../services/auth/auth.queries';
import { useIsDesktop } from '../../hooks/use-is-desktop';
import { useMinutoAtual } from '../../hooks/use-aula-agora';
import { formatDate, getDiaSemanaKey } from '../../services/date';
import { linkWhatsapp, mensagemAniversario, telefoneParaWhatsapp } from '../../services/whatsapp';
import { nomeCurto, primeiroNome } from '../../services/nome';
import type { AulaHoje, RelatorioDashboard } from '../../services/relatorios/relatorios.types';
import type { ResumoFinanceiro } from '../../services/financeiro/financeiro.types';

/**
 * O painel da dona: o que acontece hoje, o que precisa dela e como está o mês.
 *
 * O painel anterior mostrava números soltos em cartões enormes (cinco telas
 * de celular para "27 alunos, 26 ativos, 135 aulas, 13 presenças, 6
 * faltas"), não dizia um real sequer, e o que pedia ação ficava espalhado. A
 * ordem agora é a da cabeça de quem abre o estúdio:
 *
 *  1. Hoje — quantos alunos, quantas aulas, quão cheias; e o dia inteiro
 *     numa linha, da aula das 6h à das 20h, com a de agora marcada.
 *  2. Precisa de você — uma lista só, na ordem do que custa mais esperar:
 *     mensalidade atrasada, aniversário de hoje, aluno treinando sem ficha,
 *     reposição, acesso ao app. Cada linha abre o lugar onde se resolve.
 *  3. O mês em dinheiro — recebido, previsto e o que falta, em reais.
 *  4. A semana, os aniversários e os atalhos.
 */

// ── Formatos ─────────────────────────────────────────────────────────

/** 4921.5 → "R$ 4.922" — no painel o centavo é ruído. */
function reais(v?: number | null): string {
  const n = Math.round(v ?? 0);
  return `R$ ${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
const capitalizar = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const emMinutos = (h: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(h ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
const juntar = (nomes: string[], max = 3) =>
  nomes.length <= max ? nomes.join(', ') : `${nomes.slice(0, max).join(', ')} e mais ${nomes.length - max}`;

type EstadoAula = 'dada' | 'agora' | 'proxima';
function estadoDa(a: AulaHoje, minuto: number): EstadoAula {
  if (minuto >= emMinutos(a.horaFim)) return 'dada';
  if (minuto >= emMinutos(a.horaInicio)) return 'agora';
  return 'proxima';
}

// ── Hoje ─────────────────────────────────────────────────────────────

/** Os números de hoje, contados das aulas da grade. */
function numerosDeHoje(d?: RelatorioDashboard) {
  const aulas = d?.aulasHoje ?? [];
  const alunos = aulas.reduce((t, a) => t + a.agendados, 0);
  const vagas = aulas.reduce((t, a) => t + a.capacidade, 0);
  const comAluno = aulas.filter((a) => a.agendados > 0).length;
  return { alunos, aulas: comAluno, grade: aulas.length, lotacao: vagas > 0 ? Math.round((alunos / vagas) * 100) : 0 };
}

/**
 * O dia inteiro numa fileira: cada turma é um cartão com a hora, a
 * modalidade e quão cheia está. A que está acontecendo fica em destaque, as
 * que já passaram mostram quem veio. A fileira já abre na aula de agora.
 */
function LinhaDoDia({ d, largo }: { d?: RelatorioDashboard; largo?: boolean }) {
  const aulas = d?.aulasHoje ?? [];
  const minuto = useMinutoAtual();
  const [verAlunos, setVerAlunos] = useState<HorarioDoModal | null>(null);
  const hoje = getDiaSemanaKey(new Date()) as HorarioDoModal['diaSemana'];
  const ref = useRef<ScrollView>(null);
  const LARGURA = 136;
  const GAP_TILE = 10;
  const foco = Math.max(aulas.findIndex((a) => estadoDa(a, minuto) !== 'dada'), 0);

  useEffect(() => {
    if (largo || !aulas.length) return;
    const t = setTimeout(() => ref.current?.scrollTo({ x: Math.max(foco * (LARGURA + GAP_TILE) - 16, 0), animated: false }), 60);
    return () => clearTimeout(t);
  }, [foco, aulas.length, largo]);

  if (aulas.length === 0) {
    return (
      <View style={[s.bloco, s.vazioDia]}>
        <Icon name="cafe-outline" size={24} color={LC.textMuted} />
        <Text style={s.vazioTexto}>Sem aulas hoje. Bom descanso!</Text>
      </View>
    );
  }

  const tiles = aulas.map((a) => {
    const estado = estadoDa(a, minuto);
    const cor = corPorModalidade(a.modalidade);
    const lotada = a.agendados >= a.capacidade;
    const pct = a.capacidade > 0 ? Math.min(a.agendados / a.capacidade, 1) : 0;
    const chamada = (a.presentes ?? 0) + (a.faltas ?? 0) > 0;
    return (
      <Pressable
        key={a.horarioId}
        style={({ pressed }) => [
          s.tile,
          largo && s.tileLargo,
          estado === 'agora' && s.tileAgora,
          estado === 'dada' && s.tileDada,
          pressed && { opacity: 0.8 },
        ]}
        onPress={() => setVerAlunos({ id: a.horarioId, diaSemana: hoje, horaInicio: a.horaInicio, modalidade: { nome: a.modalidade }, capacidadeMaxima: a.capacidade })}
        accessibilityRole="button"
        accessibilityLabel={`Ver alunos de ${nomeModalidade(a.modalidade)} às ${a.horaInicio}`}
      >
        <View style={s.tileTopo}>
          <Text style={[s.tileHora, estado === 'agora' && { color: '#fff' }]}>{a.horaInicio}</Text>
          {estado === 'agora' ? (
            <View style={s.agoraSelo}>
              <View style={s.agoraPonto} />
              <Text style={s.agoraTexto}>AGORA</Text>
            </View>
          ) : estado === 'dada' ? (
            <Icon name="checkmark-circle" size={16} color={LC.textMuted} />
          ) : lotada ? (
            <Text style={s.lotadaTexto}>LOTADA</Text>
          ) : null}
        </View>
        <View style={s.tileMod}>
          <Icon name={iconePorModalidade(a.modalidade)} size={12} color={estado === 'agora' ? '#fff' : cor} />
          <Text style={[s.tileModTexto, { color: estado === 'agora' ? '#fff' : cor }]} numberOfLines={1}>
            {nomeModalidade(a.modalidade)}
          </Text>
        </View>
        <View style={[s.tileTrilho, estado === 'agora' && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
          <View
            style={[
              s.tileBarra,
              { width: `${Math.max(pct * 100, a.agendados > 0 ? 8 : 0)}%`, backgroundColor: estado === 'agora' ? '#fff' : lotada ? LC.danger : cor },
            ]}
          />
        </View>
        <Text style={[s.tileConta, estado === 'agora' && { color: 'rgba(255,255,255,0.9)' }]}>
          {estado === 'dada' && chamada
            ? `${a.presentes} ${a.presentes === 1 ? 'aluno' : 'alunos'}${a.faltas ? ` · ${a.faltas} ${a.faltas === 1 ? 'falta' : 'faltas'}` : ''}`
            : `${a.agendados} de ${a.capacidade}`}
        </Text>
      </Pressable>
    );
  });

  return (
    <>
      {largo ? (
        <View style={s.tilesGrade}>{tiles}</View>
      ) : (
        <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={s.tilesScroll} contentContainerStyle={s.tilesLinha}>
          {tiles}
        </ScrollView>
      )}
      <AlunosHorarioModal horario={verAlunos} onClose={() => setVerAlunos(null)} />
    </>
  );
}

// ── Precisa de você ──────────────────────────────────────────────────

type Item = {
  chave: string;
  icone: IconName;
  cor: string;
  fundo: string;
  titulo: string;
  sub?: string;
  onPress?: () => void;
  acao?: { rotulo: string; icone: IconName; cor: string; onPress: () => void };
};

type Lista = { titulo: string; dica: string; linhas: { chave: string; nome: string; detalhe?: string; onPress: () => void }[] };

function PrecisaDeVoce({ d, fin }: { d?: RelatorioDashboard; fin?: ResumoFinanceiro }) {
  const resumo = useResumoTreinos();
  const alunos = useAlunos();
  const [lista, setLista] = useState<Lista | null>(null);
  /** A conferência das 08:00 dos horários fixos (o alerta do dia). */
  const conferencia = useConferenciaHoje();
  const [verConferencia, setVerConferencia] = useState(false);

  const abrirAluno = (nome: string) => {
    setLista(null);
    router.push({ pathname: '/admin/alunos', params: { busca: nome } } as any);
  };

  /**
   * Alunos de musculação que treinam esta semana sem ficha em dia (sem
   * nenhuma, ou vencida). Só musculação: é onde a ficha é o treino — no
   * Pilates e no Funcional o professor conduz a aula, e contar essas alunas
   * enchia o painel de "pendências" que ninguém precisa resolver.
   */
  const semFicha = useMemo(() => {
    const nomes = new Map((alunos.data ?? []).map((a) => [a.id, a.nome]));
    const musculacao = (m?: string) => !!m && usaFichaEstruturada(m) && !/pilates|funcional|yoga/i.test(m);
    return (resumo.data ?? [])
      .filter((r) => r.proximaAula && musculacao(r.proximaAula.modalidade) && nomes.has(r.alunoId))
      .map((r) => ({ r, sit: situacaoDoAluno(r), nome: nomes.get(r.alunoId)! }))
      .filter((x) => x.sit.urgente)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [resumo.data, alunos.data]);

  const itens: Item[] = [];

  /*
    O alerta das 08:00 vem primeiro: é a conferência dos horários fixos dos
    próximos 7 dias. Some quando ela marca como revisado (ou quando, ao
    conferir de novo, não sobra nada).
  */
  const c = conferencia.data;
  if (c && c.pendencias > 0 && !c.revisadaEm) {
    const nomes = [
      ...new Set(
        c.resultado.pontos
          .filter((p) => p.nivel === 'revisar')
          .flatMap((p) => p.itens.map((i) => i.nome).filter((n): n is string => !!n)),
      ),
    ];
    itens.push({
      chave: 'conferencia', icone: 'calendar', cor: LC.dangerFg, fundo: LC.dangerBg,
      titulo: `Horários fixos: ${c.pendencias} ${c.pendencias === 1 ? 'ponto' : 'pontos'} para revisar hoje`,
      sub: nomes.length ? juntar(nomes.map(nomeCurto)) : 'Toque para ver a conferência das 08:00',
      onPress: () => setVerConferencia(true),
    });
  }

  const atrasados = (fin?.alunos ?? []).filter((a) => a.status === 'ATRASADO').sort((a, b) => b.dias - a.dias);
  if (atrasados.length > 0) {
    const soma = atrasados.reduce((t, a) => t + (a.valorMensalidade ?? 0), 0);
    itens.push({
      chave: 'atraso', icone: 'wallet', cor: LC.dangerFg, fundo: LC.dangerBg,
      titulo: `${atrasados.length} ${atrasados.length === 1 ? 'mensalidade atrasada' : 'mensalidades atrasadas'}${soma > 0 ? ` · ${reais(soma)}` : ''}`,
      sub: juntar(atrasados.map((a) => nomeCurto(a.nome))),
      onPress: () => router.push('/admin/financeiro' as any),
    });
  }

  for (const a of (d?.aniversariantes ?? []).filter((x) => x.hoje)) {
    const zap = telefoneParaWhatsapp(a.telefone);
    itens.push({
      chave: `niver-${a.id}`, icone: 'gift', cor: '#BE185D', fundo: '#FCE7F3',
      titulo: `${nomeCurto(a.nome)} faz ${a.idade} anos hoje`,
      sub: a.professor ? 'Da equipe' : zap ? 'Mande um parabéns pelo WhatsApp' : 'Sem telefone no cadastro',
      acao: zap
        ? { rotulo: 'Parabenizar', icone: 'logo-whatsapp', cor: '#25D366', onPress: () => openBrowserAsync(linkWhatsapp(zap, mensagemAniversario(a.nome))).catch(() => {}) }
        : undefined,
    });
  }

  if (semFicha.length > 0) {
    itens.push({
      chave: 'fichas', icone: 'barbell', cor: '#C2410C', fundo: '#FFEDD5',
      titulo: `${semFicha.length} ${semFicha.length === 1 ? 'aluno de musculação' : 'alunos de musculação'} sem ficha em dia`,
      sub: juntar(semFicha.map((x) => nomeCurto(x.nome))),
      onPress: () =>
        setLista({
          titulo: 'Sem ficha em dia',
          dica: 'Treinam musculação esta semana e estão sem ficha, ou com ela vencida. Toque para abrir os treinos e montar a nova.',
          linhas: semFicha.map((x) => ({
            chave: x.r.alunoId,
            nome: x.nome,
            detalhe: `${x.sit.rotulo}${x.r.proximaAula?.modalidade ? ` · ${nomeModalidade(x.r.proximaAula.modalidade)}` : ''}`,
            onPress: () => {
              setLista(null);
              router.push({ pathname: '/admin/treinos-aluno' as any, params: { id: x.r.alunoId, nome: x.nome } });
            },
          })),
        }),
    });
  }

  const reposicoes = d?.reposicoesPendentes;
  if (reposicoes && reposicoes.total > 0) {
    itens.push({
      chave: 'repo', icone: 'ticket', cor: LC.warningFg, fundo: LC.warningBg,
      titulo: `${reposicoes.total} ${reposicoes.total === 1 ? 'reposição para agendar' : 'reposições para agendar'}`,
      sub: juntar(reposicoes.alunos.map((a) => nomeCurto(a.nome))),
      onPress: () =>
        setLista({
          titulo: 'Reposições para agendar',
          dica: 'Têm crédito de reposição sem usar. Toque no nome para abrir o cadastro.',
          linhas: reposicoes.alunos.map((a) => ({
            chave: a.nome, nome: a.nome, detalhe: a.creditos === 1 ? '1 crédito' : `${a.creditos} créditos`, onPress: () => abrirAluno(a.nome),
          })),
        }),
    });
  }

  const venceLogo = (fin?.alunos ?? []).filter((a) => a.status === 'A_VENCER' && a.dias <= 3);
  if (venceLogo.length > 0) {
    itens.push({
      chave: 'vence', icone: 'time', cor: '#1D4ED8', fundo: LC.infoBg,
      titulo: `${venceLogo.length} ${venceLogo.length === 1 ? 'mensalidade vence' : 'mensalidades vencem'} nos próximos 3 dias`,
      sub: juntar(venceLogo.map((a) => nomeCurto(a.nome))),
      onPress: () => router.push('/admin/financeiro' as any),
    });
  }

  const acesso = d?.aguardandoAcesso;
  if (acesso && acesso.total > 0) {
    itens.push({
      chave: 'acesso', icone: 'phone-portrait', cor: '#0F766E', fundo: '#CCFBF1',
      titulo: `${acesso.total} ${acesso.total === 1 ? 'aluno ainda não entrou' : 'alunos ainda não entraram'} no app`,
      sub: juntar(acesso.nomes.map(nomeCurto)),
      onPress: () =>
        setLista({
          titulo: 'Ainda não entraram no app',
          dica: 'Ainda não criaram a senha. Toque no nome para abrir o cadastro e mandar o link de acesso.',
          linhas: acesso.nomes.map((nome) => ({ chave: nome, nome, onPress: () => abrirAluno(nome) })),
        }),
    });
  }

  const cancelados = d?.canceladosOntem ?? [];
  if (cancelados.length > 0) {
    itens.push({
      chave: 'cancel', icone: 'close-circle', cor: LC.textSecondary, fundo: LC.neutralBg,
      titulo: `Ontem: ${cancelados.length} ${cancelados.length === 1 ? 'aula cancelada' : 'aulas canceladas'}`,
      sub: juntar(cancelados.map((c) => `${nomeCurto(c.nome)} (${c.horaInicio})`), 2),
    });
  }

  return (
    <View style={s.bloco}>
      <View style={s.blocoTopo}>
        <Text style={s.blocoTitulo}>Precisa de você</Text>
        {itens.length > 0 ? <View style={s.contaBolha}><Text style={s.contaBolhaTexto}>{itens.length}</Text></View> : null}
      </View>
      {itens.length === 0 ? (
        <View style={s.tudoEmDia}>
          <View style={s.tudoEmDiaIcone}>
            <Icon name="checkmark-done" size={20} color={LC.successFg} />
          </View>
          <Text style={s.tudoEmDiaTexto}>Tudo em dia por aqui. Nenhuma pendência hoje.</Text>
        </View>
      ) : (
        itens.map((it, i) => {
          const conteudo = (
            <>
            <View style={[s.itemIcone, { backgroundColor: it.fundo }]}>
              <Icon name={it.icone} size={18} color={it.cor} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.itemTitulo}>{it.titulo}</Text>
              {it.sub ? <Text style={s.itemSub} numberOfLines={1}>{it.sub}</Text> : null}
            </View>
            {it.acao ? (
              <Pressable
                style={[s.itemAcao, { backgroundColor: it.acao.cor }]}
                onPress={it.acao.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${it.acao.rotulo}: ${it.titulo}`}
              >
                <Icon name={it.acao.icone} size={14} color="#fff" />
                <Text style={s.itemAcaoTexto}>{it.acao.rotulo}</Text>
              </Pressable>
            ) : it.onPress ? (
              <Icon name="chevron-forward" size={17} color={LC.textMuted} />
            ) : null}
            </>
          );
          /*
            Linha sem destino é uma View, não um botão desligado: um botão
            desligado desliga também o que está dentro dele para o leitor de
            tela — e o "Parabenizar" do aniversário mora aí dentro.
          */
          return it.onPress ? (
            <Pressable
              key={it.chave}
              style={({ pressed }) => [s.item, i > 0 && s.itemBorda, pressed && { backgroundColor: LC.neutralBg }]}
              onPress={it.onPress}
              accessibilityRole="button"
              accessibilityLabel={it.titulo}
            >
              {conteudo}
            </Pressable>
          ) : (
            <View key={it.chave} style={[s.item, i > 0 && s.itemBorda]}>
              {conteudo}
            </View>
          );
        })
      )}

      {/*
        Sem alerta, uma linha discreta diz que a conferência rodou — é ela
        que dá à dona a certeza de que "nada para revisar" foi conferido, e
        não esquecido.
      */}
      {c && !(c.pendencias > 0 && !c.revisadaEm) ? (
        <Pressable
          style={({ pressed }) => [s.conferenciaLinha, pressed && { opacity: 0.7 }]}
          onPress={() => setVerConferencia(true)}
          accessibilityRole="button"
          accessibilityLabel="Ver a conferência dos horários fixos"
        >
          <Icon name="shield-checkmark" size={15} color={LC.successFg} />
          <Text style={s.conferenciaTexto}>
            {c.pendencias > 0
              ? `Conferência dos horários fixos revisada${c.revisadaEm ? ` às ${formatDate(new Date(c.revisadaEm), 'HH:mm')}` : ''}.`
              : `Horários fixos conferidos às ${formatDate(new Date(c.rodadaEm), 'HH:mm')}: tudo certo.`}
            {c.resultado.avisos > 0 ? ` ${c.resultado.avisos} ${c.resultado.avisos === 1 ? 'aviso' : 'avisos'}.` : ''}
          </Text>
          <Icon name="chevron-forward" size={14} color={LC.textMuted} />
        </Pressable>
      ) : null}

      <ConferenciaModal conferencia={c} visivel={verConferencia} onClose={() => setVerConferencia(false)} />

      <AppModal visible={!!lista} onClose={() => setLista(null)} title={lista?.titulo ?? ''}>
        <Text style={s.listaDica}>{lista?.dica}</Text>
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {(lista?.linhas ?? []).map((l) => (
            <Pressable
              key={l.chave}
              onPress={l.onPress}
              style={({ pressed }) => [s.listaLinha, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${l.nome}`}
            >
              <Avatar nome={l.nome} size={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.listaNome} numberOfLines={1}>{nomeCurto(l.nome)}</Text>
                {l.detalhe ? <Text style={s.listaDetalhe}>{l.detalhe}</Text> : null}
              </View>
              <Icon name="chevron-forward" size={16} color={LC.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      </AppModal>
    </View>
  );
}

// ── O mês em dinheiro ────────────────────────────────────────────────

function DinheiroDoMes({ fin, carregando }: { fin?: ResumoFinanceiro; carregando: boolean }) {
  const mes = formatDate(new Date(), 'MMMM');
  const pct = fin && fin.previsto > 0 ? Math.min(fin.recebido / fin.previsto, 1) : 0;
  return (
    <Pressable
      style={({ pressed }) => [s.bloco, pressed && { opacity: 0.9 }]}
      onPress={() => router.push('/admin/financeiro' as any)}
      accessibilityRole="button"
      accessibilityLabel="Abrir o financeiro"
    >
      <View style={s.blocoTopo}>
        <Text style={s.blocoTitulo}>{capitalizar(mes)} em dinheiro</Text>
        <Icon name="chevron-forward" size={17} color={LC.textMuted} />
      </View>
      {carregando ? (
        <Text style={s.vazioTexto}>Carregando…</Text>
      ) : !fin ? (
        <Text style={s.vazioTexto}>Sem conexão — toque para abrir o financeiro.</Text>
      ) : (
        <>
          <View style={s.dinheiroLinha}>
            <Text style={s.dinheiroRecebido}>{reais(fin.recebido)}</Text>
            <Text style={s.dinheiroDe}>de {reais(fin.previsto)}</Text>
          </View>
          <View style={s.dinheiroTrilho}>
            <View style={[s.dinheiroBarra, { width: `${Math.round(pct * 100)}%` }]} />
          </View>
          <Text style={s.dinheiroSub}>
            {Math.round(pct * 100)}% recebido{fin.emAberto > 0 ? ` · faltam ${reais(fin.emAberto)}` : ' · mês fechado!'}
          </Text>
          <View style={s.dinheiroContas}>
            <Conta n={fin.pagos} rotulo={fin.pagos === 1 ? 'pagou' : 'pagaram'} cor={LC.successFg} fundo={LC.successBg} />
            <Conta n={fin.aVencer} rotulo="a vencer" cor={LC.textSecondary} fundo={LC.neutralBg} />
            <Conta n={fin.atrasados} rotulo={fin.atrasados === 1 ? 'atrasado' : 'atrasados'} cor={fin.atrasados ? LC.dangerFg : LC.textSecondary} fundo={fin.atrasados ? LC.dangerBg : LC.neutralBg} />
          </View>
          {fin.semValor > 0 ? (
            <Text style={s.dinheiroAviso}>
              {fin.semValor === 1 ? '1 aluno está' : `${fin.semValor} alunos estão`} sem valor de mensalidade — o previsto não
              inclui {fin.semValor === 1 ? 'esse valor' : 'esses valores'}.
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function Conta({ n, rotulo, cor, fundo }: { n: number; rotulo: string; cor: string; fundo: string }) {
  return (
    <View style={[s.conta, { backgroundColor: fundo }]}>
      <Text style={[s.contaN, { color: cor }]}>{n}</Text>
      <Text style={[s.contaRotulo, { color: cor }]}>{rotulo}</Text>
    </View>
  );
}

// ── A semana ─────────────────────────────────────────────────────────

function Semana({ d }: { d?: RelatorioDashboard }) {
  const dados = d?.aulasPorDia ?? [];
  const max = Math.max(1, ...dados.map((x) => x.total));
  const diaAtual = getDiaSemanaKey(new Date());
  const taxa = d?.taxaPresenca;
  return (
    <View style={s.bloco}>
      <View style={s.blocoTopo}>
        <Text style={s.blocoTitulo}>A semana</Text>
        <Text style={s.blocoMeta}>{d?.aulasSemana ?? 0} aulas marcadas</Text>
      </View>
      <View style={s.grafico}>
        {dados.map((item) => {
          const hoje = item.dia === diaAtual;
          return (
            <View key={item.dia} style={s.graficoCol}>
              <Text style={[s.graficoValor, hoje && { color: LC.primary }]}>{item.total}</Text>
              <View style={s.graficoTrilho}>
                <View style={[s.graficoBarra, { height: `${Math.max((item.total / max) * 100, item.total > 0 ? 8 : 3)}%` }, hoje && { backgroundColor: LC.primary }]} />
              </View>
              <Text style={[s.graficoDia, hoje && { color: LC.primary, fontWeight: '800' }]}>{DIAS_PT[item.dia]?.slice(0, 3)}</Text>
            </View>
          );
        })}
      </View>
      {/*
        Não existe chamada: aula marcada e não cancelada conta como dada quando
        termina (a regra do estúdio). A frase antes esperava uma chamada que
        nenhuma tela fazia, e ficava parada em "quando a chamada começar".
      */}
      <View style={s.presenca}>
        <Icon name="hand-left" size={15} color={LC.infoFg} />
        <Text style={s.presencaTexto}>
          {(d?.presencas ?? 0) === 0 && (d?.canceladasSemana ?? 0) === 0
            ? 'As aulas dadas aparecem aqui conforme a semana acontece.'
            : `Até agora: ${d?.presencas ?? 0} ${d?.presencas === 1 ? 'aula dada' : 'aulas dadas'}` +
              ` · ${d?.canceladasSemana ?? 0} ${d?.canceladasSemana === 1 ? 'cancelada' : 'canceladas'} pelos alunos no prazo` +
              (taxa != null ? ` · presença de ${taxa}%` : '') +
              (d?.faltas ? ` · ${d.faltas} ${d.faltas === 1 ? 'falta registrada' : 'faltas registradas'}` : '')}
        </Text>
      </View>
    </View>
  );
}

// ── Aniversários do resto da semana ─────────────────────────────────

function Aniversarios({ d }: { d?: RelatorioDashboard }) {
  // Os de hoje já estão em "Precisa de você", com o botão de parabéns.
  const semana = (d?.aniversariantes ?? []).filter((a) => !a.hoje);
  if (semana.length === 0) return null;
  return (
    <View style={s.bloco}>
      <View style={s.blocoTopo}>
        <Text style={s.blocoTitulo}>Aniversários da semana</Text>
        <Icon name="gift-outline" size={17} color="#BE185D" />
      </View>
      {semana.map((a) => (
        <View key={a.id} style={s.niverLinha}>
          <Avatar nome={a.nome} size={32} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.niverNome} numberOfLines={1}>{nomeCurto(a.nome)}{a.professor ? ' · equipe' : ''}</Text>
            <Text style={s.niverDia}>{capitalizar(formatDate(a.data, 'dddd, DD/MM'))}</Text>
          </View>
          <Text style={s.niverIdade}>{a.idade} anos</Text>
        </View>
      ))}
    </View>
  );
}

// ── Atalhos ──────────────────────────────────────────────────────────

type Atalho = { label: string; icon: IconName; route: string; color: string; bg: string };
const ATALHOS: Atalho[] = [
  { label: 'Novo aluno', icon: 'person-add', route: '/admin/novo-aluno', color: LC.primary, bg: LC.primaryLight },
  { label: 'Alunos', icon: 'people', route: '/admin/alunos', color: '#4F46E5', bg: '#EEF2FF' },
  { label: 'Professores', icon: 'school', route: '/admin/professores', color: '#0F766E', bg: '#CCFBF1' },
  { label: 'Agenda', icon: 'calendar', route: '/admin/agenda', color: '#B45309', bg: LC.warningBg },
  { label: 'Financeiro', icon: 'wallet', route: '/admin/financeiro', color: '#15803D', bg: LC.successBg },
  { label: 'Frequência', icon: 'stats-chart', route: '/admin/frequencia', color: '#1D4ED8', bg: LC.infoBg },
];
/**
 * Só o dono vê. No celular a barra de abas não tem lugar para elas, e no
 * computador elas moram na barra lateral — sem estes atalhos, quem administra
 * pelo telefone não teria caminho até elas.
 */
const ATALHOS_DO_DONO: Atalho[] = [
  { label: 'Conferir horários', icon: 'shield-checkmark', route: '/admin/diagnostico', color: '#0F766E', bg: LC.primaryLight },
  { label: 'O que foi feito', icon: 'document-text', route: '/admin/logs', color: '#7C3AED', bg: '#EDE9FE' },
];

function Atalhos({ dono }: { dono: boolean }) {
  return (
    <View style={s.atalhos}>
      {(dono ? [...ATALHOS, ...ATALHOS_DO_DONO] : ATALHOS).map((a) => (
        <Pressable
          key={a.label}
          onPress={() => router.push(a.route as any)}
          style={({ pressed }) => [s.atalho, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          <View style={[s.atalhoIcone, { backgroundColor: a.bg }]}>
            <Icon name={a.icon} size={20} color={a.color} />
          </View>
          <Text style={s.atalhoTexto} numberOfLines={1}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Tela ─────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const nome = useAuthStore((st) => st.nome);
  const me = useMe();
  const ehDono = me.data?.dono === true;
  const relatorio = useRelatorioDashboard();
  const financeiro = useResumoFinanceiro();
  const logout = useLogout();
  const isDesktop = useIsDesktop();
  const minuto = useMinutoAtual();

  const onRefresh = useCallback(() => {
    relatorio.refetch();
    financeiro.refetch();
  }, [relatorio, financeiro]);

  if (relatorio.isLoading) {
    return (
      <View style={s.root}>
        <Loading />
        <TabBar isAdmin />
      </View>
    );
  }

  const d = relatorio.data;
  const fin = financeiro.data;
  const hoje = numerosDeHoje(d);
  const hora = Math.floor(minuto / 60);
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiro = nome ? primeiroNome(nome) : '';
  const data = capitalizar(`${formatDate(new Date(), 'dddd')}, ${formatDate(new Date(), 'DD')} de ${formatDate(new Date(), 'MMMM')}`);
  const proxima = (d?.aulasHoje ?? []).find((a) => estadoDa(a, minuto) !== 'dada');

  // ── Computador ─────────────────────────────────────────────────────
  if (isDesktop) {
    const kpis: { rotulo: string; valor: string; sub: string; icone: IconName; cor: string; fundo: string }[] = [
      { rotulo: 'Alunos hoje', valor: String(hoje.alunos), sub: `em ${hoje.aulas} ${hoje.aulas === 1 ? 'aula' : 'aulas'}`, icone: 'people', cor: '#4F46E5', fundo: '#EEF2FF' },
      { rotulo: 'Lotação hoje', valor: `${hoje.lotacao}%`, sub: 'das vagas da grade', icone: 'speedometer', cor: LC.primary, fundo: LC.primaryLight },
      { rotulo: 'Recebido no mês', valor: fin ? reais(fin.recebido) : '—', sub: fin ? `de ${reais(fin.previsto)}` : '', icone: 'wallet', cor: '#15803D', fundo: LC.successBg },
      { rotulo: 'Aulas dadas na semana', valor: String(d?.presencas ?? 0), sub: `${d?.canceladasSemana ?? 0} canceladas no prazo${d?.taxaPresenca != null ? ` · presença ${d.taxaPresenca}%` : ''}`, icone: 'hand-left', cor: '#1D4ED8', fundo: LC.infoBg },
    ];
    return (
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.deskScroll} showsVerticalScrollIndicator={false}>
          <Text style={s.deskData}>{data}</Text>
          <Text style={s.deskTitulo}>{saudacao}{primeiro ? `, ${primeiro}` : ''}</Text>
          {relatorio.isError ? (
            <ErrorState message="Não foi possível carregar o painel." onRetry={() => relatorio.refetch()} />
          ) : (
            <>
              <View style={s.kpis}>
                {kpis.map((k) => (
                  <View key={k.rotulo} style={s.kpi}>
                    <View style={[s.kpiIcone, { backgroundColor: k.fundo }]}>
                      <Icon name={k.icone} size={18} color={k.cor} />
                    </View>
                    <Text style={s.kpiValor}>{k.valor}</Text>
                    <Text style={s.kpiRotulo}>{k.rotulo}</Text>
                    {k.sub ? <Text style={s.kpiSub}>{k.sub}</Text> : null}
                  </View>
                ))}
              </View>
              <View style={s.deskColunas}>
                <View style={{ flex: 3, gap: GAP }}>
                  <View style={s.bloco}>
                    <View style={s.blocoTopo}>
                      <Text style={s.blocoTitulo}>O dia de hoje</Text>
                      <Text style={s.blocoMeta}>{hoje.grade} horários na grade</Text>
                    </View>
                    <LinhaDoDia d={d} largo />
                  </View>
                  <Semana d={d} />
                </View>
                <View style={{ flex: 2, gap: GAP }}>
                  <PrecisaDeVoce d={d} fin={fin} />
                  <DinheiroDoMes fin={fin} carregando={financeiro.isLoading} />
                  <Aniversarios d={d} />
                </View>
              </View>
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    );
  }

  // ── Celular ────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} colors={[LC.primary]} tintColor={LC.primary} />}
      >
        <LinearGradient colors={LC.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={s.heroTopo}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroData}>{data}</Text>
              <Text style={s.heroTitulo}>{saudacao}{primeiro ? `, ${primeiro}` : ''}</Text>
            </View>
            {/*
              A chave fica ao lado do sair: é o único caminho da dona até a
              própria senha — o painel não tem tela de perfil.
            */}
            <Pressable style={s.heroBtn} onPress={() => router.push('/alterar-senha' as any)} hitSlop={8} accessibilityLabel="Alterar minha senha">
              <Icon name="key-outline" size={19} color="#fff" />
            </Pressable>
            <Pressable style={s.heroBtn} onPress={() => logout.mutate()} hitSlop={8} accessibilityLabel="Sair da conta">
              <Icon name="log-out-outline" size={19} color="#fff" />
            </Pressable>
          </View>

          {relatorio.isError ? null : (
            <>
              <View style={s.heroNumeros}>
                <View style={s.heroNumero}>
                  <Text style={s.heroN}>{hoje.alunos}</Text>
                  <Text style={s.heroNRotulo}>alunos hoje</Text>
                </View>
                <View style={s.heroDiv} />
                <View style={s.heroNumero}>
                  <Text style={s.heroN}>{hoje.aulas}</Text>
                  <Text style={s.heroNRotulo}>{hoje.aulas === 1 ? 'aula' : 'aulas'}</Text>
                </View>
                <View style={s.heroDiv} />
                <View style={s.heroNumero}>
                  <Text style={s.heroN}>{hoje.lotacao}%</Text>
                  <Text style={s.heroNRotulo}>lotação</Text>
                </View>
              </View>
              {proxima ? (
                <Text style={s.heroProxima}>
                  {estadoDa(proxima, minuto) === 'agora' ? 'Agora' : 'Próxima'}: {proxima.horaInicio} · {nomeModalidade(proxima.modalidade)} · {proxima.agendados} de {proxima.capacidade}
                </Text>
              ) : (
                <Text style={s.heroProxima}>As aulas de hoje terminaram. Bom descanso!</Text>
              )}
            </>
          )}
        </LinearGradient>

        <View style={s.corpo}>
          {relatorio.isError ? (
            <ErrorState message="Não foi possível carregar o painel." onRetry={() => relatorio.refetch()} />
          ) : (
            <>
              <View style={s.secaoTopo}>
                <Text style={s.secao}>O dia de hoje</Text>
                <Pressable onPress={() => router.push('/admin/agenda' as any)} hitSlop={8} accessibilityRole="button">
                  <Text style={s.secaoLink}>Agenda</Text>
                </Pressable>
              </View>
              <LinhaDoDia d={d} />

              <PrecisaDeVoce d={d} fin={fin} />
              <DinheiroDoMes fin={fin} carregando={financeiro.isLoading} />
              <Semana d={d} />
              <Aniversarios d={d} />

              <Text style={[s.secao, { marginTop: 6 }]}>Atalhos</Text>
              <Atalhos dono={ehDono} />
            </>
          )}
        </View>
        <View style={{ height: 16 }} />
      </ScrollView>
      <TabBar isAdmin />
    </View>
  );
}

const GAP = 12;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  scroll: { paddingBottom: 16 },

  // ── Hero (celular) ───────────────────────────────────────────────
  hero: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroData: { fontSize: 11.5, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.7, textTransform: 'uppercase' },
  heroTitulo: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2, letterSpacing: -0.3 },
  heroBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  heroNumeros: {
    flexDirection: 'row', alignItems: 'center', marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, paddingVertical: 14,
  },
  heroNumero: { flex: 1, alignItems: 'center' },
  heroN: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroNRotulo: { fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  heroDiv: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroProxima: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginTop: 12, textAlign: 'center' },

  corpo: { paddingHorizontal: 16, marginTop: 16, gap: GAP },
  secaoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: -4 },
  secao: { fontSize: 12, fontWeight: '800', color: LC.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 4 },
  secaoLink: { fontSize: 13, fontWeight: '800', color: LC.primary },

  // ── Blocos ───────────────────────────────────────────────────────
  bloco: {
    backgroundColor: LC.bgCard, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: LC.border, ...LC.shadowCard,
  },
  blocoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  blocoTitulo: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  blocoMeta: { fontSize: 12, fontWeight: '600', color: LC.textMuted },
  vazioTexto: { fontSize: 13.5, color: LC.textSecondary },
  vazioDia: { alignItems: 'center', gap: 6, paddingVertical: 22 },

  // O dia de hoje
  tilesScroll: { flexGrow: 0, flexShrink: 0, marginHorizontal: -16 },
  tilesLinha: { paddingHorizontal: 16, gap: 10, paddingVertical: 4 },
  tilesGrade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: 136, padding: 12, borderRadius: 16, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border, ...LC.shadow,
  },
  // No computador os cartões dividem a largura em vez de sobrar espaço à direita.
  tileLargo: { width: undefined, flexBasis: 140, flexGrow: 1, maxWidth: 200 },
  tileAgora: { backgroundColor: LC.primary, borderColor: LC.primary },
  tileDada: { backgroundColor: LC.neutralBg, borderColor: LC.neutralBg },
  tileTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 },
  tileHora: { fontSize: 17, fontWeight: '800', color: LC.textPrimary },
  agoraSelo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  agoraPonto: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#86EFAC' },
  agoraTexto: { fontSize: 9.5, fontWeight: '900', color: '#fff', letterSpacing: 0.6 },
  lotadaTexto: { fontSize: 9.5, fontWeight: '900', color: LC.dangerFg, letterSpacing: 0.6 },
  tileMod: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  tileModTexto: { flexShrink: 1, fontSize: 12.5, fontWeight: '800' },
  tileTrilho: { height: 6, borderRadius: 3, backgroundColor: LC.neutralBg, overflow: 'hidden', marginTop: 10 },
  tileBarra: { height: '100%', borderRadius: 3 },
  tileConta: { fontSize: 12, fontWeight: '700', color: LC.textSecondary, marginTop: 6 },

  // Precisa de você
  contaBolha: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: LC.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  contaBolhaTexto: { fontSize: 12, fontWeight: '900', color: '#fff' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderRadius: 12 },
  itemBorda: { borderTopWidth: 1, borderTopColor: LC.border },
  itemIcone: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontSize: 14, fontWeight: '800', color: LC.textPrimary, lineHeight: 19 },
  itemSub: { fontSize: 12.5, color: LC.textSecondary, marginTop: 2 },
  itemAcao: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999 },
  itemAcaoTexto: { fontSize: 12, fontWeight: '800', color: '#fff' },
  tudoEmDia: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  tudoEmDiaIcone: { width: 38, height: 38, borderRadius: 12, backgroundColor: LC.successBg, alignItems: 'center', justifyContent: 'center' },
  tudoEmDiaTexto: { flex: 1, fontSize: 13.5, fontWeight: '700', color: LC.successFg },
  listaDica: { fontSize: 13, color: LC.textSecondary, lineHeight: 19, marginBottom: 10 },
  listaLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: LC.border },
  listaNome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  listaDetalhe: { fontSize: 12, fontWeight: '700', color: LC.dangerFg, marginTop: 1 },

  // Dinheiro
  dinheiroLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  dinheiroRecebido: { fontSize: 30, fontWeight: '800', color: LC.textPrimary, letterSpacing: -0.6 },
  dinheiroDe: { fontSize: 15, fontWeight: '700', color: LC.textSecondary },
  dinheiroTrilho: { height: 10, borderRadius: 5, backgroundColor: LC.neutralBg, overflow: 'hidden', marginTop: 10 },
  dinheiroBarra: { height: '100%', borderRadius: 5, backgroundColor: LC.success },
  dinheiroSub: { fontSize: 12.5, fontWeight: '700', color: LC.textSecondary, marginTop: 7 },
  dinheiroContas: { flexDirection: 'row', gap: 8, marginTop: 12 },
  conta: { flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  contaN: { fontSize: 18, fontWeight: '800' },
  contaRotulo: { fontSize: 11.5, fontWeight: '700', marginTop: 1 },
  dinheiroAviso: { fontSize: 12, color: LC.warningFg, marginTop: 10, lineHeight: 17 },

  // Semana
  grafico: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  graficoCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  graficoValor: { fontSize: 12, fontWeight: '800', color: LC.textSecondary, marginBottom: 4 },
  graficoTrilho: { flex: 1, width: '100%', maxWidth: 40, justifyContent: 'flex-end' },
  graficoBarra: { width: '100%', borderRadius: 8, backgroundColor: LC.primarySoft },
  graficoDia: { fontSize: 11.5, fontWeight: '600', color: LC.textMuted, marginTop: 6 },
  presenca: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: LC.border },
  conferenciaLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: LC.border },
  conferenciaTexto: { flex: 1, fontSize: 12.5, fontWeight: '600', color: LC.textSecondary, lineHeight: 17 },
  presencaTexto: { flex: 1, fontSize: 12.5, fontWeight: '600', color: LC.textSecondary, lineHeight: 17 },

  // Aniversários
  niverLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: LC.border },
  niverNome: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  niverDia: { fontSize: 12, color: LC.textMuted, marginTop: 1 },
  niverIdade: { fontSize: 12.5, fontWeight: '700', color: LC.textSecondary },

  // Atalhos
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  atalho: {
    width: '30%', flexGrow: 1, alignItems: 'center', gap: 7, paddingVertical: 14, paddingHorizontal: 6,
    backgroundColor: LC.bgCard, borderRadius: 16, borderWidth: 1, borderColor: LC.border,
  },
  atalhoIcone: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  atalhoTexto: { fontSize: 12.5, fontWeight: '700', color: LC.textPrimary },

  // ── Computador ───────────────────────────────────────────────────
  deskScroll: { paddingTop: 24, paddingBottom: 16 },
  deskData: { fontSize: 12, fontWeight: '800', color: LC.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  deskTitulo: { fontSize: 26, fontWeight: '800', color: LC.textPrimary, marginTop: 2, marginBottom: 18, letterSpacing: -0.4 },
  kpis: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  kpi: {
    flex: 1, backgroundColor: LC.bgCard, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: LC.border, ...LC.shadowCard,
  },
  kpiIcone: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiValor: { fontSize: 26, fontWeight: '800', color: LC.textPrimary, letterSpacing: -0.5 },
  kpiRotulo: { fontSize: 13, fontWeight: '700', color: LC.textSecondary, marginTop: 2 },
  kpiSub: { fontSize: 12, color: LC.textMuted, marginTop: 1 },
  deskColunas: { flexDirection: 'row', gap: GAP, alignItems: 'flex-start' },
});
