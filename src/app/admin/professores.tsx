import { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { iconePorModalidade, nomeModalidade } from '../../constants/assets';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Avatar } from '../../components/ui/avatar';
import { Badge, type BadgeVariant } from '../../components/ui/badge';
import { AppModal, ConfirmModal, InfoModal } from '../../components/ui/modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useProfessores } from '../../services/usuarios/usuarios.queries';
import { useModalidades } from '../../services/modalidades/modalidades.queries';
import { useAtualizarAluno, useDefinirSenha } from '../../services/usuarios/usuarios.mutations';
import type { ProfessorAdmin } from '../../services/usuarios/usuarios.admin.types';
import { mascaraCpf } from '../../services/mascaras';
import { ApiError } from '../../services/http';

/**
 * Gestão dos professores.
 *
 * Existe porque professor cadastrado sumia: a lista de pessoas do painel só
 * traz alunos, então depois de criado ninguém mais o via — nem para conferir
 * a modalidade, nem para desligar quem saiu, nem para socorrer senha perdida.
 *
 * Definir a senha aqui é a única saída para senha esquecida: o estúdio não
 * envia e-mail, então não existe "esqueci minha senha" que o professor
 * resolva sozinho.
 */

/** As mesmas regras que a tela de primeiro acesso mostra ao usuário. */
const REGRAS = [
  { label: 'Mínimo de 6 caracteres', test: (v: string) => v.length >= 6 },
  { label: 'Pelo menos uma maiúscula', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Pelo menos um número', test: (v: string) => /\d/.test(v) },
];

/**
 * Situação da conta em uma etiqueta só.
 *
 * "Sem senha" vem antes de "Inativo" de propósito: o cadastro nasce inativo e
 * só é ligado na ativação, então um professor recém-criado é as duas coisas.
 * Chamá-lo de "Inativo" faria parecer que alguém o desligou — o que ele é, de
 * fato, é uma conta que ainda não foi usada.
 */
function situacao(p: ProfessorAdmin): { label: string; variant: BadgeVariant } {
  if (!p.ativado) return { label: 'Sem senha', variant: 'warning' };
  if (!p.ativo) return { label: 'Inativo', variant: 'danger' };
  return { label: 'Ativo', variant: 'success' };
}

export default function AdminProfessores() {
  const professores = useProfessores();
  const modalidades = useModalidades();
  const definirSenha = useDefinirSenha();
  const atualizar = useAtualizarAluno();

  const [senhaDe, setSenhaDe] = useState<ProfessorAdmin | null>(null);
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [alternando, setAlternando] = useState<ProfessorAdmin | null>(null);
  const [trocandoModalidade, setTrocandoModalidade] = useState<ProfessorAdmin | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const lista = professores.data ?? [];

  const abrirSenha = (p: ProfessorAdmin) => {
    setSenha('');
    setConfirmar('');
    setSenhaDe(p);
  };

  const salvarSenha = () => {
    if (!senhaDe) return;
    if (!REGRAS.every((r) => r.test(senha))) {
      setErro('A senha não cumpre os requisitos abaixo.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não conferem.');
      return;
    }
    const alvo = senhaDe;
    definirSenha.mutate(
      { id: alvo.id, senha },
      {
        onSuccess: () => {
          setSenhaDe(null);
          // O acesso é pelo e-mail quando existe; senão, pelo CPF.
          const login = alvo.email || mascaraCpf(alvo.cpf);
          setAviso(
            `Senha definida para ${alvo.nome}. Ele entra com ${login} e a senha que você acabou de criar.`,
          );
        },
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível definir a senha.'),
      },
    );
  };

  const trocarModalidade = (modalidadeId: string) => {
    if (!trocandoModalidade) return;
    const alvo = trocandoModalidade;
    atualizar.mutate(
      { id: alvo.id, payload: { modalidadeId } },
      {
        onSuccess: () => setTrocandoModalidade(null),
        onError: (e) => {
          setTrocandoModalidade(null);
          setErro(e instanceof ApiError ? e.message : 'Não foi possível trocar a modalidade.');
        },
      },
    );
  };

  const confirmarAlternar = () => {
    if (!alternando) return;
    const alvo = alternando;
    atualizar.mutate(
      { id: alvo.id, payload: { ativo: !alvo.ativo } },
      {
        onSuccess: () => setAlternando(null),
        onError: (e) => {
          setAlternando(null);
          setErro(e instanceof ApiError ? e.message : 'Não foi possível atualizar.');
        },
      },
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <View style={s.headerRow}>
          <Pressable
            style={s.backBtn}
            hitSlop={8}
            onPress={() => router.replace('/admin/alunos')}
            accessibilityRole="button"
            accessibilityLabel="Voltar para alunos"
          >
            <Icon name="arrow-back" size={20} color={LC.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Professores</Text>
            <Text style={s.subtitle}>
              {lista.length} {lista.length === 1 ? 'cadastrado' : 'cadastrados'}
            </Text>
          </View>
        </View>
      </View>

      {professores.isLoading ? (
        <Loading />
      ) : professores.isError ? (
        <ErrorState onRetry={() => professores.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {lista.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="Nenhum professor cadastrado"
              description="Use o botão + e escolha PROFESSOR no topo do formulário."
            />
          ) : (
            lista.map((p) => {
              const st = situacao(p);
              return (
                <Card key={p.id} style={[s.card, !p.ativo && s.cardInativo]} padding={16}>
                  <View style={s.cardTopo}>
                    <Avatar nome={p.nome} size={42} />
                    <View style={{ flex: 1 }}>
                      <View style={s.nomeRow}>
                        <Text style={s.nome} numberOfLines={1}>{p.nome}</Text>
                        <Badge label={st.label} variant={st.variant} />
                      </View>
                      {/* A modalidade decide o que o professor enxerga: a
                          agenda dela e o formato da ficha. Por isso é editável
                          aqui — errar na criação não pode custar a conta. */}
                      <Pressable
                        style={({ pressed }) => [s.modalidadeBtn, pressed && s.acaoPress]}
                        onPress={() => setTrocandoModalidade(p)}
                        accessibilityRole="button"
                        accessibilityLabel={`Trocar modalidade de ${p.nome}`}
                      >
                        <Text style={p.modalidadeProfessor ? s.modalidade : s.semModalidade}>
                          {p.modalidadeProfessor
                            ? nomeModalidade(p.modalidadeProfessor.nome)
                            : 'Sem modalidade definida'}
                        </Text>
                        <Icon name="create-outline" size={13} color={LC.textMuted} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={s.dados}>
                    <View style={s.dadoLinha}>
                      <Icon name="mail-outline" size={13} color={LC.textMuted} />
                      <Text style={s.dadoTexto} numberOfLines={1}>
                        {p.email || 'sem e-mail — entra pelo CPF'}
                      </Text>
                    </View>
                    <View style={s.dadoLinha}>
                      <Icon name="card-outline" size={13} color={LC.textMuted} />
                      <Text style={s.dadoTexto}>CPF {mascaraCpf(p.cpf)}</Text>
                    </View>
                    {!p.ativado ? (
                      <View style={s.dadoLinha}>
                        <Icon name="information-circle-outline" size={13} color={LC.warningFg} />
                        <Text style={[s.dadoTexto, { color: LC.warningFg }]} numberOfLines={2}>
                          Ainda não acessou. Defina a senha aqui, ou peça que ele use o Primeiro acesso.
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={s.acoes}>
                    <Pressable
                      style={({ pressed }) => [s.acao, pressed && s.acaoPress]}
                      onPress={() => abrirSenha(p)}
                      accessibilityRole="button"
                      accessibilityLabel={`Definir senha de ${p.nome}`}
                    >
                      <Icon name="key-outline" size={15} color={LC.primary} />
                      <Text style={s.acaoTexto}>{p.ativado ? 'Redefinir senha' : 'Definir senha'}</Text>
                    </Pressable>

                    {/* Conta que nunca foi usada não tem o que desativar — o
                        que falta nela é senha, e definir a senha já a liga. */}
                    {p.ativado ? (
                      <Pressable
                        style={({ pressed }) => [s.acao, s.acaoNeutra, pressed && s.acaoPress]}
                        onPress={() => setAlternando(p)}
                        accessibilityRole="button"
                        accessibilityLabel={`${p.ativo ? 'Desativar' : 'Reativar'} ${p.nome}`}
                      >
                        <Icon
                          name={p.ativo ? 'pause-outline' : 'play-outline'}
                          size={15}
                          color={LC.textSecondary}
                        />
                        <Text style={s.acaoTextoNeutro}>{p.ativo ? 'Desativar' : 'Reativar'}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Card>
              );
            })
          )}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <Pressable
        style={s.fab}
        onPress={() => router.push('/admin/novo-aluno')}
        accessibilityRole="button"
        accessibilityLabel="Cadastrar professor"
      >
        <Icon name="add" size={26} color="#fff" />
      </Pressable>

      <TabBar isAdmin />

      {/* ── Definir senha ────────────────────────────────────────────── */}
      <AppModal
        visible={!!senhaDe}
        onClose={() => setSenhaDe(null)}
        title={senhaDe?.ativado ? 'Redefinir senha' : 'Definir senha'}
      >
        <Text style={s.modalTexto}>
          {senhaDe?.nome}
          {senhaDe?.ativado
            ? ' já tem senha. A antiga deixa de valer e as sessões abertas caem.'
            : ' ainda não tem senha. Definindo aqui, a conta já fica pronta para usar.'}
        </Text>

        <Input
          label="Nova senha"
          placeholder="••••••••"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={{ height: 8 }} />
        <Input
          label="Repita a senha"
          placeholder="••••••••"
          value={confirmar}
          onChangeText={setConfirmar}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={s.regras}>
          {REGRAS.map((r) => {
            const ok = r.test(senha);
            return (
              <View key={r.label} style={s.regraLinha}>
                <Icon
                  name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={ok ? LC.success : LC.textMuted}
                />
                <Text style={[s.regraTexto, ok && s.regraOk]}>{r.label}</Text>
              </View>
            );
          })}
        </View>

        <View style={s.modalAcoes}>
          <Button title="Cancelar" variant="outline" onPress={() => setSenhaDe(null)} style={{ flex: 1 }} />
          <Button title="Salvar" loading={definirSenha.isPending} onPress={salvarSenha} style={{ flex: 1 }} />
        </View>
      </AppModal>

      <ConfirmModal
        visible={!!alternando}
        title={alternando?.ativo ? 'Desativar professor' : 'Reativar professor'}
        message={
          alternando?.ativo
            ? `${alternando?.nome} não vai mais conseguir entrar no sistema. Os treinos que ele montou continuam onde estão.`
            : `${alternando?.nome} volta a conseguir entrar com a senha dele.`
        }
        confirmLabel={alternando?.ativo ? 'Desativar' : 'Reativar'}
        cancelLabel="Voltar"
        destructive={!!alternando?.ativo}
        loading={atualizar.isPending}
        onConfirm={confirmarAlternar}
        onCancel={() => setAlternando(null)}
      />

      <AppModal
        visible={!!trocandoModalidade}
        onClose={() => setTrocandoModalidade(null)}
        title="Modalidade do professor"
      >
        <Text style={s.modalTexto}>
          {trocandoModalidade?.nome} passa a ver a agenda desta modalidade, e a ficha de treino
          segue o formato dela.
        </Text>
        <View style={s.chips}>
          {(modalidades.data ?? []).map((m) => {
            const sel = trocandoModalidade?.modalidadeProfessor?.id === m.id;
            return (
              <Pressable
                key={m.id}
                style={[s.chip, sel && s.chipSel]}
                onPress={() => trocarModalidade(m.id)}
                accessibilityRole="button"
                accessibilityLabel={`Usar ${nomeModalidade(m.nome)}`}
                accessibilityState={{ selected: sel }}
              >
                <Icon name={iconePorModalidade(m.nome)} size={14} color={sel ? LC.primary : LC.textSecondary} />
                <Text style={[s.chipTexto, sel && s.chipTextoSel]}>{nomeModalidade(m.nome)}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppModal>

      <InfoModal visible={!!aviso} title="Pronto" message={aviso ?? ''} onClose={() => setAviso(null)} />
      <InfoModal visible={!!erro} title="Atenção" message={erro ?? ''} onClose={() => setErro(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: LC.bgCard,
    borderWidth: 1, borderColor: LC.border, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  scroll: { ...LC.coluna, padding: 16, paddingTop: 8 },

  card: { marginBottom: 12 },
  cardInativo: { opacity: 0.65 },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nomeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nome: { fontSize: 16, fontWeight: '800', color: LC.textPrimary, flexShrink: 1 },
  modalidadeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, alignSelf: 'flex-start' },
  modalidade: { fontSize: 13, fontWeight: '600', color: LC.primary },
  semModalidade: { fontSize: 13, color: LC.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: LC.radius.full,
    backgroundColor: LC.bg, borderWidth: 1, borderColor: LC.border,
  },
  chipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  chipTexto: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  chipTextoSel: { color: LC.primary, fontWeight: '700' },

  dados: { marginTop: 12, gap: 5 },
  dadoLinha: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dadoTexto: { flex: 1, fontSize: 12.5, color: LC.textSecondary },

  acoes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  acao: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: LC.radius.md, backgroundColor: LC.primaryLight,
  },
  acaoNeutra: { backgroundColor: LC.neutralBg },
  acaoPress: { opacity: 0.75 },
  acaoTexto: { fontSize: 12.5, fontWeight: '700', color: LC.primary },
  acaoTextoNeutro: { fontSize: 12.5, fontWeight: '700', color: LC.textSecondary },

  modalTexto: { fontSize: 13.5, color: LC.textSecondary, lineHeight: 19, marginBottom: 14 },
  regras: { marginTop: 12, gap: 6 },
  regraLinha: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  regraTexto: { fontSize: 12.5, color: LC.textMuted },
  regraOk: { color: LC.successFg, fontWeight: '600' },
  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 18 },

  fab: {
    position: 'absolute', right: 20, bottom: 96, width: 56, height: 56, borderRadius: 28,
    backgroundColor: LC.primary, alignItems: 'center', justifyContent: 'center',
    ...LC.shadowStrong,
  },
});
