import { useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { api, ApiError } from '../services/api';
import { useAuthStore } from '../store/auth';
import { LC } from '../constants/theme';

const rules = [
  { key: 'len',   label: 'Mínimo de 6 caracteres',   test: (v: string) => v.length >= 6 },
  { key: 'num',   label: 'Pelo menos um número',       test: (v: string) => /\d/.test(v) },
  { key: 'upper', label: 'Pelo menos uma maiúscula',   test: (v: string) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'Letra e números',            test: (v: string) => /[a-z]/.test(v) },
];

export default function PrimeiroAcesso() {
  const [token, setToken] = useState('');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const setTokens = useAuthStore(s => s.setTokens);

  const formatCpf = (v: string) =>
    v.replace(/\D/g,'').slice(0,11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');

  const ativar = async () => {
    if (!token.trim() || !cpf.trim() || !senha) { Alert.alert('Atenção', 'Preencha todos os campos'); return; }
    if (!rules.every(r => r.test(senha))) { Alert.alert('Senha fraca', 'Verifique os requisitos de senha'); return; }
    if (senha !== confirmar) { Alert.alert('Senhas diferentes', 'As senhas não conferem'); return; }
    setLoading(true);
    try {
      const data = await api.post('/auth/primeiro-acesso', { token: token.trim(), cpf: cpf.replace(/\D/g, ''), senha });
      await setTokens(data);
      router.replace('/dashboard');
    } catch (e) {
      Alert.alert('Erro', String(e instanceof ApiError ? e.message : e));
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={LC.bgDark} />
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.heroTitle}>Primeiro acesso</Text>
          <Text style={s.heroSub}>Para sua segurança, crie uma nova senha.</Text>
        </View>

        <View style={s.card}>
          <Text style={s.fieldLabel}>Token do link</Text>
          <TextInput style={s.input} placeholder="Cole o token recebido por e-mail" placeholderTextColor={LC.textMuted} value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />

          <Text style={s.fieldLabel}>CPF</Text>
          <TextInput style={s.input} placeholder="000.000.000-00" placeholderTextColor={LC.textMuted} value={cpf} onChangeText={t => setCpf(formatCpf(t))} keyboardType="numeric" />

          <Text style={s.fieldLabel}>Nova senha</Text>
          <View style={s.inputRow}>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Crie uma senha segura" placeholderTextColor={LC.textMuted} secureTextEntry={!showSenha} value={senha} onChangeText={setSenha} />
            <TouchableOpacity onPress={() => setShowSenha(v => !v)} style={s.eyeBtn}>
              <Text>{showSenha ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.fieldLabel}>Confirmar nova senha</Text>
          <TextInput style={s.input} placeholder="Repita a senha" placeholderTextColor={LC.textMuted} secureTextEntry={!showSenha} value={confirmar} onChangeText={setConfirmar} />

          {/* Checklist de requisitos */}
          <View style={s.rulesBox}>
            <Text style={s.rulesTitle}>A senha deve conter:</Text>
            {rules.map(r => {
              const ok = senha.length > 0 && r.test(senha);
              return (
                <View key={r.key} style={s.ruleRow}>
                  <View style={[s.ruleDot, ok && s.ruleDotOk]}>
                    {ok && <Text style={s.ruleDotCheck}>✓</Text>}
                  </View>
                  <Text style={[s.ruleText, ok && s.ruleTextOk]}>{r.label}</Text>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.75 }]} onPress={ativar} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Criar senha</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: LC.bgDark },
  hero: { paddingTop: 60, paddingBottom: 32, paddingHorizontal: 24 },
  backBtn: { marginBottom: 16 },
  backText: { color: LC.textWhite, fontSize: 28, lineHeight: 28 },
  heroTitle: { fontSize: 24, fontWeight: '700', color: LC.textWhite, marginBottom: 8 },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 22 },
  card: { backgroundColor: LC.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: LC.textSecondary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border, borderRadius: LC.radius.md, padding: 14, fontSize: 15, color: LC.textPrimary, marginBottom: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: LC.bg, borderWidth: 1.5, borderColor: LC.border, borderRadius: LC.radius.md, marginBottom: 2 },
  eyeBtn: { paddingHorizontal: 12 },
  rulesBox: { backgroundColor: LC.bg, borderRadius: LC.radius.md, padding: 14, marginTop: 14, gap: 8 },
  rulesTitle: { fontSize: 13, fontWeight: '600', color: LC.textSecondary, marginBottom: 4 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: LC.border, justifyContent: 'center', alignItems: 'center' },
  ruleDotOk: { backgroundColor: LC.primary, borderColor: LC.primary },
  ruleDotCheck: { color: '#fff', fontSize: 10, fontWeight: '700' },
  ruleText: { fontSize: 13, color: LC.textMuted },
  ruleTextOk: { color: LC.textPrimary },
  btn: { backgroundColor: LC.primary, borderRadius: LC.radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
