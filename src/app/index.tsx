import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LC } from '../constants/theme';
import { Assets } from '../constants/assets';
import { Button } from '../components/ui/button';
import { Input, PasswordToggle } from '../components/ui/input';
import { Icon } from '../components/ui/icon';
import { InfoModal } from '../components/ui/modal';
import { useLogin } from '../services/auth/auth.mutations';
import { ApiError } from '../services/http';

const ehEmailOuCpf = (v: string) => {
  const t = v.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return true; // e-mail
  return t.replace(/\D/g, '').length === 11 && !t.includes('@'); // CPF (com ou sem máscara)
};

const schema = z.object({
  email: z.string().min(1, 'Informe seu e-mail ou CPF').refine(ehEmailOuCpf, 'Digite um e-mail válido ou um CPF com 11 dígitos'),
  senha: z.string().min(6, 'Mínimo de 6 caracteres'),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
  const [showSenha, setShowSenha] = useState(false);
  const [esqueceu, setEsqueceu] = useState(false);
  const login = useLogin();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', senha: '' },
  });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: (data) => {
        router.replace(data.tipoUsuario === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
      },
    });
  });

  const erroApi =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? 'Não foi possível entrar. Tente novamente.'
        : null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Hero */}
          <LinearGradient colors={LC.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <Image source={Assets.logoColor} style={s.logo} tintColor="#FFFFFF" resizeMode="contain" />
            <Text style={s.welcome}>Bem-vindo de volta!</Text>
            <Text style={s.welcomeSub}>Faça login para continuar</Text>
          </LinearGradient>

          {/* Card de formulário */}
          <View style={s.card}>
            {erroApi ? (
              <View style={s.errorBanner}>
                <Icon name="alert-circle" size={18} color={LC.danger} />
                <Text style={s.errorBannerText}>{erroApi}</Text>
              </View>
            ) : null}

            <View style={s.form}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="E-mail ou CPF"
                    placeholder="seu@email.com ou CPF"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                    leftIcon={<Icon name="mail-outline" size={18} color={LC.textMuted} />}
                  />
                )}
              />

              <Controller
                control={control}
                name="senha"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Senha"
                    placeholder="••••••••"
                    secureTextEntry={!showSenha}
                    autoCapitalize="none"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onSubmitEditing={onSubmit}
                    error={errors.senha?.message}
                    leftIcon={<Icon name="lock-closed-outline" size={18} color={LC.textMuted} />}
                    rightSlot={<PasswordToggle visible={showSenha} onToggle={() => setShowSenha((v) => !v)} />}
                  />
                )}
              />

              <Pressable style={s.forgot} onPress={() => setEsqueceu(true)}>
                <Text style={s.forgotText}>Esqueceu sua senha?</Text>
              </Pressable>

              <Button title="Entrar" size="lg" loading={login.isPending} onPress={onSubmit} />
            </View>

            <Pressable style={s.firstAccess} onPress={() => router.push('/primeiro-acesso')}>
              <Text style={s.firstAccessText}>
                Ainda não tem uma conta? <Text style={s.firstAccessLink}>Primeiro acesso</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <InfoModal
        visible={esqueceu}
        title="Esqueceu sua senha?"
        message="Entre em contato com a recepção do studio para redefinir sua senha."
        onClose={() => setEsqueceu(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    paddingTop: 96,
    paddingBottom: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 150, height: 92 },
  welcome: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12 },
  welcomeSub: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 },
  card: {
    flex: 1,
    backgroundColor: LC.bgCard,
    marginTop: -32,
    borderTopLeftRadius: LC.radius.xxl,
    borderTopRightRadius: LC.radius.xxl,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LC.dangerBg,
    borderRadius: LC.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorBannerText: { color: LC.danger, fontSize: 13, fontWeight: '500', flex: 1 },
  form: { gap: 16 },
  forgot: { alignSelf: 'flex-end', marginTop: -6 },
  forgotText: { color: LC.primary, fontSize: 13, fontWeight: '600' },
  firstAccess: { marginTop: 24, alignItems: 'center' },
  firstAccessText: { fontSize: 14, color: LC.textSecondary },
  firstAccessLink: { color: LC.primary, fontWeight: '700' },
});
