import { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { corPorModalidade, iconePorModalidade, modalidadesDe, nomeModalidade } from '../../constants/assets';
import { TabBar } from '../../components/tab-bar';
import { Icon } from '../../components/ui/icon';
import { Avatar } from '../../components/ui/avatar';
import { InfoModal } from '../../components/ui/modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { ProfessorPainel } from '../../components/admin/professor-painel';
import { useProfessores } from '../../services/usuarios/usuarios.queries';
import type { ProfessorAdmin } from '../../services/usuarios/usuarios.admin.types';
import { nomeCurto } from '../../services/nome';
import { useIsDesktop } from '../../hooks/use-is-desktop';

/**
 * A equipe do estúdio — aba própria.
 *
 * Morava atrás de um botão pequeno na tela de alunos, e a dona quase não a
 * achava. Aqui a lista só serve para ACHAR o professor; tudo o que se faz com
 * ele (dados, modalidades, senha, link, desligar, excluir) fica no painel que
 * abre com um toque, igual ao dos alunos.
 */

type Grupo = { chave: string; titulo: string; lista: ProfessorAdmin[] };

/** Dias até o próximo aniversário (0 = hoje), ou null sem data. */
function diasAteAniversario(iso?: string | null): number | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const mes = Number(m[2]) - 1;
  const dia = Number(m[3]);
  let proximo = new Date(hoje.getFullYear(), mes, dia);
  if (proximo < hoje) proximo = new Date(hoje.getFullYear() + 1, mes, dia);
  return Math.round((proximo.getTime() - hoje.getTime()) / 86_400_000);
}

const diaEMes = (iso: string) => {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : '';
};

