import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { nomeModalidade, usaTreinoDoDia } from '../../constants/assets';
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
import { useTreinoDia } from '../../services/treinos/treinos.queries';
import { useSalvarTreinoDia, useRemoverTreinoDia } from '../../services/treinos/treinos.mutations';
import { getProximosDiasUteis, formatDate } from '../../services/date';
import { ApiError } from '../../services/http';
import { primeiroNome } from '../../services/nome';

type Dia = ReturnType<typeof getProximosDiasUteis>[number];

/**
 * Funcional: UM treino por dia, igual para todas as aulas — o professor
 * escolhe a data e escreve o treino do dia.
 */
function TreinoDoDia() {
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
      <View style={s.header}>
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
                {diaSel.diaNome}, {diaSel.diaNum} — {treinoDia.data ? `salvo por ${primeiroNome(treinoDia.data.professor.nome)} (${formatDate(treinoDia.data.updatedAt, 'DD/MM HH:mm')})` : 'ainda sem treino'}
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

/** Musculação/Pilates: treino por aluno — escolhe o aluno na lista. */
function TreinosPorAluno() {
  const [busca, setBusca] = useState('');
  const alunos = useAlunos(busca.trim() || undefined);

  return (
    <>
      <View style={s.header}>
        <Text style={s.title}>Treinos</Text>
        <Text style={s.subtitle}>Escolha um aluno para montar ou revisar o treino</Text>
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

      {alunos.isLoading ? (
        <Loading />
      ) : alunos.isError ? (
        <ErrorState onRetry={() => alunos.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {alunos.data && alunos.data.length > 0 ? (
            alunos.data.map((aluno) => (
              <Pressable
                key={aluno.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/professor/treinos-aluno' as any, params: { id: aluno.id, nome: aluno.nome } })}
                style={({ pressed }) => [pressed && s.pressed]}
              >
                <Card style={s.card} padding={14}>
                  <Avatar nome={aluno.nome} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.nome}>{aluno.nome}</Text>
                    <Text style={s.plano}>{aluno.usuarioPlanos?.[0]?.plano?.nome ?? 'Sem plano'}</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={LC.textMuted} />
                </Card>
              </Pressable>
            ))
          ) : (
            <EmptyState icon="people-outline" title="Nenhum aluno encontrado" description={busca ? 'Tente outra busca.' : 'Os alunos aparecerão aqui.'} />
          )}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
    </>
  );
}

export default function ProfessorTreinos() {
  const me = useMe();
  const ehFuncional = usaTreinoDoDia(me.data?.modalidadeProfessor?.nome);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      {me.isLoading ? <Loading /> : ehFuncional ? <TreinoDoDia /> : <TreinosPorAluno />}
      <TabBar isProfessor />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  buscaWrap: { paddingHorizontal: 16, paddingBottom: 6 },
  scroll: { ...LC.coluna, padding: 16, paddingTop: 8 },
  pressed: { opacity: 0.85 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  nome: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
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
