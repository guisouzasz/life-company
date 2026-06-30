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
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LC } from '../constants/theme';
import { Button } from '../components/ui/button';
import { Input, PasswordToggle } from '../components/ui/input';
import { Icon } from '../components/ui/icon';
import { usePrimeiroAcesso } from '../services/auth/auth.mutations';
import { ApiError } from '../services/http';

const RULES = [
  { label: 'Mínimo de 6 caracteres', test: (v: string) => v.length >= 6 },
  { label: 'Letras e números', test: (v: string) => /[a-zA-Z]/.test(v) && /\d/.test(v) },
  { label: 'Pelo menos uma maiúscula', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Pelo menos um número', test: (v: string) => /\d/.test(v) },
];

const schema = z
  .object({
    token: z.string().min(1, 'Token do link é obrigatório'),
    cpf: z
      .string()
      .transform((v) => v.replace(/\D/g, ''))
      .refine((v) => v.length === 11, 'CPF deve ter 11 dígitos'),
    senha: z.string().refine((v) => RULES.every((r) => r.test(v)), 'A senha não cumpre os requisitos'),
    confirmar: z.string(),
  })
  .refine((d) => d.senha === d.confirmar, {
    path: ['confirmar'],
    message: 'As senhas não conferem',
  });

type FormData = z.input<typeof schema>;

function formatCpf(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export default function PrimeiroAcesso() {
  const params = useLocalSearchParams<{ token?: string }>();
  const tokenFromLink = typeof params.token === 'string' ? params.token : '';
  const [showSenha, setShowSenha] = useState(false);
  const primeiroAcesso = usePrimeiroAcesso();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { token: tokenFromLink, cpf: '', senha: '', confirmar: '' },
  });

  const senhaAtual = watch('senha') ?? '';

  const onSubmit = handleSubmit((values) => {
    primeiroAcesso.mutate(
      { token: values.token, cpf: values.cpf.replace(/\D/g, ''), senha: values.senha },
      { onSuccess: (data) => router.replace(data.tipoUsuario === 'ADMIN' ? '/admin/dashboard' : '/dashboard') },
    );
  });

  const erroApi = primeiroAcesso.error instanceof ApiError ? primeiroAcesso.error.message : null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable style={s.back} onPress={() => router.back()} hitSlop={10}>
            <Icon name="chevron-back" size={26} color={LC.textPrimary} />
          </Pressable>

          <View style={s.header}>
            <View style={s.shield}>
              <Icon name="shield-checkmark" size={36} color="#fff" />
            </View>
            <Text style={s.title}>Primeiro acesso</Text>
            <Text style={s.subtitle}>Para sua segurança, crie uma nova senha.</Text>
          </View>

          {erroApi ? (
            <View style={s.errorBanner}>
              <Icon name="alert-circle" size={18} color={LC.danger} />
              <Text style={s.errorText}>{erroApi}</Text>
            </View>
          ) : null}

          <View style={s.form}>
            {!tokenFromLink ? (
              <Controller
                control={control}
                name="token"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Token do link"
                    placeholder="Cole o token recebido"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.token?.message}
                    leftIcon={<Icon name="key-outline" size={18} color={LC.textMuted} />}
                  />
                )}
              />
            ) : null}

            <Controller
              control={control}
              name="cpf"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="CPF"
                  placeholder="000.000.000-00"
                  keyboardType="numeric"
                  value={value}
                  onChangeText={(t) => onChange(formatCpf(t))}
                  onBlur={onBlur}
                  error={errors.cpf?.message}
                  leftIcon={<Icon name="person-outline" size={18} color={LC.textMuted} />}
                />
              )}
            />

            <Controller
              control={control}
              name="senha"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nova senha"
                  placeholder="Crie uma senha segura"
                  secureTextEntry={!showSenha}
                  autoCapitalize="none"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.senha?.message}
                  leftIcon={<Icon name="lock-closed-outline" size={18} color={LC.textMuted} />}
                  rightSlot={<PasswordToggle visible={showSenha} onToggle={() => setShowSenha((v) => !v)} />}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmar"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirmar nova senha"
                  placeholder="Repita a senha"
                  secureTextEntry={!showSenha}
                  autoCapitalize="none"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={onSubmit}
                  error={errors.confirmar?.message}
                  leftIcon={<Icon name="lock-closed-outline" size={18} color={LC.textMuted} />}
                />
              )}
            />

            {/* Checklist de requisitos */}
            <View style={s.rules}>
              <Text style={s.rulesTitle}>A senha deve conter:</Text>
              {RULES.map((r) => {
                const ok = senhaAtual.length > 0 && r.test(senhaAtual);
                return (
                  <View key={r.label} style={s.ruleRow}>
                    <Icon
                      name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={ok ? LC.success : LC.textMuted}
                    />
                    <Text style={[s.ruleText, ok && s.ruleTextOk]}>{r.label}</Text>
                  </View>
                );
              })}
            </View>

            <Button title="Criar senha" size="lg" loading={primeiroAcesso.isPending} onPress={onSubmit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 32 },
  back: { width: 40, height: 40, justifyContent: 'center' },
  header: { alignItems: 'center', marginTop: 8, marginBottom: 24 },
  shield: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: LC.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...LC.shadowStrong,
  },
  title: { fontSize: 24, fontWeight: '800', color: LC.textPrimary, marginTop: 18 },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 6, textAlign: 'center' },
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
  errorText: { color: LC.danger, fontSize: 13, fontWeight: '500', flex: 1 },
  form: { gap: 16 },
  rules: { backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border, borderRadius: LC.radius.md, padding: 14, gap: 10 },
  rulesTitle: { fontSize: 13, fontWeight: '600', color: LC.textSecondary, marginBottom: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { fontSize: 13, color: LC.textMuted },
  ruleTextOk: { color: LC.textPrimary, fontWeight: '500' },
});
