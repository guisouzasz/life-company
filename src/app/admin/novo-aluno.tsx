import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { api, ApiError } from '../../services/api';
import { LC } from '../../constants/theme';
import { TabBar } from '../../components/tab-bar';

export default function NovoAluno() {
  const { accessToken } = useAuthStore();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [planos, setPlanos] = useState<any[]>([]);
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [planoSel, setPlanoSel] = useState('');
  const [modalSel, setModalSel] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCpf = (v: string) =>
    v.replace(/\D/g,'').slice(0,11)
      .replace(/(\d{3})(\d)/,'$1.$2')
      .replace(/(\d{3})(\d)/,'$1.$2')
      .replace(/(\d{3})(\d{1,2})$/,'$1-$2');

  useEffect(() => {
    Promise.all([
      api.get('/planos', accessToken!),
      api.get('/modalidades', accessToken!),
    ]).then(([p, m]) => { setPlanos(p); setModalidades(m); });
  }, []);

  const criar = async () => {
    if (!nome || !cpf || !email || !planoSel || !modalSel) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios'); return;
    }
    setLoading(true);
    try {
      const data = await api.post('/usuarios', {
        nome, cpf: cpf.replace(/\D/g,''), email, telefone, planoId: planoSel, modalidadeId: modalSel,
      }, accessToken!);
      Alert.alert('✅ Aluno criado!', `Link de primeiro acesso gerado:\n\n${data.linkAcesso}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erro', String(e instanceof ApiError ? e.message : e));
    } finally { setLoading(false); }
  };

  const fields = [
    { label: 'Nome completo *', value: nome, setter: setNome, kb: 'default' as const, auto: 'words' as const },
    { label: 'CPF *', value: cpf, setter: (t: string) => setCpf(formatCpf(t)), kb: 'numeric' as const, auto: 'none' as const },
    { label: 'E-mail *', value: email, setter: setEmail, kb: 'email-address' as const, auto: 'none' as const },
    { label: 'Telefone', value: telefone, setter: setTelefone, kb: 'phone-pad' as const, auto: 'none' as const },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>‹</Text></TouchableOpacity>
            <Text style={s.titulo}>Novo aluno</Text>
          </View>

          <View style={s.form}>
            {/* Dados pessoais */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Dados pessoais</Text>
              {fields.map(f => (
                <View key={f.label} style={s.fieldWrap}>
                  <Text style={s.label}>{f.label}</Text>
                  <TextInput
                    style={s.input}
                    value={f.value}
                    onChangeText={f.setter}
                    keyboardType={f.kb}
                    autoCapitalize={f.auto}
                    placeholderTextColor={LC.textMuted}
                    placeholder={f.label.replace(' *','')}
                  />
                </View>
              ))}
            </View>

            {/* Plano */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Plano *</Text>
              <View style={s.chips}>
                {planos.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.chip, planoSel === p.id && s.chipSel]}
                    onPress={() => setPlanoSel(p.id)}
                  >
                    <Text style={[s.chipText, planoSel === p.id && s.chipTextSel]}>{p.nome}</Text>
                    {planoSel === p.id && <Text style={s.chipCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Modalidade */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Modalidade *</Text>
              <View style={s.modGrid}>
                {modalidades.map(m => {
                  const icon = m.nome === 'Funcional' ? '🤸' : m.nome === 'Pilates' ? '🧘' : '🏋️';
                  const sel = modalSel === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.modCard, sel && s.modCardSel]}
                      onPress={() => setModalSel(m.id)}
                    >
                      <Text style={s.modIcon}>{icon}</Text>
                      <Text style={[s.modNome, sel && { color: LC.primary, fontWeight: '700' }]}>{m.nome}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.75 }]}
              onPress={criar}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Criar aluno e gerar link</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <TabBar isAdmin />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20 },
  back: { fontSize: 28, color: LC.textPrimary },
  titulo: { fontSize: 22, fontWeight: '700', color: LC.textPrimary },
  form: { paddingHorizontal: 16 },
  section: { backgroundColor: LC.bgCard, borderRadius: LC.radius.lg, padding: 16, marginBottom: 12, ...LC.shadow },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: LC.textPrimary, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldWrap: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: LC.textSecondary, marginBottom: 6 },
  input: { backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border, borderRadius: LC.radius.md, padding: 13, fontSize: 15, color: LC.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: LC.radius.full, backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border },
  chipSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  chipTextSel: { color: LC.primary },
  chipCheck: { fontSize: 12, color: LC.primary, fontWeight: '700' },
  modGrid: { flexDirection: 'row', gap: 10 },
  modCard: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: LC.radius.lg, backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border },
  modCardSel: { backgroundColor: LC.primaryLight, borderColor: LC.primary },
  modIcon: { fontSize: 26, marginBottom: 6 },
  modNome: { fontSize: 13, fontWeight: '600', color: LC.textSecondary },
  btn: { backgroundColor: LC.primary, borderRadius: LC.radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 4, marginBottom: 20 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
