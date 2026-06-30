import { useState } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useAlunos } from '../../services/usuarios/usuarios.queries';
import { useGerarLink } from '../../services/usuarios/usuarios.mutations';
import { ApiError } from '../../services/http';

export default function AdminAlunos() {
  const [busca, setBusca] = useState('');
  const alunos = useAlunos(busca.trim() || undefined);
  const gerarLink = useGerarLink();

  const handleGerarLink = (id: string) => {
    gerarLink.mutate(id, {
      onSuccess: (data) =>
        Alert.alert('Link de primeiro acesso', data.link, [
          { text: 'Fechar', style: 'cancel' },
        ]),
      onError: (e) => Alert.alert('Erro', e instanceof ApiError ? e.message : 'Tente novamente.'),
    });
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
                      {plano?.modalidade || plano?.plano ? (
                        <Text style={s.plano}>
                          {plano?.modalidade?.nome}{plano?.plano ? ` • ${plano.plano.nome}` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <Badge label={aluno.ativo ? 'Ativo' : 'Inativo'} variant={aluno.ativo ? 'success' : 'danger'} />
                  </View>
                  {!aluno.ativo ? (
                    <Button
                      title="Gerar link de acesso"
                      variant="outline"
                      size="sm"
                      onPress={() => handleGerarLink(aluno.id)}
                      loading={gerarLink.isPending && gerarLink.variables === aluno.id}
                      leftIcon={<Icon name="link-outline" size={16} color={LC.primary} />}
                      style={s.linkBtn}
                    />
                  ) : null}
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
  linkBtn: { marginTop: 12 },
  fab: {
    position: 'absolute', right: 20, bottom: 92, width: 56, height: 56, borderRadius: 28,
    backgroundColor: LC.primary, alignItems: 'center', justifyContent: 'center', ...LC.shadowStrong,
  },
});
