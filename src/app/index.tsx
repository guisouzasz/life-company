import { useState } from 'react';
import {
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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LC } from '../constants/theme';
import { Button } from '../components/ui/button';
import { Input, PasswordToggle } from '../components/ui/input';
import { useLogin } from '../services/auth/auth.mutations';
import { ApiError } from '../services/http';

const schema = z.object({
  email: z.string().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  senha: z.string().min(6, 'Mínimo de 6 caracteres'),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
  const [showSenha, setShowSenha] = useState(false);
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
        if (data.tipoUsuario === 'ADMIN') router.replace('/admin/dashboard');
        else router.replace('/dashboard');
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
      <StatusBar barStyle="light-content" backgroundColor={LC.bgDark} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero / marca */}
          <View style={s.hero}>
            <View style={s.logoBadge}>
              <Text style={s.logoText}>LC</Text>
            </View>
            <Text style={s.brand}>Life Company</Text>
            <Text style={s.tagline}>Seu treino, no seu ritmo.</Text>
          </View>

          {/* Card de login */}
          <View style={s.card}>
            <Text style={s.title}>Entrar</Text>
            <Text style={s.subtitle}>Acesse sua conta para continuar</Text>

            {erroApi ? (
              <View style={s.errorBanner}>
                <Text style={s.errorBannerText}>{erroApi}</Text>
              </View>
            ) : null}

            <View style={s.form}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="E-mail"
                    placeholder="seu@email.com"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                    leftIcon={<Text style={s.fieldIcon}>✉️</Text>}
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
                    leftIcon={<Text style={s.fieldIcon}>🔒</Text>}
                    rightSlot={
                      <PasswordToggle
                        visible={showSenha}
                        onToggle={() => setShowSenha((v) => !v)}
                      />
                    }
                  />
                )}
              />

              <Button
                title="Entrar"
                size="lg"
                loading={login.isPending}
                onPress={onSubmit}
                style={s.submit}
              />
            </View>

            <Pressable
              style={s.firstAccess}
              onPress={() => router.push('/primeiro-acesso')}
            >
              <Text style={s.firstAccessText}>
                Primeiro acesso? <Text style={s.firstAccessLink}>Ative sua conta</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bgDark },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: 32 },
  hero: { alignItems: 'center', paddingTop: 64, paddingBottom: 32 },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: LC.radius.xl,
    backgroundColor: LC.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...LC.shadowStrong,
  },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  brand: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 16 },
  tagline: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: LC.bgCard,
    marginHorizontal: 20,
    borderRadius: LC.radius.xxl,
    padding: 24,
    ...LC.shadowStrong,
  },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 4, marginBottom: 20 },
  errorBanner: {
    backgroundColor: LC.dangerBg,
    borderRadius: LC.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorBannerText: { color: LC.danger, fontSize: 13, fontWeight: '500' },
  form: { gap: 16 },
  fieldIcon: { fontSize: 15 },
  submit: { marginTop: 4 },
  firstAccess: { marginTop: 20, alignItems: 'center' },
  firstAccessText: { fontSize: 14, color: LC.textSecondary },
  firstAccessLink: { color: LC.primary, fontWeight: '700' },
});
