import { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Avatar } from '../../components/ui/avatar';
import { Loading, EmptyState, ErrorState } from '../../components/ui/states';
import { useAlunos } from '../../services/usuarios/usuarios.queries';

/** Professor escolhe o aluno para ver/montar treinos. */
export default function ProfessorTreinos() {
  const [busca, setBusca] = useState('');
  const alunos = useAlunos(busca.trim() || undefined);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
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
      <TabBar isProfessor />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  buscaWrap: { paddingHorizontal: 16, paddingBottom: 6 },
  scroll: { padding: 16, paddingTop: 8 },
  pressed: { opacity: 0.85 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  nome: { fontSize: 15, fontWeight: '700', color: LC.textPrimary },
  plano: { fontSize: 12, color: LC.textSecondary, marginTop: 2 },
});
