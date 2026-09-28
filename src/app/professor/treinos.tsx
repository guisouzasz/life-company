import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { modalidadesDe, usaTreinoDoDia } from '../../constants/assets';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Avatar } from '../../components/ui/avatar';
import { ConfirmModal, InfoModal } from '../../components/ui/modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useAlunos } from '../../services/usuarios/usuarios.queries';
import { useMe } from '../../services/auth/auth.queries';
import { useResumoTreinos, useTreinoDia } from '../../services/treinos/treinos.queries';
import { diasAte, situacaoDoAluno } from '../../components/professor/situacao';
import { useSalvarTreinoDia, useRemoverTreinoDia } from '../../services/treinos/treinos.mutations';
import { getProximosDiasUteis, formatDate } from '../../services/date';
import { ApiError } from '../../services/http';
import { nomeCurto } from '../../services/nome';

type Dia = ReturnType<typeof getProximosDiasUteis>[number];

/**
 * Funcional: UM treino por dia, igual para todas as aulas — o professor
 * escolhe a data e escreve o treino do dia.
 */
function TreinoDoDia({ compacto = false }: { compacto?: boolean }) {
  const dias = useMemo(() => getProximosDiasUteis(10), []);
  const [diaSel, setDiaSel] = useState<Dia>(dias[0]);
  const treinoDia = useTreinoDia(diaSel?.data);
  const salvar = useSalvarTreinoDia();
  const remover = useRemoverTreinoDia();

  const [conteudo, setConteudo] = useState('');
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega o texto do dia quando a data muda (sem sobrescrever digitação)
  useEffect(() => {
    if (treinoDia.isSuccess && carregadoPara !== diaSel.data) {
      setConteudo(treinoDia.data?.conteudo ?? '');
      setCarregadoPara(diaSel.data);
      setSalvo(false);
    }
  }, [diaSel.data, treinoDia.isSuccess, treinoDia.data, carregadoPara]);

  const salvarDia = () => {
    if (conteudo.trim().length < 3) {
      setErro('Escreva o treino do dia antes de salvar.');
      return;
    }
    salvar.mutate(
      { data: diaSel.data, conteudo: conteudo.trim() },
      {
        onSuccess: () => setSalvo(true),
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar.'),
      },
    );
  };

  const limparDia = () => {
    if (!treinoDia.data) return;
    remover.mutate(treinoDia.data.id, {
      onSuccess: () => {
        setConfirmarLimpar(false);
        setConteudo('');
        setSalvo(false);
      },
      onError: (e) => {
        setConfirmarLimpar(false);
        setErro(e instanceof ApiError ? e.message : 'Não foi possível remover.');
      },
    });
  };

  return (
    <>
      <View style={[s.header, compacto && s.headerCompacto]}>
        <Text style={s.title}>Treino do dia</Text>
        <Text style={s.subtitle}>Um treino para todas as aulas de Funcional do dia</Text>
      </View>

      {/* Dias */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.daysScroll} contentContainerStyle={s.daysRow}>
        {dias.map((d) => {
          const sel = diaSel?.data === d.data;
          return (
            <Pressable key={d.data} style={[s.dayBtn, sel && s.dayBtnSel]} onPress={() => setDiaSel(d)}>
              <Text style={[s.dayNome, sel && s.daySelText]}>{d.diaNome}</Text>
              <Text style={[s.dayNum, sel && s.daySelText]}>{d.diaNum}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {treinoDia.isLoading ? (
        <Loading />
      ) : treinoDia.isError ? (
        <ErrorState onRetry={() => treinoDia.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Card padding={16}>
            <View style={s.diaInfoRow}>
              <Icon name="calendar-outline" size={15} color={LC.primary} />
              <Text style={s.diaInfo}>
                {diaSel.diaNome}, {diaSel.diaNum} — {treinoDia.data ? `salvo por ${nomeCurto(treinoDia.data.professor.nome)} (${formatDate(treinoDia.data.updatedAt, 'DD/MM HH:mm')})` : 'ainda sem treino'}
              </Text>
            </View>

            <Input
              placeholder={'Aquecimento juntos 3x30”10”\nSkip calcanhar\nMobilidade de quadril + ombro\n\nParte 1. 30”30 3x\nPolichinelo\nBurpee inverso\n...'}
              value={conteudo}
              onChangeText={(v) => {
                setConteudo(v);
                setSalvo(false);
              }}
              multiline
              style={s.conteudoInput}
            />

            {erro ? <Text style={s.erro}>{erro}</Text> : null}
            {salvo ? (
              <View style={s.salvoRow}>
                <Icon name="checkmark-circle" size={15} color={LC.success} />
                <Text style={s.salvoText}>Treino do dia salvo — todas as aulas de {diaSel.diaNome} verão este treino.</Text>
              </View>
            ) : null}

            <View style={s.acoesRow}>
              {treinoDia.data ? (
                <Button title="Remover" variant="danger-outline" size="sm" fullWidth={false} onPress={() => setConfirmarLimpar(true)} />
              ) : null}
              <Button
                title={treinoDia.data ? 'Atualizar treino' : 'Salvar treino do dia'}
                size="sm"
                loading={salvar.isPending}
                onPress={salvarDia}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <ConfirmModal
        visible={confirmarLimpar}
        title="Remover treino do dia"
        message={`Remover o treino de ${diaSel.diaNome}, ${diaSel.diaNum}? As alunas deixarão de vê-lo.`}
        confirmLabel="Remover"
        cancelLabel="Voltar"
        destructive
        loading={remover.isPending}
        onConfirm={limparDia}
        onCancel={() => setConfirmarLimpar(false)}
      />
      <InfoModal visible={!!erro} title="Atenção" message={erro ?? ''} onClose={() => setErro(null)} />
    </>
  );
}

type Filtro = 'semana' | 'atencao' | 'todos';

/** "hoje 18:00", "amanhã 07:00", "qua 07:00". */
function quando(p: { data: string; hora: string }): string {
  const d = diasAte(p.data);
  const dia = d === 0 ? 'hoje' : d === 1 ? 'amanhã' : formatDate(p.data, 'ddd').toLowerCase();
  return `${dia} ${p.hora}`;
}

/**
 * Os alunos do professor, com a situação de cada um à vista.
 *
 * Era uma lista de nomes com "3x por semana" embaixo — para saber quem estava
 * sem ficha, o professor abria um por um. Agora a lista começa por quem treina
 * com ele esta semana, na ordem das aulas, e cada linha diz se a ficha está em
 * dia, vencendo, vencida ou se não existe. "Precisam de ficha" junta num toque
 * o trabalho que ele tem para fazer.
 */
function TreinosPorAluno({ compacto = false }: { compacto?: boolean }) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const alunos = useAlunos();
  const resumo = useResumoTreinos();

  const porId = useMemo(() => new Map((resumo.data ?? []).map((r) => [r.alunoId, r])), [resumo.data]);
  const linhas = useMemo(
    () =>
      (alunos.data ?? [])
        .filter((a) => a.ativo)
        .map((a) => {
          const r = porId.get(a.id) ?? null;
          return { a, r, sit: r ? situacaoDoAluno(r) : null };
        }),
    [alunos.data, porId],
  );

  const daSemana = linhas.filter((l) => l.r?.proximaAula);
  // Precisa do professor: sem ficha ou vencida, entre quem treina com ele.
  const atencao = linhas.filter((l) => l.r && l.sit && (l.sit.urgente || l.sit.chave === 'vencendo') && (l.r.proximaAula || l.r.fichas > 0));
  const ativo: Filtro = filtro ?? (daSemana.length > 0 ? 'semana' : 'todos');

  const termo = busca.trim().toLowerCase();
  const base = ativo === 'semana' ? daSemana : ativo === 'atencao' ? atencao : linhas;
  const visiveis = base
    .filter((l) => !termo || l.a.nome.toLowerCase().includes(termo))
    .sort((x, y) => {
      if (ativo === 'semana') {
        const a = `${x.r!.proximaAula!.data} ${x.r!.proximaAula!.hora}`;
        const b = `${y.r!.proximaAula!.data} ${y.r!.proximaAula!.hora}`;
        if (a !== b) return a < b ? -1 : 1;
      }
      if (ativo === 'atencao') {
        const u = Number(!!y.sit?.urgente) - Number(!!x.sit?.urgente);
        if (u) return u;
      }
      return nomeCurto(x.a.nome).localeCompare(nomeCurto(y.a.nome), 'pt-BR');
    });

  const FILTROS: { chave: Filtro; rotulo: string; n: number }[] = [
    { chave: 'semana', rotulo: 'Esta semana', n: daSemana.length },
    { chave: 'atencao', rotulo: 'Precisam de você', n: atencao.length },
    { chave: 'todos', rotulo: 'Todos', n: linhas.length },
  ];

  return (
    <>
      <View style={[s.header, compacto && s.headerCompacto]}>
        <Text style={s.title}>Seus alunos</Text>
        <Text style={s.subtitle}>
          {daSemana.length > 0 ? `${daSemana.length} treinam com você esta semana` : 'Escolha um aluno para montar ou revisar o treino'}
          {atencao.length > 0 ? ` · ${atencao.length} precisam de você` : ''}
        </Text>
      </View>

      <View style={s.buscaWrap}>
        <Input
          placeholder="Buscar aluno por nome"
          value={busca}
          onChangeText={setBusca}
          autoCapitalize="none"
          leftIcon={<Icon name="search-outline" size={18} color={LC.textMuted} />}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtrosScroll} contentContainerStyle={s.filtros}>
        {FILTROS.map((f) => {
          const sel = f.chave === ativo;
          return (
            <Pressable
              key={f.chave}
              style={[s.filtro, sel && s.filtroSel, f.chave === 'atencao' && f.n > 0 && !sel && s.filtroAtencao]}
              onPress={() => setFiltro(f.chave)}
              accessibilityRole="tab"
              accessibilityState={{ selected: sel }}
            >
              <Text style={[s.filtroTexto, sel && s.filtroTextoSel, f.chave === 'atencao' && f.n > 0 && !sel && { color: LC.dangerFg }]}>
                {f.rotulo}
              </Text>
              <Text style={[s.filtroN, sel && s.filtroTextoSel]}>{f.n}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {alunos.isLoading ? (
        <Loading />
      ) : alunos.isError ? (
        <ErrorState onRetry={() => alunos.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {visiveis.length > 0 ? (
            visiveis.map(({ a, r, sit }) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={`Treinos de ${a.nome}`}
                onPress={() => router.push({ pathname: '/professor/treinos-aluno' as any, params: { id: a.id, nome: a.nome } })}
                style={({ pressed }) => [s.card, pressed && s.pressed]}
              >
                <Avatar nome={a.nome} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.nome} numberOfLines={1}>{nomeCurto(a.nome)}</Text>
                  <Text style={s.plano} numberOfLines={2}>
                    {r?.proximaAula ? (
                      <Text style={s.proxima}>
                        <Icon name="calendar" size={11} color={LC.primary} /> {quando(r.proximaAula)}
                      </Text>
                    ) : null}
                    {r?.proximaAula && r?.ultimaCarga ? '  ·  ' : ''}
                    {r?.ultimaCarga
                      ? `carga ${diasAte(r.ultimaCarga) === 0 ? 'hoje' : `há ${-diasAte(r.ultimaCarga)} dias`}`
                      : !r
                        ? 'sem aulas com você'
                        : ''}
                  </Text>
                </View>
                {sit ? (
                  <View style={[s.situacao, { backgroundColor: sit.fundo }]}>
                    <Text style={[s.situacaoTexto, { color: sit.cor }]}>{sit.rotulo}</Text>
                  </View>
                ) : null}
                <Icon name="chevron-forward" size={18} color={LC.textMuted} />
              </Pressable>
            ))
          ) : (
            <EmptyState
              icon={ativo === 'atencao' ? 'checkmark-done-outline' : 'people-outline'}
              title={ativo === 'atencao' ? 'Tudo em dia' : 'Nenhum aluno aqui'}
              description={busca ? 'Tente outra busca.' : ativo === 'atencao' ? 'Nenhum aluno seu está sem ficha ou com ela vencendo.' : 'Os alunos aparecerão aqui.'}
            />
          )}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
    </>
  );
}

export default function ProfessorTreinos() {
  const me = useMe();
  const mods = modalidadesDe(me.data);
  /**
   * Funcional tem o treino do dia; as outras, ficha por aluno. Quem dá aula
   * nas duas (Gabriele: Musculação e Funcional) precisa das duas telas, e
   * escolhe no topo qual está usando.
   */
  const temDia = mods.some((m) => usaTreinoDoDia(m.nome));
  const temFichas = mods.length === 0 || mods.some((m) => !usaTreinoDoDia(m.nome));
  const [aba, setAba] = useState<'fichas' | 'dia'>('fichas');
  const mostraDia = temDia && (!temFichas || aba === 'dia');

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      {me.isLoading ? (
        <Loading />
      ) : (
        <>
          {temDia && temFichas ? (
            <View style={s.abasWrap}>
              <View style={s.abas} accessibilityRole="tablist">
                {(
                  [
                    ['fichas', 'Fichas dos alunos', 'people-outline'],
                    ['dia', 'Treino do dia', 'today-outline'],
                  ] as const
                ).map(([chave, rotulo, icone]) => {
                  const sel = (chave === 'dia') === mostraDia;
                  return (
                    <Pressable
                      key={chave}
                      style={[s.aba, sel && s.abaSel]}
                      onPress={() => setAba(chave)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: sel }}
                    >
                      <Icon name={icone} size={15} color={sel ? LC.primary : LC.textSecondary} />
                      <Text style={[s.abaTexto, sel && s.abaTextoSel]} numberOfLines={1}>{rotulo}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          {mostraDia ? <TreinoDoDia compacto={temFichas} /> : <TreinosPorAluno compacto={temDia} />}
        </>
      )}
      <TabBar isProfessor />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  // Com as abas no topo, elas já ocupam o espaço da barra de status.
  headerCompacto: { paddingTop: 12 },
  abasWrap: { ...LC.coluna, paddingHorizontal: 16, paddingTop: 52 },
  abas: {
    flexDirection: 'row', gap: 4, padding: 4, borderRadius: LC.radius.md,
    backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border,
  },
  aba: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: LC.radius.sm,
  },
  abaSel: { backgroundColor: LC.primary + '14' },
  abaTexto: { fontSize: 13, fontWeight: '700', color: LC.textSecondary, flexShrink: 1 },
  abaTextoSel: { color: LC.primary },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  buscaWrap: { paddingHorizontal: 16, paddingBottom: 6 },
  scroll: { ...LC.coluna, padding: 16, paddingTop: 8 },
  pressed: { opacity: 0.85 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
    backgroundColor: LC.bgCard, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: LC.border, ...LC.shadow,
  },
  proxima: { color: LC.primary, fontWeight: '700' },
  situacao: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  situacaoTexto: { fontSize: 11.5, fontWeight: '800' },
  filtrosScroll: { flexGrow: 0, flexShrink: 0, ...LC.coluna },
  filtros: { gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  filtro: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999,
    backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.borderStrong,
  },
  filtroSel: { backgroundColor: LC.primary, borderColor: LC.primary },
  filtroAtencao: { borderColor: '#FCA5A5', backgroundColor: LC.dangerBg },
  filtroTexto: { fontSize: 13, fontWeight: '700', color: LC.textSecondary },
  filtroTextoSel: { color: '#fff' },
  filtroN: { fontSize: 12, fontWeight: '800', color: LC.textMuted },
  nome: { fontSize: 15.5, fontWeight: '700', color: LC.textPrimary },
  plano: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },

  // ── Treino do dia ───────────────────────────────────────────────
  daysScroll: { flexGrow: 0, ...LC.coluna },
  daysRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 4, alignItems: 'flex-start' },
  dayBtn: {
    alignItems: 'center', height: 68, justifyContent: 'center', paddingHorizontal: 12,
    borderRadius: LC.radius.md, minWidth: 56, backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border,
  },
  dayBtnSel: { backgroundColor: LC.primary, borderColor: LC.primary },
  dayNome: { fontSize: 11, fontWeight: '700', color: LC.textSecondary, textTransform: 'capitalize', marginBottom: 4 },
  dayNum: { fontSize: 17, fontWeight: '800', color: LC.textPrimary },
  daySelText: { color: '#fff' },
  diaInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  diaInfo: { flex: 1, fontSize: 12, fontWeight: '600', color: LC.textSecondary, textTransform: 'capitalize' },
  conteudoInput: { minHeight: 260, textAlignVertical: 'top' },
  erro: { fontSize: 12, color: LC.danger, marginTop: 10 },
  salvoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  salvoText: { flex: 1, fontSize: 12, fontWeight: '600', color: LC.success },
  acoesRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
