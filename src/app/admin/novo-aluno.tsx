import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { iconePorModalidade } from '../../constants/assets';
import { Header } from '../../components/ui/header';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { usePlanos } from '../../services/planos/planos.queries';
import { useModalidades } from '../../services/modalidades/modalidades.queries';
import { useCriarAluno } from '../../services/usuarios/usuarios.mutations';
import { ApiError } from '../../services/http';

function formatCpf(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export default function NovoAluno() {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [planoId, setPlanoId] = useState('');
  const [modalidadeId, setModalidadeId] = useState('');

  const planos = usePlanos();
  const modalidades = useModalidades();
  const criar = useCriarAluno();

  const submit = () => {
    if (!nome.trim() || cpf.replace(/\D/g, '').length !== 11 || !email.trim() || !planoId || !modalidadeId) {
      Alert.alert('Campos obrigatórios', 'Preencha nome, CPF (11 dígitos), e-mail, plano e modalidade.');
      return;
    }
    criar.mutate(
      { nome: nome.trim(), cpf: cpf.replace(/\D/g, ''), email: email.trim(), telefone: telefone.trim() || undefined, planoId, modalidadeId },
      {
        onSuccess: (data) =>
          Alert.alert('Aluno criado!', `Link de primeiro acesso:\n\n${data.linkAcesso}`, [
            { text: 'OK', onPress: () => router.back() },
          ]),
        onError: (e) => Alert.alert('Erro ao criar aluno', e instanceof ApiError ? e.message : 'Tente novamente.'),
      },
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <Header title="Novo aluno" showBack />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Dados pessoais */}
          <Card style={s.section} padding={16}>
            <Text style={s.sectionTitle}>Dados pessoais</Text>
            <View style={s.fields}>
              <Input label="Nome completo *" placeholder="Nome do aluno" value={nome} onChangeText={setNome} autoCapitalize="words" />
              <Input label="CPF *" placeholder="000.000.000-00" value={cpf} onChangeText={(t) => setCpf(formatCpf(t))} keyboardType="numeric" />
              <Input label="E-mail *" placeholder="email@exemplo.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <Input label="Telefone" placeholder="(00) 00000-0000" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />
            </View>
          </Card>

          {/* Plano */}
          <Card style={s.section} padding={16}>
            <Text style={s.sectionTitle}>Plano *</Text>
            <View style={s.chips}>
              {planos.data?.map((p) => {
                const sel = planoId === p.id;
                return (
                  <Pressable key={p.id} style={[s.chip, sel && s.chipSel]} onPress={() => setPlanoId(p.id)}>
                    <Text style={[s.chipText, sel && s.chipTextSel]}>{p.nome}</Text>
                    {sel ? <Icon name="checkmark" size={14} color={LC.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* Modalidade */}
          <Card style={s.section} padding={16}>
            <Text style={s.sectionTitle}>Modalidade *</Text>
            <View style={s.modGrid}>
              {modalidades.data?.map((m) => {
                const sel = modalidadeId === m.id;
                return (
                  <Pressable key={m.id} style={[s.modCard, sel && s.modCardSel]} onPress={() => setModalidadeId(m.id)}>
                    <Icon name={iconePorModalidade(m.nome)} size={24} color={sel ? LC.primary : LC.textSecondary} />
                    <Text style={[s.modNome, sel && s.modNomeSel]}>{m.nome}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Button title="Criar aluno e gerar link" size="lg" loading={criar.isPending} onPress={submit} style={s.submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: LC.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  fields: { gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: LC.radius.full, backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border },
  chipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  chipTextSel: { color: LC.primary },
  modGrid: { flexDirection: 'row', gap: 10 },
  modCard: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: LC.radius.lg, backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border },
  modCardSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  modNome: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  modNomeSel: { color: LC.primary, fontWeight: '700' },
  submit: { marginTop: 4 },
});
