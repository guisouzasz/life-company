import { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { LC } from '../../constants/theme';
import { nomeModalidade } from '../../constants/assets';
import { TabBar } from '../../components/tab-bar';
import { Avatar } from '../../components/ui/avatar';
import { Card } from '../../components/ui/card';
import { Icon, type IconName } from '../../components/ui/icon';
import { ConfirmModal, InfoModal } from '../../components/ui/modal';
import { useMe } from '../../services/auth/auth.queries';
import { useLogout, useExcluirConta } from '../../services/auth/auth.mutations';
import { ApiError } from '../../services/http';

/** Perfil do professor: dados básicos e sair. */
export default function ProfessorPerfil() {
  const nome = useAuthStore((s) => s.nome);
  const me = useMe();
  const logout = useLogout();
  const excluir = useExcluirConta();
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  const modalidade = me.data?.modalidadeProfessor?.nome;

  const excluirConta = () => {
    excluir.mutate(undefined, {
      onError: (e) => {
        setConfirmarExclusao(false);
        setErroExcluir(e instanceof ApiError ? e.message : 'Não foi possível excluir a conta.');
      },
    });
  };

  const menu: { label: string; icon: IconName; onPress: () => void }[] = [];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>Meu perfil</Text>
        </View>

        <View style={s.avatarSection}>
          <Avatar nome={nome} size={88} />
          <Text style={s.nome}>{nome}</Text>
          {/* A modalidade não é enfeite: ela decide a agenda que ele vê e o
              formato da ficha de treino. Ficava invisível para todo mundo —
              quando vinha errada, o sintoma aparecia lá no treino e ninguém
              tinha como ligar uma coisa na outra. */}
          <View style={s.tag}>
            <Icon name="school-outline" size={13} color={LC.primary} />
            <Text style={s.tagText}>
              {modalidade ? `Professor de ${nomeModalidade(modalidade)}` : 'Professor'}
            </Text>
          </View>
          {me.isSuccess && !modalidade ? (
            <Text style={s.semModalidade}>
              Sem modalidade definida. Peça à administração para ajustar em Alunos → Professores.
            </Text>
          ) : null}
          {me.data?.email ? <Text style={s.email}>{me.data.email}</Text> : null}
        </View>

        {menu.length > 0 ? (
        <Card style={s.card} padding={4}>
          {menu.map((item, i) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [s.menuRow, i < menu.length - 1 && s.rowBorder, pressed && s.pressed]}
              onPress={item.onPress}
            >
              <View style={s.menuIcon}>
                <Icon name={item.icon} size={18} color={LC.primary} />
              </View>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Icon name="chevron-forward" size={18} color={LC.textMuted} />
            </Pressable>
          ))}
        </Card>
        ) : null}

        {/*
          Trocar a senha vem ANTES de sair e de excluir: é a ação que a pessoa
          procura quando desconfia de alguém, e ficar no meio das duas
          destrutivas convidava ao toque errado.
        */}
        <Pressable
          style={({ pressed }) => [s.logout, s.trocarSenha, pressed && s.pressed]}
          onPress={() => router.push('/alterar-senha' as any)}
        >
          <Icon name="key-outline" size={20} color={LC.primary} />
          <Text style={[s.logoutText, { color: LC.primary }]}>Alterar minha senha</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [s.logout, pressed && s.pressed]} onPress={() => setConfirmarSaida(true)}>
          <Icon name="log-out-outline" size={20} color={LC.danger} />
          <Text style={s.logoutText}>Sair da conta</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [s.excluir, pressed && s.pressed]} onPress={() => setConfirmarExclusao(true)}>
          <Text style={s.excluirText}>Excluir minha conta</Text>
        </Pressable>
      </ScrollView>
      <TabBar isProfessor />

      <ConfirmModal
        visible={confirmarSaida}
        title="Sair da conta"
        message="Deseja realmente sair?"
        confirmLabel="Sair"
        destructive
        loading={logout.isPending}
        onConfirm={() => logout.mutate()}
        onCancel={() => setConfirmarSaida(false)}
      />
      <ConfirmModal
        visible={confirmarExclusao}
        title="Excluir minha conta"
        message="Esta ação é permanente. Seus dados pessoais (nome, CPF, e-mail, telefone) serão removidos e você perderá o acesso ao app. Deseja continuar?"
        confirmLabel="Excluir conta"
        cancelLabel="Cancelar"
        destructive
        loading={excluir.isPending}
        onConfirm={excluirConta}
        onCancel={() => setConfirmarExclusao(false)}
      />
      <InfoModal
        visible={!!erroExcluir}
        title="Não foi possível excluir"
        message={erroExcluir ?? ''}
        onClose={() => setErroExcluir(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  scroll: { ...LC.coluna, paddingBottom: 20 },
  header: { ...LC.coluna, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  nome: { fontSize: 19, fontWeight: '800', color: LC.textPrimary, marginTop: 12 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
    backgroundColor: LC.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: LC.radius.full,
  },
  tagText: { fontSize: 12, fontWeight: '700', color: LC.primary },
  email: { fontSize: 13, color: LC.textSecondary, marginTop: 6 },
  semModalidade: {
    fontSize: 12, color: LC.warningFg, marginTop: 8, textAlign: 'center',
    paddingHorizontal: 24, lineHeight: 17,
  },
  card: { marginHorizontal: 16, marginBottom: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: LC.border },
  menuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: LC.primaryLight, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: LC.textPrimary },
  logout: {
    marginHorizontal: 16, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: LC.radius.lg, backgroundColor: LC.dangerBg,
  },
  trocarSenha: { borderColor: LC.primaryLight, backgroundColor: LC.primaryLight, marginBottom: 12 },
  logoutText: { fontSize: 15, fontWeight: '700', color: LC.danger },
  excluir: { marginHorizontal: 16, marginTop: 14, alignItems: 'center', paddingVertical: 8 },
  excluirText: { fontSize: 13, fontWeight: '600', color: LC.textMuted, textDecorationLine: 'underline' },
  pressed: { opacity: 0.7 },
});
