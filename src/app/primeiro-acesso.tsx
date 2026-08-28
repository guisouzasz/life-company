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
import { erroDeEmail } from '../constants/app';
import { Button } from '../components/ui/button';
import { Input, PasswordToggle } from '../components/ui/input';
import { Icon } from '../components/ui/icon';
import { useAtivarConta, usePrimeiroAcesso } from '../services/auth/auth.mutations';
import { TermoModal } from '../components/termo-modal';
import { useTermo } from '../services/termos/termos.queries';
import { ApiError } from '../services/http';

const RULES = [
  { label: 'Mínimo de 6 caracteres', test: (v: string) => v.length >= 6 },
  { label: 'Letras e números', test: (v: string) => /[a-zA-Z]/.test(v) && /\d/.test(v) },
  { label: 'Pelo menos uma maiúscula', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Pelo menos um número', test: (v: string) => /\d/.test(v) },
];

/**
 * Dois modos de ativação:
 *  - com token (aluno chegou pelo link enviado pelo admin): CPF + senha;
 *  - sem token (aluno abriu "Primeiro acesso" no app): o CPF identifica o
 *    cadastro e o aluno escolhe o próprio e-mail (qualquer domínio serve).
 */
function makeSchema(comToken: boolean) {
  return z
    .object({
      email: comToken
        ? z.string().optional()
        : z
            .string()
            .email('Informe um e-mail válido')
            .superRefine((v, ctx) => {
              const erro = erroDeEmail(v);
              if (erro) ctx.addIssue({ code: z.ZodIssueCode.custom, message: erro });
            }),
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
}

type FormData = z.input<ReturnType<typeof makeSchema>>;

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
  const comToken = !!tokenFromLink;
  const [showSenha, setShowSenha] = useState(false);
  const primeiroAcesso = usePrimeiroAcesso();
  const ativarConta = useAtivarConta();
  const pendente = comToken ? primeiroAcesso.isPending : ativarConta.isPending;

  /**
   * Aceite do termo do estúdio.
   *
   * Guarda a VERSÃO aceita, não um booleano: é ela que vai no pedido e fica
   * gravada no cadastro, dizendo qual redação a pessoa leu. Se o estúdio
   * publicar um texto novo com a tela aberta, a API recusa a versão velha.
   */
  const termo = useTermo();
  const [termoAberto, setTermoAberto] = useState(false);
  const [versaoAceita, setVersaoAceita] = useState<string | null>(null);
  const [faltaAceitar, setFaltaAceitar] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(makeSchema(comToken)),
    defaultValues: { email: '', cpf: '', senha: '', confirmar: '' },
  });

  const senhaAtual = watch('senha') ?? '';

  // Aluno recém-ativado cai direto na ficha de saúde (é o "cadastro" dele);
  // o botão de voltar da ficha leva ao dashboard. Professor e admin vão direto.
  const irParaApp = (data: { tipoUsuario: string }) => {
    if (data.tipoUsuario === 'ADMIN') return router.replace('/admin/dashboard');
    if (data.tipoUsuario === 'PROFESSOR') return router.replace('/professor/agenda' as any);
    router.replace('/dashboard');
    router.push('/anamnese' as any);
  };

  const onSubmit = handleSubmit((values) => {
    // Sem aceite não conclui. A API recusa do mesmo jeito; aqui é só para o
    // aluno ver o motivo na hora, em vez de levar um erro do servidor.
    if (!versaoAceita) {
      setFaltaAceitar(true);
      return;
    }
    const cpf = values.cpf.replace(/\D/g, '');
    if (comToken) {
      primeiroAcesso.mutate(
        { token: tokenFromLink, cpf, senha: values.senha, termoVersao: versaoAceita },
        { onSuccess: irParaApp },
      );
    } else {
      ativarConta.mutate(
        { cpf, email: (values.email ?? '').trim(), senha: values.senha, termoVersao: versaoAceita },
        { onSuccess: irParaApp },
      );
    }
  });

  const erroMutation = comToken ? primeiroAcesso.error : ativarConta.error;
  const erroApi = erroMutation instanceof ApiError ? erroMutation.message : null;

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
            <Text style={s.subtitle}>
              {comToken
                ? 'Para sua segurança, crie uma nova senha.'
                : 'Informe seu CPF, cadastre seu e-mail e crie sua senha.'}
            </Text>
          </View>

          {erroApi ? (
            <View style={s.errorBanner}>
              <Icon name="alert-circle" size={18} color={LC.danger} />
              <Text style={s.errorText}>{erroApi}</Text>
            </View>
          ) : null}

          <View style={s.form}>
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

            {!comToken ? (
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Seu e-mail"
                    placeholder="seuemail@gmail.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                    leftIcon={<Icon name="mail-outline" size={18} color={LC.textMuted} />}
                  />
                )}
              />
            ) : null}

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

            {/* ── Termo do estúdio ─────────────────────────────────── */}
            <View style={[s.termoBox, faltaAceitar && !versaoAceita && s.termoBoxErro]}>
              <Pressable
                style={s.termoLinha}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!versaoAceita }}
                accessibilityLabel="Li e concordo com o Termo de Normas do estúdio"
                onPress={() => {
                  // Desmarcar é direto; marcar passa pela leitura do texto.
                  if (versaoAceita) return setVersaoAceita(null);
                  setTermoAberto(true);
                }}
              >
                <Icon
                  name={versaoAceita ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={versaoAceita ? LC.primary : LC.textMuted}
                />
                <Text style={s.termoTexto}>
                  Li e concordo com o{' '}
                  <Text style={s.termoLink} onPress={() => setTermoAberto(true)}>
                    Termo de Normas, Políticas de Agendamento e Pagamento
                  </Text>
                  .
                </Text>
              </Pressable>
              <Pressable onPress={() => setTermoAberto(true)} hitSlop={6}>
                <Text style={s.termoAbrir}>
                  {versaoAceita ? 'Reler o termo' : 'Abrir e ler o termo'}
                </Text>
              </Pressable>
              {faltaAceitar && !versaoAceita ? (
                <Text style={s.termoErro}>
                  É preciso aceitar o termo para concluir o primeiro acesso.
                </Text>
              ) : null}
              {termo.isError ? (
                <Text style={s.termoErro}>
                  Não consegui carregar o termo. Verifique a conexão e tente de novo.
                </Text>
              ) : null}
            </View>

            <Button title={comToken ? 'Criar senha' : 'Ativar conta'} size="lg" loading={pendente} onPress={onSubmit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <TermoModal
        visible={termoAberto}
        onFechar={() => setTermoAberto(false)}
        onAceitar={(versao) => {
          setVersaoAceita(versao);
          setFaltaAceitar(false);
          setTermoAberto(false);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  flex: { flex: 1 },
  // maxWidth centraliza a coluna no desktop em vez de esticar a tela toda.
  scroll: {
    flexGrow: 1, alignSelf: 'center', width: '100%', maxWidth: 480,
    paddingHorizontal: 24, paddingTop: 56, paddingBottom: 32,
  },
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
  termoBox: {
    backgroundColor: LC.bgCard, borderWidth: 1, borderColor: LC.border,
    borderRadius: LC.radius.md, padding: 14, gap: 8,
  },
  termoBoxErro: { borderColor: LC.danger, backgroundColor: LC.dangerBg },
  termoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  termoTexto: { flex: 1, fontSize: 13.5, color: LC.textSecondary, lineHeight: 20 },
  termoLink: { color: LC.primary, fontWeight: '700', textDecorationLine: 'underline' },
  termoAbrir: { fontSize: 13, fontWeight: '700', color: LC.primary, marginLeft: 32 },
  termoErro: { fontSize: 12.5, color: LC.danger, lineHeight: 18, marginLeft: 32 },
  rulesTitle: { fontSize: 13, fontWeight: '600', color: LC.textSecondary, marginBottom: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { fontSize: 13, color: LC.textMuted },
  ruleTextOk: { color: LC.textPrimary, fontWeight: '500' },
});