export default function AdminProfessores() {
  const professores = useProfessores();
  const isDesktop = useIsDesktop();
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const lista = professores.data ?? [];
  // O painel lê da lista: depois de salvar, ele já mostra o dado novo.
  const aberto = lista.find((p) => p.id === abertoId) ?? null;
  const dandoAula = lista.filter((p) => p.ativo && p.ativado);

  const grupos: Grupo[] = [
    { chave: 'ativos', titulo: 'Dando aula', lista: dandoAula },
    { chave: 'sem-senha', titulo: 'Ainda não entraram', lista: lista.filter((p) => !p.ativado) },
    { chave: 'desligados', titulo: 'Desligados', lista: lista.filter((p) => p.ativado && !p.ativo) },
  ].filter((g) => g.lista.length > 0);

  /** Aniversários da equipe nos próximos 30 dias, o mais perto primeiro. */
  const aniversarios = dandoAula
    .map((p) => ({ p, dias: diasAteAniversario(p.dataNascimento) }))
    .filter((x): x is { p: ProfessorAdmin; dias: number } => x.dias !== null && x.dias <= 30)
    .sort((a, b) => a.dias - b.dias);
  const semNascimento = dandoAula.filter((p) => !p.dataNascimento).length;

  const cartao = (p: ProfessorAdmin) => {
    const mods = modalidadesDe(p);
    const fichas = p.fichas ?? 0;
    return (
      <Pressable
        key={p.id}
        onPress={() => setAbertoId(p.id)}
        style={({ pressed }) => [s.card, isDesktop && s.cardDesktop, !p.ativo && p.ativado && s.cardDesligado, pressed && s.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${p.nome}`}
      >
        <Avatar nome={p.nome} size={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.nome} numberOfLines={1}>{nomeCurto(p.nome)}</Text>
          <View style={s.mods}>
            {mods.length === 0 ? (
              <Text style={[s.modTexto, { color: LC.danger }]}>Sem modalidade</Text>
            ) : (
              mods.map((m) => {
                const cor = corPorModalidade(m.nome);
                return (
                  <View key={m.id} style={[s.mod, { backgroundColor: cor + '1A' }]}>
                    <Icon name={iconePorModalidade(m.nome)} size={11} color={cor} />
                    <Text style={[s.modTexto, { color: cor }]}>{nomeModalidade(m.nome)}</Text>
                  </View>
                );
              })
            )}
          </View>
          <Text style={s.meta} numberOfLines={2}>
            {fichas === 1 ? '1 ficha' : `${fichas} fichas`}
            {p.dataNascimento ? `  ·  🎂 ${diaEMes(p.dataNascimento)}` : ''}
            {!p.ativado ? '  ·  sem senha' : ''}
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color={LC.textMuted} />
      </Pressable>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Professores</Text>
        <Text style={s.subtitle}>
          {lista.length} na equipe{lista.length ? ` · ${dandoAula.length} dando aula` : ''}
        </Text>
      </View>

      {professores.isLoading ? (
        <Loading />
      ) : professores.isError ? (
        <ErrorState onRetry={() => professores.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {aniversarios.length > 0 ? (
            <View style={s.festa}>
              <Icon name="gift" size={18} color="#BE185D" />
              <View style={{ flex: 1 }}>
                {aniversarios.map(({ p, dias }) => (
                  <Text key={p.id} style={s.festaTexto}>
                    <Text style={{ fontWeight: '800' }}>{nomeCurto(p.nome)}</Text>
                    {dias === 0
                      ? ' faz aniversário hoje!'
                      : dias === 1
                        ? ' faz aniversário amanhã'
                        : ` faz aniversário em ${dias} dias (${diaEMes(p.dataNascimento!)})`}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          {lista.length === 0 ? (
            <EmptyState
              icon="school-outline"
              title="Nenhum professor cadastrado"
              description="Use o botão + para cadastrar o primeiro."
            />
          ) : (
            grupos.map((g) => (
              <View key={g.chave}>
                <Text style={s.grupo}>
                  {g.titulo} · {g.lista.length}
                </Text>
                <View style={isDesktop ? s.gradeDesktop : null}>{g.lista.map(cartao)}</View>
              </View>
            ))
          )}

          {semNascimento > 0 ? (
            <Text style={s.dica}>
              {semNascimento === 1
                ? '1 professor está sem data de nascimento'
                : `${semNascimento} professores estão sem data de nascimento`}{' '}
              — preencha em Editar dados para o aniversário aparecer no painel.
            </Text>
          ) : null}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <Pressable
        style={s.fab}
        onPress={() => router.push('/admin/novo-professor' as any)}
        accessibilityRole="button"
        accessibilityLabel="Cadastrar professor"
      >
        <Icon name="add" size={26} color="#fff" />
      </Pressable>

      <TabBar isAdmin />

      <ProfessorPainel
        professor={aberto}
        equipe={lista}
        onClose={() => setAbertoId(null)}
        onExcluido={(mensagem) => {
          setAbertoId(null);
          setAviso(mensagem);
        }}
      />
      {/* Só com o painel fechado: aberto por cima, ficaria atrás dele no navegador. */}
      <InfoModal visible={!!aviso && !aberto} title="Pronto" message={aviso ?? ''} onClose={() => setAviso(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  scroll: { ...LC.coluna, padding: 16, paddingTop: 8 },

  festa: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, marginBottom: 6,
    borderRadius: 14, backgroundColor: '#FCE7F3', borderWidth: 1, borderColor: '#FBCFE8',
  },
  festaTexto: { fontSize: 13, color: '#9D174D', lineHeight: 19 },

  grupo: {
    fontSize: 11.5, fontWeight: '800', color: LC.textMuted, letterSpacing: 0.6,
    textTransform: 'uppercase', marginTop: 14, marginBottom: 8, marginLeft: 4,
  },
  gradeDesktop: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10,
    backgroundColor: LC.bgCard, borderRadius: 16, borderWidth: 1, borderColor: LC.border,
  },
  cardDesktop: { flexBasis: '48%', flexGrow: 1, marginBottom: 0 },
  cardDesligado: { opacity: 0.6 },
  pressed: { opacity: 0.8 },
  nome: { fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  mods: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  mod: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  modTexto: { fontSize: 11.5, fontWeight: '700' },
  meta: { fontSize: 12, color: LC.textSecondary, marginTop: 6 },
  dica: { fontSize: 12, color: LC.textMuted, lineHeight: 17, marginTop: 14, marginHorizontal: 4 },

  fab: {
    position: 'absolute', right: 20, bottom: 96, width: 56, height: 56, borderRadius: 28,
    backgroundColor: LC.primary, alignItems: 'center', justifyContent: 'center',
    ...LC.shadowStrong,
  },
});
