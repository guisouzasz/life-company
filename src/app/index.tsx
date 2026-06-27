import { useState } from 'react';
import { router } from 'expo-router';
import {
  Image, StyleSheet, Text, TextInput, TouchableOpacity,
  View, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar,
} from 'react-native';
import { api, ApiError } from '../services/api';
import { useAuthStore } from '../store/auth';
import { LC } from '../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const setTokens = useAuthStore(s => s.setTokens);

  const handleLogin = async () => {
    if (!email.trim() || !senha.trim()) { Alert.alert('Atenção', 'Preencha e-mail e senha'); return; }
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email: email.trim(), senha });
      await setTokens(data);
      router.replace(data.tipoUsuario === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro de conexão. Verifique se o servidor está rodando.';
      Alert.alert('Erro ao entrar', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={LC.bgDark} />
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

        {/* Fundo escuro com logo */}
        <View style={s.hero}>
          <Image source={require('../../assets/images/logo-life.jpg')} style={s.logo} />
          <Text style={s.heroTitle}>Bem-vindo de volta!</Text>
          <Text style={s.heroSub}>Faça login para continuar</Text>
        </View>

        {/* Card de formulário */}
        <View style={s.card}>
          <Text style={s.inputLabel}>E-mail ou CPF</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input} placeholder="Digite seu e-mail" placeholderTextColor={LC.textMuted}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              value={email} onChangeText={setEmail}
            />
          </View>

          <Text style={s.inputLabel}>Senha</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={[s.input, { flex: 1 }]} placeholder="Digite sua senha" placeholderTextColor={LC.textMuted}
              secureTextEntry={!showSenha} value={senha} onChangeText={setSenha} onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowSenha(v => !v)} style={s.eyeBtn}>
              <Text style={s.eyeIcon}>{showSenha ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => {}}>
            <Text style={s.forgotText}>Esqueceu sua senha?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.75 }]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Entrar</Text>}
          </TouchableOpacity>

          <View style={s.divider}><View style={s.dividerLine} /><Text style={s.dividerText}>ou</Text><View style={s.dividerLine} /></View>

          <Text style={s.noAccountText}>Ainda não tem uma conta?</Text>
          <TouchableOpacity onPress={() => router.push('/primeiro-acesso')}>
            <Text style={s.firstAccessLink}>Primeiro acesso</Text>
          </TouchableOpacity>

          {/* Dica de dev */}
          <View style={s.devHint}>
            <Text style={s.devText}>🛠 Admin: admin@studio.com / admin123</Text>
            <Text style={s.devText}>🏃 Aluno: maria@email.com / aluno123</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  // ── Scroll / fundo ───────────────────────────────────────────────
  container: {
    flexGrow: 1,
    backgroundColor: LC.bgDark,
  },

  // ── Hero (área escura com logo) ──────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 40,
    paddingHorizontal: 32,
  },
  logo: {
    width: 160,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: LC.textWhite,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.60)',
    letterSpacing: 0.1,
  },

  // ── Card branco com formulário ────────────────────────────────────
  card: {
    backgroundColor: LC.bgCard,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 48,
    flex: 1,
    // sombra sutil no topo do card
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },

  // ── Labels e inputs ──────────────────────────────────────────────
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: LC.textSecondary,
    marginBottom: 8,
    marginTop: 20,
    letterSpacing: 0.1,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LC.bg,
    borderWidth: 1.5,
    borderColor: LC.border,
    borderRadius: LC.radius.lg,
    // foco visual ao digitar vem do borderColor
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 15,
    color: LC.textPrimary,
    letterSpacing: 0.1,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  eyeIcon: {
    fontSize: 17,
  },

  // ── Esqueceu senha ───────────────────────────────────────────────
  forgotText: {
    color: LC.primary,
    fontWeight: '600',
    fontSize: 13,
    marginTop: 12,
    letterSpacing: 0.1,
  },

  // ── Botão principal ──────────────────────────────────────────────
  btn: {
    backgroundColor: LC.primary,
    borderRadius: LC.radius.lg,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 24,
    // sombra verde sutil
    shadowColor: LC.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 4,
  },
  btnText: {
    color: LC.textWhite,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.4,
  },

  // ── Divisor ──────────────────────────────────────────────────────
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: LC.border,
  },
  dividerText: {
    color: LC.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Primeiro acesso ──────────────────────────────────────────────
  noAccountText: {
    textAlign: 'center',
    color: LC.textMuted,
    fontSize: 14,
    letterSpacing: 0.1,
  },
  firstAccessLink: {
    textAlign: 'center',
    color: LC.primary,
    fontWeight: '700',
    fontSize: 14,
    marginTop: 6,
    letterSpacing: 0.1,
  },

  // ── Dev hint ─────────────────────────────────────────────────────
  devHint: {
    marginTop: 32,
    padding: 14,
    backgroundColor: LC.bg,
    borderRadius: LC.radius.lg,
    borderWidth: 1,
    borderColor: LC.border,
  },
  devText: {
    fontSize: 11,
    color: LC.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
});
