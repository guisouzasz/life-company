import { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { AppModal } from '../../components/ui/modal';
import { CreditosAlunoModal } from '../../components/admin/creditos-aluno-modal';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useAlunos } from '../../services/usuarios/usuarios.queries';
import { useGerarLink, useAtualizarAluno } from '../../services/usuarios/usuarios.mutations';
import type { AlunoAdmin } from '../../services/usuarios/usuarios.admin.types';
import { ApiError } from '../../services/http';

export default function AdminAlunos() {
  const [busca, setBusca] = useState('');
  const alunos = useAlunos(busca.trim() || undefined);
  const gerarLink = useGerarLink();
  const atualizar = useAtualizarAluno();

  // Modal de link gerado
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Modal de créditos
  const [creditosAluno, setCreditosAluno] = useState<AlunoAdmin | null>(null);

  // Modal de edição
  const [editando, setEditando] = useState<AlunoAdmin | null>(null);
  const [form, setForm] = useState({ nome: '', email: '', telefone: '' });
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  const abrirEdicao = (aluno: AlunoAdmin) => {
    setEditando(aluno);
    setErroEdicao(null);
    setForm({ nome: aluno.nome, email: aluno.email, telefone: aluno.telefone ?? '' });
  };

  const salvarEdicao = () => {
    if (!editando) return;
    if (!form.nome.trim() || !form.email.trim()) {
      setErroEdicao('Nome e e-mail são obrigatórios.');
      return;
    }
    atualizar.mutate(
      { id: editando.id, payload: { nome: form.nome.trim(), email: form.email.trim(), telefone: form.telefone.trim() || undefined } },
      {
        onSuccess: () => setEditando(null),
        onError: (e) => setErroEdicao(e instanceof ApiError ? e.message : 'Não foi possível salvar.'),
      },
    );
  };

  const gerar = (id: string) => {
    gerarLink.mutate(id, {
      onSuccess: (data) => {
        setCopiado(false);
        setLink(data.link);
      },
      onError: (e) => {
        setCopiado(false);
        setLink(`Erro: ${e instanceof ApiError ? e.message : 'tente novamente.'}`);
      },
    });
  };

  const copiar = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopiado(true);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.title}>Alunos</Text>
        <Text style={s.subtitle}>{alunos.data?.length ?? 0} cadastrados</Text>
      </View>

      <View style={s.searchWrap}>
        <Input
          placeholder="Buscar por nome, CPF ou e-mail"
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
            alunos.data.map((aluno) => {
              const plano = aluno.usuarioPlanos?.[0];
              return (
                <Card key={aluno.id} style={s.card} padding={14}>
                  <View style={s.cardTop}>
                    <Avatar nome={aluno.nome} size={46} />
                    <View style={s.cardInfo}>
                      <Text style={s.nome}>{aluno.nome}</Text>
                      <Text style={s.email} numberOfLines={1}>{aluno.email}</Text>
                      {plano?.plano ? <Text style={s.plano}>{plano.plano.nome}</Text> : null}
                    </View>
                    <Badge label={aluno.ativo ? 'Ativo' : 'Inativo'} variant={aluno.ativo ? 'success' : 'danger'} />
                  </View>
                  <View style={s.actions}>
                    <Button
                      title="Editar"
                      variant="outline"
                      size="sm"
                      onPress={() => abrirEdicao(aluno)}
                      leftIcon={<Icon name="create-outline" size={16} color={LC.primary} />}
                      style={s.actionBtn}
                    />
                    <Button
                      title="Gerar link"
                      size="sm"
                      onPress={() => gerar(aluno.id)}
                      loading={gerarLink.isPending && gerarLink.variables === aluno.id}
                      leftIcon={<Icon name="link-outline" size={16} color="#fff" />}
                      style={s.actionBtn}
                    />
                  </View>
                  <Pressable style={s.credLink} onPress={() => setCreditosAluno(aluno)}>
                    <Icon name="ticket-outline" size={16} color={LC.primary} />
                    <Text style={s.credLinkText}>Gerenciar créditos de reposição</Text>
                  </Pressable>
                </Card>
              );
            })
          ) : (
            <EmptyState icon="people-outline" title="Nenhum aluno encontrado" description={busca ? 'Tente outra busca.' : 'Cadastre o primeiro aluno.'} />
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      <Pressable style={s.fab} onPress={() => router.push('/admin/novo-aluno')}>
        <Icon name="add" size={28} color="#fff" />
      </Pressable>
      <TabBar isAdmin />

      {/* Modal: link de primeiro acesso */}
      <AppModal visible={!!link} onClose={() => setLink(null)} title="Link de primeiro acesso">
        <Text style={s.modalHint}>Envie este link ao aluno para ele criar a senha:</Text>
        <View style={s.linkBox}>
          <Text style={s.linkText} selectable>{link}</Text>
        </View>
        <View style={s.modalActions}>
          <Button title="Fechar" variant="outline" onPress={() => setLink(null)} style={{ flex: 1 }} />
          <Button
            title={copiado ? 'Copiado!' : 'Copiar'}
            onPress={copiar}
            leftIcon={<Icon name={copiado ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />}
            style={{ flex: 1 }}
          />
        </View>
      </AppModal>

      {/* Modal: editar aluno */}
      <AppModal visible={!!editando} onClose={() => setEditando(null)} title="Editar aluno">
        <View style={s.editForm}>
          <Input label="Nome" value={form.nome} onChangeText={(t) => setForm((f) => ({ ...f, nome: t }))} autoCapitalize="words" />
          <Input label="E-mail" value={form.email} onChangeText={(t) => setForm((f) => ({ ...f, email: t }))} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Telefone" value={form.telefone} onChangeText={(t) => setForm((f) => ({ ...f, telefone: t }))} keyboardType="phone-pad" />
          {erroEdicao ? <Text style={s.erro}>{erroEdicao}</Text> : null}
        </View>
        <View style={s.modalActions}>
          <Button title="Cancelar" variant="outline" onPress={() => setEditando(null)} style={{ flex: 1 }} />
          <Button title="Salvar" loading={atualizar.isPending} onPress={salvarEdicao} style={{ flex: 1 }} />
        </View>
      </AppModal>

      {/* Modal: créditos do aluno */}
      <CreditosAlunoModal aluno={creditosAluno} onClose={() => setCreditosAluno(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  scroll: { paddingHorizontal: 16, paddingBottom: 16 },
  card: { marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardInfo: { flex: 1 },
  nome: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  email: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
  plano: { fontSize: 11, color: LC.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1 },
  credLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 6 },
  credLinkText: { fontSize: 13, fontWeight: '600', color: LC.primary },
  fab: {
    position: 'absolute', right: 20, bottom: 92, width: 56, height: 56, borderRadius: 28,
    backgroundColor: LC.primary, alignItems: 'center', justifyContent: 'center', ...LC.shadowStrong,
  },
  modalHint: { fontSize: 13, color: LC.textSecondary, marginBottom: 10 },
  linkBox: { backgroundColor: LC.bg, borderWidth: 1, borderColor: LC.border, borderRadius: LC.radius.md, padding: 12, marginBottom: 16 },
  linkText: { fontSize: 13, color: LC.textPrimary },
  modalActions: { flexDirection: 'row', gap: 10 },
  editForm: { gap: 14, marginBottom: 18 },
  erro: { fontSize: 13, color: LC.danger },
});
