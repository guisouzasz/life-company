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
import { FichaExercicios } from '../../components/professor/ficha-exercicios';
import { Badge } from '../../components/ui/badge';
import { useTreinosDoAluno } from '../../services/treinos/treinos.queries';
import { useCriarTreino, useAtualizarTreino, useRemoverTreino, useDefinirStatusTreino } from '../../services/treinos/treinos.mutations';
import { useCargasDoAluno } from '../../services/cargas/cargas.queries';
import { useAnamneseDoAluno } from '../../services/anamnese/anamnese.queries';
import { AnamneseModal } from '../../components/professor/anamnese-modal';
import { useMe } from '../../services/auth/auth.queries';
import type { ExercicioPayload, Treino } from '../../services/treinos/treinos.types';
import { ApiError } from '../../services/http';
import { formatDate } from '../../services/date';

interface ExercicioForm extends ExercicioPayload {
  seriesTexto: string;
}

/** Bloco de exercícios de um mesmo grupo muscular, como na ficha impressa. */
interface Secao {
  grupo: string;
  itens: ExercicioForm[];
}

/** Grupos musculares mais usados (chips de atalho no form). */
const GRUPOS = ['Pernas', 'Peitoral', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Abdômen', 'Glúteos', 'Aeróbico'];

const exercicioVazio = (): ExercicioForm => ({ nome: '', seriesTexto: '3', repeticoes: '12', carga: '', observacao: '' });
const secaoVazia = (grupo = ''): Secao => ({ grupo, itens: [exercicioVazio()] });

/** Monta as seções a partir dos exercícios salvos, na ordem em que cada grupo aparece. */
function agrupar(exercicios: Treino['exercicios']): Secao[] {
  const secoes: Secao[] = [];
  for (const e of exercicios) {
    const grupo = e.grupo ?? '';
    let secao = secoes.find((s) => s.grupo === grupo);
    if (!secao) {
      secao = { grupo, itens: [] };
      secoes.push(secao);
    }
    secao.itens.push({
      nome: e.nome,
      seriesTexto: String(e.series),
      repeticoes: e.repeticoes,
      carga: e.carga ?? '',
      observacao: e.observacao ?? '',
    });
  }
  return secoes.length > 0 ? secoes : [secaoVazia()];
}

// ── Metadados da ficha (chips de atalho) ──────────────────────────────
const FREQUENCIAS = ['1x', '2x', '3x', '4x', '5x', '6x']; // → "3x por semana"
const DURACOES: { label: string; meses: number }[] = [
  { label: 'Sem prazo', meses: 0 },
  { label: '1 mês', meses: 1 },
  { label: '2 meses', meses: 2 },
  { label: '3 meses', meses: 3 },
];

/** Data de hoje + N meses no formato YYYY-MM-DD. */
const emMeses = (n: number): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Treinos de um aluno: lista + criação/edição (professor e admin). */
export default function TreinosAluno() {
  const { id, nome } = useLocalSearchParams<{ id: string; nome?: string }>();
  const alunoId = typeof id === 'string' ? id : undefined;
  const alunoNome = typeof nome === 'string' ? nome : 'Aluno';

  const treinos = useTreinosDoAluno(alunoId);
  const cargas = useCargasDoAluno(alunoId);
  const anamnese = useAnamneseDoAluno(alunoId);
  const [verAnamnese, setVerAnamnese] = useState(false);
  const criar = useCriarTreino();
  const atualizar = useAtualizarTreino();
  const remover = useRemoverTreino();
  const definirStatus = useDefinirStatusTreino();

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
  const [secoes, setSecoes] = useState<Secao[]>([secaoVazia()]);
  const [excluindo, setExcluindo] = useState<Treino | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Metadados da ficha (opcionais)
  const [frequencia, setFrequencia] = useState('');
  const [vencimento, setVencimento] = useState(''); // YYYY-MM-DD

  const abrirNovo = () => {
    setEditando(null);
    setTitulo('');
    setConteudo('');
    setObservacoes('');
    setSecoes([secaoVazia()]);
    setFrequencia('');
    setVencimento('');
    setFormAberto(true);
  };

  const abrirEdicao = (t: Treino) => {
    setEditando(t);
    setTitulo(t.titulo);
    setConteudo(t.conteudo ?? '');
    setObservacoes(t.observacoes ?? '');
    setFrequencia(t.frequencia ?? '');
    setVencimento(t.vencimento ? t.vencimento.slice(0, 10) : '');
    setSecoes(agrupar(t.exercicios));
    setFormAberto(true);
  };

  // ── Edição das seções (grupo muscular → exercícios) ─────────────────
  const setItem = (si: number, ii: number, campo: keyof ExercicioForm, valor: string) =>
    setSecoes((atual) =>
      atual.map((s, i) =>
        i !== si ? s : { ...s, itens: s.itens.map((e, j) => (j === ii ? { ...e, [campo]: valor } : e)) },
      ),
    );

  const addItem = (si: number) =>
    setSecoes((atual) => atual.map((s, i) => (i === si ? { ...s, itens: [...s.itens, exercicioVazio()] } : s)));

  const removeItem = (si: number, ii: number) =>
    setSecoes((atual) => atual.map((s, i) => (i === si ? { ...s, itens: s.itens.filter((_, j) => j !== ii) } : s)));

  const setGrupo = (si: number, grupo: string) =>
    setSecoes((atual) => atual.map((s, i) => (i === si ? { ...s, grupo } : s)));

  const addSecao = () => setSecoes((atual) => [...atual, secaoVazia()]);
  const removeSecao = (si: number) => setSecoes((atual) => atual.filter((_, i) => i !== si));

  const salvar = () => {
    if (!alunoId) return;
    if (titulo.trim().length < 2) {
      setErro(formatoCarga ? 'Dê um nome ao treino (ex: Treino A — Superiores)' : 'Dê um nome ao treino (ex: Treino de terça)');
      return;
    }
    const meta = {
      frequencia: frequencia || undefined,
      vencimento: vencimento || undefined,
    };
    let payload;
    if (formatoCarga) {
      // Achata as seções na ordem da tela: a ficha sai agrupada por músculo.
      const validos = secoes.flatMap((s) =>
        s.itens
          .filter((e) => e.nome.trim().length >= 2)
          .map((e) => ({
            grupo: s.grupo || undefined,
            nome: e.nome.trim(),
            series: Math.min(Math.max(parseInt(e.seriesTexto, 10) || 3, 1), 20),
            repeticoes: e.repeticoes?.trim() || '12',
            carga: e.carga?.trim() || undefined,
            observacao: e.observacao?.trim() || undefined,
          })),
      );
      if (validos.length === 0) {
        setErro('Adicione pelo menos um exercício com nome');
        return;
      }
      payload = {
        alunoId,
        titulo: titulo.trim(),
        observacoes: observacoes.trim() || undefined,
        ...meta,
        exercicios: validos,
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
        ...meta,
        exercicios: [],
      };
    }
    const onSuccess = () => setFormAberto(false);
    const onError = (e: unknown) => setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar.');
    if (editando) atualizar.mutate({ id: editando.id, payload }, { onSuccess, onError });
    else criar.mutate(payload, { onSuccess, onError });
  };

  const alternarStatus = (t: Treino) => {
    definirStatus.mutate(
      { id: t.id, concluido: !t.concluido },
      { onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível atualizar o status.') },
    );
  };

  /** Linha compacta com os metadados preenchidos da ficha. */
  const metaResumo = (t: Treino): string => (t.frequencia ?? '');

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

          {/* Detalhes da ficha (opcionais) — frequência, validade, pausa, execução */}
          <Text style={s.sectionTitle}>Detalhes da ficha (opcional)</Text>

          <Text style={s.metaLabel}>Frequência</Text>
          <View style={s.grupoChips}>
            {FREQUENCIAS.map((f) => {
              const val = `${f} por semana`;
              const sel = frequencia === val;
              return (
                <Pressable key={f} style={[s.grupoChip, sel && s.grupoChipSel]} onPress={() => setFrequencia(sel ? '' : val)}>
                  <Text style={[s.grupoChipText, sel && s.grupoChipTextSel]}>{f}/sem</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.metaLabel}>Validade da ficha</Text>
          <View style={s.grupoChips}>
            {DURACOES.map((d) => {
              const alvo = d.meses === 0 ? '' : emMeses(d.meses);
              const sel = vencimento === alvo;
              return (
                <Pressable key={d.label} style={[s.grupoChip, sel && s.grupoChipSel]} onPress={() => setVencimento(alvo)}>
                  <Text style={[s.grupoChipText, sel && s.grupoChipTextSel]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {vencimento ? <Text style={s.metaHint}>Vence em {formatDate(vencimento, 'DD/MM/YYYY')}</Text> : null}

          {formatoCarga ? (
            <>
          <Text style={s.sectionTitle}>Exercícios por grupo muscular</Text>

          {secoes.map((secao, si) => (
            <View key={si} style={s.secao}>
              {/* Cabeçalho do grupo: nome escolhido ou os chips para escolher */}
              <View style={s.secaoHead}>
                {secao.grupo ? (
                  <>
                    <Text style={s.secaoTitulo}>{secao.grupo}</Text>
                    <Pressable hitSlop={6} onPress={() => setGrupo(si, '')}>
                      <Text style={s.secaoTrocar}>trocar</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={s.secaoTituloVazio}>Escolha o grupo muscular</Text>
                )}
                <View style={{ flex: 1 }} />
                {secoes.length > 1 ? (
                  <Pressable hitSlop={6} onPress={() => removeSecao(si)}>
                    <Icon name="trash-outline" size={16} color={LC.danger} />
                  </Pressable>
                ) : null}
              </View>

              {!secao.grupo ? (
                <View style={s.grupoChips}>
                  {GRUPOS.map((g) => (
                    <Pressable key={g} style={s.grupoChip} onPress={() => setGrupo(si, g)}>
                      <Text style={s.grupoChipText}>{g}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {secao.itens.map((e, ii) => (
                <Card key={ii} style={s.exCard} padding={14} bordered>
                  <View style={s.exHead}>
                    <Text style={s.exNum}>{ii + 1}º exercício</Text>
                    {secao.itens.length > 1 ? (
                      <Pressable hitSlop={6} onPress={() => removeItem(si, ii)}>
                        <Icon name="trash-outline" size={16} color={LC.danger} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Input placeholder="Nome (ex: Supino reto)" value={e.nome} onChangeText={(v) => setItem(si, ii, 'nome', v)} />
                  <View style={s.exRow}>
                    <View style={{ flex: 1 }}>
                      <Input placeholder="Séries" keyboardType="number-pad" maxLength={2} value={e.seriesTexto} onChangeText={(v) => setItem(si, ii, 'seriesTexto', v)} />
                    </View>
                    <View style={{ flex: 1.4 }}>
                      <Input placeholder="Repetições (12, 10-12...)" value={e.repeticoes} onChangeText={(v) => setItem(si, ii, 'repeticoes', v)} />
                    </View>
                    <View style={{ flex: 1.2 }}>
                      <Input placeholder="Carga (opc.)" value={e.carga} onChangeText={(v) => setItem(si, ii, 'carga', v)} />
                    </View>
                  </View>
                  <Input placeholder="Observação (opcional)" value={e.observacao} onChangeText={(v) => setItem(si, ii, 'observacao', v)} />
                </Card>
              ))}

              <Pressable style={s.addExBtn} onPress={() => addItem(si)}>
                <Icon name="add-circle-outline" size={18} color={LC.primary} />
                <Text style={s.addExText}>
                  Adicionar exercício{secao.grupo ? ` em ${secao.grupo}` : ''}
                </Text>
              </Pressable>
            </View>
          ))}

          <Pressable style={s.addGrupoBtn} onPress={addSecao}>
            <Icon name="add" size={18} color="#fff" />
            <Text style={s.addGrupoText}>Adicionar grupo muscular</Text>
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

        {/* Ficha de saúde: ler antes de montar o treino */}
        <Pressable style={s.fichaSaude} onPress={() => setVerAnamnese(true)}>
          <Icon name="clipboard-outline" size={16} color={anamnese.data ? LC.primary : LC.textMuted} />
          <Text style={[s.fichaSaudeTexto, !anamnese.data && { color: LC.textMuted }]}>
            {anamnese.data ? 'Ver ficha de saúde' : 'Sem ficha de saúde preenchida'}
          </Text>
          {anamnese.data ? <Icon name="chevron-forward" size={15} color={LC.primary} /> : null}
        </Pressable>
      </View>

      {treinos.isLoading ? (
        <Loading />
      ) : treinos.isError ? (
        <ErrorState onRetry={() => treinos.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {treinos.data && treinos.data.length > 0 ? (
            treinos.data.map((t) => (
              <Card key={t.id} style={[s.treinoCard, t.concluido && s.treinoCardConcluido]} padding={16}>
                <View style={s.treinoHead}>
                  <View style={{ flex: 1 }}>
                    <View style={s.tituloRow}>
                      <Text style={s.treinoTitulo}>{t.titulo.toUpperCase()}</Text>
                      <Badge label={t.concluido ? 'Concluída' : 'Ativa'} variant={t.concluido ? 'neutral' : 'success'} />
                    </View>
                    <Text style={s.treinoMeta}>
                      {t.modalidade ? `${nomeModalidade(t.modalidade.nome)} • ` : ''}
                      {t.conteudo
                        ? `atualizado ${formatDate(t.updatedAt, 'DD/MM')}`
                        : `${t.exercicios.length} ${t.exercicios.length === 1 ? 'exercício' : 'exercícios'} • atualizado ${formatDate(t.updatedAt, 'DD/MM')}`}
                    </Text>
                  </View>
                  <Pressable
                    style={[s.acao, { backgroundColor: t.concluido ? LC.primaryLight : LC.successBg }]}
                    hitSlop={4}
                    onPress={() => alternarStatus(t)}
                  >
                    <Icon name={t.concluido ? 'refresh-outline' : 'checkmark-done-outline'} size={17} color={t.concluido ? LC.primary : LC.success} />
                  </Pressable>
                  <Pressable style={s.acao} hitSlop={4} onPress={() => abrirEdicao(t)}>
                    <Icon name="create-outline" size={17} color={LC.primary} />
                  </Pressable>
                  <Pressable style={[s.acao, { backgroundColor: LC.dangerBg }]} hitSlop={4} onPress={() => setExcluindo(t)}>
                    <Icon name="trash-outline" size={17} color={LC.danger} />
                  </Pressable>
                </View>

                {(metaResumo(t) || t.vencimento) ? (
                  <View style={s.metaChips}>
                    {metaResumo(t) ? <Text style={s.metaChipText}>{metaResumo(t)}</Text> : null}
                    {t.vencimento ? (
                      <Text style={s.metaChipText}>
                        {metaResumo(t) ? '• ' : ''}vence {formatDate(t.vencimento, 'DD/MM/YYYY')}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {t.conteudo ? <Text style={s.conteudoTexto}>{t.conteudo}</Text> : null}

                <FichaExercicios
                  exercicios={t.exercicios}
                  evolucaoDe={evolucaoDe}
                  onAbrirCarga={setCargaDe}
                />
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
      <AnamneseModal
        visible={verAnamnese}
        alunoNome={alunoNome}
        ficha={anamnese.data}
        onClose={() => setVerAnamnese(false)}
      />
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
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  fichaSaude: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border,
    borderRadius: LC.radius.md, paddingHorizontal: 14, paddingVertical: 10,
  },
  fichaSaudeTexto: { flex: 1, fontSize: 13.5, fontWeight: '700', color: LC.primary },
  scroll: { ...LC.coluna, padding: 16, paddingTop: 8 },

  // Lista
  treinoCard: { marginBottom: 12 },
  treinoCardConcluido: { opacity: 0.7 },
  treinoHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  tituloRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  // Título da ficha em maiúsculas e na cor da marca, como no cabeçalho de uma
  // ficha impressa (o modelo de referência usa vermelho; aqui vale o teal).
  treinoTitulo: { fontSize: 16, fontWeight: '800', color: LC.primary, letterSpacing: 0.4 },
  treinoMeta: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  metaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metaChipText: { fontSize: 12, fontWeight: '600', color: LC.textSecondary },
  acao: { width: 34, height: 34, borderRadius: 17, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  treinoObs: { fontSize: 12, color: LC.textMuted, marginTop: 10, fontStyle: 'italic' },
  conteudoTexto: { fontSize: 14, color: LC.textPrimary, lineHeight: 22, paddingTop: 6, borderTopWidth: 1, borderTopColor: LC.border },

  // Form
  conteudoInput: { minHeight: 220, textAlignVertical: 'top' },
  conteudoHint: { fontSize: 11, color: LC.textMuted, marginTop: 6, lineHeight: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: LC.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 10 },
  metaLabel: { fontSize: 13, fontWeight: '700', color: LC.textSecondary, marginTop: 12, marginBottom: 8 },
  metaHint: { fontSize: 12, color: LC.textMuted, marginTop: 6 },
  grupoChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  grupoChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: LC.radius.full, backgroundColor: LC.bg, borderWidth: 1, borderColor: LC.border },
  grupoChipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  grupoChipText: { fontSize: 12, fontWeight: '600', color: LC.textSecondary },
  grupoChipTextSel: { color: LC.primary, fontWeight: '700' },
  // Seção = um grupo muscular com seus exercícios
  secao: {
    marginBottom: 18, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 12,
    backgroundColor: LC.bg, borderRadius: LC.radius.lg, borderWidth: 1, borderColor: LC.border,
  },
  secaoHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingHorizontal: 2 },
  secaoTitulo: {
    fontSize: 15, fontWeight: '800', color: LC.primary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  secaoTituloVazio: { fontSize: 13.5, fontWeight: '700', color: LC.textSecondary },
  secaoTrocar: { fontSize: 12, fontWeight: '700', color: LC.textMuted, textDecorationLine: 'underline' },
  addGrupoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: LC.radius.md, backgroundColor: LC.primary, marginTop: 4,
  },
  addGrupoText: { fontSize: 14, fontWeight: '800', color: '#fff' },
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
