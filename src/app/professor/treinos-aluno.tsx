import { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LC } from '../../constants/theme';
import { nomeModalidade } from '../../constants/assets';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Avatar } from '../../components/ui/avatar';
import { ConfirmModal, InfoModal } from '../../components/ui/modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { CargaExercicioModal } from '../../components/professor/carga-exercicio-modal';
import { useTreinosDoAluno } from '../../services/treinos/treinos.queries';
import { useCriarTreino, useAtualizarTreino, useRemoverTreino } from '../../services/treinos/treinos.mutations';
import { useCargasDoAluno } from '../../services/cargas/cargas.queries';
import { useMe } from '../../services/auth/auth.queries';
import type { ExercicioPayload, Treino } from '../../services/treinos/treinos.types';
import { ApiError } from '../../services/http';
import { formatDate } from '../../services/date';

interface ExercicioForm extends ExercicioPayload {
  seriesTexto: string;
}

const exercicioVazio = (): ExercicioForm => ({ nome: '', seriesTexto: '3', repeticoes: '12', carga: '', observacao: '' });

/** 22.5 → "22,5" | 20 → "20" */
const kgFmt = (v: number) => (Math.round(v * 100) / 100).toString().replace('.', ',');

/** Treinos de um aluno: lista + criação/edição (professor e admin). */
export default function TreinosAluno() {
  const { id, nome } = useLocalSearchParams<{ id: string; nome?: string }>();
  const alunoId = typeof id === 'string' ? id : undefined;
  const alunoNome = typeof nome === 'string' ? nome : 'Aluno';

  const treinos = useTreinosDoAluno(alunoId);
  const cargas = useCargasDoAluno(alunoId);
  const criar = useCriarTreino();
  const atualizar = useAtualizarTreino();
  const remover = useRemoverTreino();

  // Musculação monta treino estruturado (séries/reps/carga + evolução);
  // Funcional e Pilates escrevem o treino em texto livre (blocos de tempo).
  const me = useMe();
  const formatoCarga = me.data?.modalidadeProfessor
    ? nomeModalidade(me.data.modalidadeProfessor.nome) === 'Musculação'
    : true; // admin usa o formato estruturado

  /** Evolução registrada para um exercício (por nome). */
  const evolucaoDe = (nome: string) => (cargas.data ?? []).find((e) => e.exercicio === nome) ?? null;

  // Exercício aberto no modal de carga/progressão
  const [cargaDe, setCargaDe] = useState<{ nome: string; reps: string } | null>(null);

  // Form (null = lista; senão criação/edição)
  const [editando, setEditando] = useState<Treino | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [exercicios, setExercicios] = useState<ExercicioForm[]>([exercicioVazio()]);
  const [excluindo, setExcluindo] = useState<Treino | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const abrirNovo = () => {
    setEditando(null);
    setTitulo('');
    setConteudo('');
    setObservacoes('');
    setExercicios([exercicioVazio()]);
    setFormAberto(true);
  };

  const abrirEdicao = (t: Treino) => {
    setEditando(t);
    setTitulo(t.titulo);
    setConteudo(t.conteudo ?? '');
    setObservacoes(t.observacoes ?? '');
    setExercicios(
      t.exercicios.length > 0
        ? t.exercicios.map((e) => ({
            nome: e.nome,
            seriesTexto: String(e.series),
            repeticoes: e.repeticoes,
            carga: e.carga ?? '',
            observacao: e.observacao ?? '',
          }))
        : [exercicioVazio()],
    );
    setFormAberto(true);
  };

  const setExercicio = (i: number, campo: keyof ExercicioForm, valor: string) => {
    setExercicios((atual) => atual.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e)));
  };

  const salvar = () => {
    if (!alunoId) return;
    if (titulo.trim().length < 2) {
      setErro(formatoCarga ? 'Dê um nome ao treino (ex: Treino A — Superiores)' : 'Dê um nome ao treino (ex: Treino de terça)');
      return;
    }
    let payload;
    if (formatoCarga) {
      const validos = exercicios.filter((e) => e.nome.trim().length >= 2);
      if (validos.length === 0) {
        setErro('Adicione pelo menos um exercício com nome');
        return;
      }
      payload = {
        alunoId,
        titulo: titulo.trim(),
        observacoes: observacoes.trim() || undefined,
        exercicios: validos.map((e) => ({
          nome: e.nome.trim(),
          series: Math.min(Math.max(parseInt(e.seriesTexto, 10) || 3, 1), 20),
          repeticoes: e.repeticoes?.trim() || '12',
          carga: e.carga?.trim() || undefined,
          observacao: e.observacao?.trim() || undefined,
        })),
      };
    } else {
      if (conteudo.trim().length < 3) {
        setErro('Escreva o treino no campo de texto');
        return;
      }
      payload = {
        alunoId,
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        observacoes: observacoes.trim() || undefined,
        exercicios: [],
      };
    }
    const onSuccess = () => setFormAberto(false);
    const onError = (e: unknown) => setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar.');
    if (editando) atualizar.mutate({ id: editando.id, payload }, { onSuccess, onError });
    else criar.mutate(payload, { onSuccess, onError });
  };

  const confirmarExclusao = () => {
    if (!excluindo) return;
    remover.mutate(excluindo.id, {
      onSuccess: () => setExcluindo(null),
      onError: (e) => {
        setExcluindo(null);
        setErro(e instanceof ApiError ? e.message : 'Não foi possível remover.');
      },
    });
  };

  // ── Form de treino ──────────────────────────────────────────────────
  if (formAberto) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="dark-content" />
        <View style={s.header}>
          <View style={s.headerRow}>
            <Pressable style={s.backBtn} hitSlop={8} onPress={() => setFormAberto(false)}>
              <Icon name="arrow-back" size={20} color={LC.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{editando ? 'Editar treino' : 'Novo treino'}</Text>
              <Text style={s.subtitle}>{alunoNome}</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Input
            label="Nome do treino"
            placeholder={formatoCarga ? 'Treino A — Superiores' : 'Treino de terça'}
            value={titulo}
            onChangeText={setTitulo}
          />
          <View style={{ height: 10 }} />

          {/* Funcional/Pilates: treino em texto livre, do jeito que o professor escreve */}
          {!formatoCarga ? (
            <>
              <Input
                label="Treino"
                placeholder={'Aquecimento juntos 3x30”10”\nSkip calcanhar\nMobilidade de quadril + ombro\n\nParte 1. 30”30 3x\nPolichinelo\nBurpee inverso\n...'}
                value={conteudo}
                onChangeText={setConteudo}
                multiline
                style={s.conteudoInput}
              />
              <Text style={s.conteudoHint}>
                Escreva livre: blocos, tempos (3x30”10”), pares de exercícios — como você faria no papel.
              </Text>
              <View style={{ height: 10 }} />
            </>
          ) : null}

          <Input
            label="Observações (opcional)"
            placeholder="Aquecer 10min antes, alongar no final..."
            value={observacoes}
            onChangeText={setObservacoes}
            multiline
          />

          {formatoCarga ? (
            <>
          <Text style={s.sectionTitle}>Exercícios</Text>
          {exercicios.map((e, i) => (
            <Card key={i} style={s.exCard} padding={14} bordered>
              <View style={s.exHead}>
                <Text style={s.exNum}>{i + 1}º exercício</Text>
                {exercicios.length > 1 ? (
                  <Pressable hitSlop={6} onPress={() => setExercicios((atual) => atual.filter((_, idx) => idx !== i))}>
                    <Icon name="trash-outline" size={16} color={LC.danger} />
                  </Pressable>
                ) : null}
              </View>
              <Input placeholder="Nome (ex: Supino reto)" value={e.nome} onChangeText={(v) => setExercicio(i, 'nome', v)} />
              <View style={s.exRow}>
                <View style={{ flex: 1 }}>
                  <Input placeholder="Séries" keyboardType="number-pad" maxLength={2} value={e.seriesTexto} onChangeText={(v) => setExercicio(i, 'seriesTexto', v)} />
                </View>
                <View style={{ flex: 1.4 }}>
                  <Input placeholder="Repetições (12, 10-12...)" value={e.repeticoes} onChangeText={(v) => setExercicio(i, 'repeticoes', v)} />
                </View>
                <View style={{ flex: 1.2 }}>
                  <Input placeholder="Carga (opc.)" value={e.carga} onChangeText={(v) => setExercicio(i, 'carga', v)} />
                </View>
              </View>
              <Input placeholder="Observação (opcional)" value={e.observacao} onChangeText={(v) => setExercicio(i, 'observacao', v)} />
            </Card>
          ))}

          <Pressable style={s.addExBtn} onPress={() => setExercicios((atual) => [...atual, exercicioVazio()])}>
            <Icon name="add-circle-outline" size={18} color={LC.primary} />
            <Text style={s.addExText}>Adicionar exercício</Text>
          </Pressable>
            </>
          ) : null}

          <View style={{ height: 14 }} />
          <Button title="Salvar treino" size="lg" loading={criar.isPending || atualizar.isPending} onPress={salvar} />
          <View style={{ height: 24 }} />
        </ScrollView>

        <InfoModal visible={!!erro} title="Atenção" message={erro ?? ''} onClose={() => setErro(null)} />
      </View>
    );
  }

  // ── Lista de treinos do aluno ───────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <View style={s.headerRow}>
          <Pressable style={s.backBtn} hitSlop={8} onPress={() => router.back()}>
            <Icon name="arrow-back" size={20} color={LC.textPrimary} />
          </Pressable>
          <Avatar nome={alunoNome} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{alunoNome}</Text>
            <Text style={s.subtitle}>Treinos do aluno</Text>
          </View>
        </View>
      </View>

      {treinos.isLoading ? (
        <Loading />
      ) : treinos.isError ? (
        <ErrorState onRetry={() => treinos.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {treinos.data && treinos.data.length > 0 ? (
            treinos.data.map((t) => (
              <Card key={t.id} style={s.treinoCard} padding={16}>
                <View style={s.treinoHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.treinoTitulo}>{t.titulo}</Text>
                    <Text style={s.treinoMeta}>
                      {t.modalidade ? `${nomeModalidade(t.modalidade.nome)} • ` : ''}
                      {t.conteudo
                        ? `atualizado ${formatDate(t.updatedAt, 'DD/MM')}`
                        : `${t.exercicios.length} ${t.exercicios.length === 1 ? 'exercício' : 'exercícios'} • atualizado ${formatDate(t.updatedAt, 'DD/MM')}`}
                    </Text>
                  </View>
                  <Pressable style={s.acao} hitSlop={4} onPress={() => abrirEdicao(t)}>
                    <Icon name="create-outline" size={17} color={LC.primary} />
                  </Pressable>
                  <Pressable style={[s.acao, { backgroundColor: LC.dangerBg }]} hitSlop={4} onPress={() => setExcluindo(t)}>
                    <Icon name="trash-outline" size={17} color={LC.danger} />
                  </Pressable>
                </View>

                {t.conteudo ? <Text style={s.conteudoTexto}>{t.conteudo}</Text> : null}

                {t.exercicios.map((e) => {
                  const evo = evolucaoDe(e.nome);
                  return (
                    <Pressable
                      key={e.id}
                      accessibilityRole="button"
                      onPress={() => setCargaDe({ nome: e.nome, reps: e.repeticoes })}
                      style={({ pressed }) => [s.exLinha, pressed && s.pressed]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.exNome} numberOfLines={1}>{e.nome}</Text>
                        {evo ? (
                          <View style={s.exEvoRow}>
                            <Icon
                              name={evo.evolucaoKg > 0 ? 'trending-up' : evo.evolucaoKg < 0 ? 'trending-down' : 'remove'}
                              size={12}
                              color={evo.evolucaoKg > 0 ? LC.success : evo.evolucaoKg < 0 ? LC.danger : LC.textMuted}
                            />
                            <Text style={s.exEvoText}>
                              {kgFmt(evo.atual)} kg
                              {evo.evolucaoKg !== 0 ? ` (${evo.evolucaoKg > 0 ? '+' : ''}${kgFmt(evo.evolucaoKg)})` : ''}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={s.exDetalhe}>
                        {e.series}x{e.repeticoes}{e.carga ? ` • ${e.carga}` : ''}
                      </Text>
                      <Icon name="stats-chart-outline" size={15} color={LC.primary} />
                    </Pressable>
                  );
                })}
                {t.observacoes ? <Text style={s.treinoObs}>{t.observacoes}</Text> : null}
              </Card>
            ))
          ) : (
            <EmptyState icon="barbell-outline" title="Nenhum treino ainda" description={`Monte o primeiro treino de ${alunoNome.split(' ')[0]}.`} />
          )}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      {/* FAB novo treino */}
      <Pressable style={s.fab} onPress={abrirNovo}>
        <Icon name="add" size={26} color="#fff" />
      </Pressable>

      <TabBar isProfessor />
      <CargaExercicioModal
        exercicio={cargaDe?.nome ?? null}
        alunoId={alunoId}
        alunoNome={alunoNome}
        repeticoesPadrao={cargaDe?.reps}
        onClose={() => setCargaDe(null)}
      />
      <ConfirmModal
        visible={!!excluindo}
        title="Remover treino"
        message={excluindo ? `Remover "${excluindo.titulo}" de ${alunoNome.split(' ')[0]}?` : ''}
        confirmLabel="Remover"
        cancelLabel="Voltar"
        destructive
        loading={remover.isPending}
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluindo(null)}
      />
      <InfoModal visible={!!erro} title="Erro" message={erro ?? ''} onClose={() => setErro(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  scroll: { padding: 16, paddingTop: 8 },

  // Lista
  treinoCard: { marginBottom: 12 },
  treinoHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  treinoTitulo: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  treinoMeta: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  acao: { width: 34, height: 34, borderRadius: 17, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  exLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: LC.border },
  exNome: { fontSize: 14, fontWeight: '600', color: LC.textPrimary },
  exEvoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  exEvoText: { fontSize: 11, fontWeight: '700', color: LC.textSecondary },
  exDetalhe: { fontSize: 13, fontWeight: '700', color: LC.primary },
  pressed: { opacity: 0.7 },
  treinoObs: { fontSize: 12, color: LC.textMuted, marginTop: 10, fontStyle: 'italic' },
  conteudoTexto: { fontSize: 14, color: LC.textPrimary, lineHeight: 22, paddingTop: 6, borderTopWidth: 1, borderTopColor: LC.border },

  // Form
  conteudoInput: { minHeight: 220, textAlignVertical: 'top' },
  conteudoHint: { fontSize: 11, color: LC.textMuted, marginTop: 6, lineHeight: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 10 },
  exCard: { marginBottom: 12, gap: 10 },
  exHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exNum: { fontSize: 12, fontWeight: '800', color: LC.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  exRow: { flexDirection: 'row', gap: 8 },
  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: LC.radius.md, borderWidth: 1.5, borderColor: LC.primary, borderStyle: 'dashed',
  },
  addExText: { fontSize: 14, fontWeight: '700', color: LC.primary },

  fab: {
    position: 'absolute', right: 20, bottom: 96, width: 56, height: 56, borderRadius: 28,
    backgroundColor: LC.primary, alignItems: 'center', justifyContent: 'center',
    ...LC.shadowStrong,
  },
});
