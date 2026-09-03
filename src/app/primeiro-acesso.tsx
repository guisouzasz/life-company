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
import { mascaraCep, mascaraData, mascaraTelefone, dataParaIso } from '../services/mascaras';
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
function makeSchema(redefinindo: boolean) {
  return z
    .object({
      /*
        O e-mail e a ficha valem para os DOIS caminhos, com link e sem link.
        O cadastro feito pela dona passou a pedir só nome e CPF — ela cadastra
        no balcão e não tem RG nem CEP do aluno à mão. Quem preenche é quem
        sabe, aqui.
      */
      email: redefinindo
        ? z.string().optional()
        : z
            .string()
            .email('Informe um e-mail válido')
            .superRefine((v, ctx) => {
              const erro = erroDeEmail(v);
              if (erro) ctx.addIssue({ code: z.ZodIssueCode.custom, message: erro });
            }),
      telefone: redefinindo
        ? z.string().optional()
        : z
            .string()
            .transform((v) => v.replace(/\D/g, ''))
            .refine((v) => v.length >= 10, 'Informe o telefone com DDD'),
      rg: redefinindo ? z.string().optional() : z.string().trim().min(5, 'Informe o RG'),
      endereco: redefinindo ? z.string().optional() : z.string().trim().min(5, 'Informe o endereço'),
      cep: redefinindo
        ? z.string().optional()
        : z
            .string()
            .transform((v) => v.replace(/\D/g, ''))
            .refine((v) => v.length === 8, 'CEP precisa de 8 dígitos'),
      nascimento: redefinindo
        ? z.string().optional()
        : z.string().refine((v) => !!dataParaIso(v), 'Informe a data no formato DD/MM/AAAA'),
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
  const params = useLocalSearchParams<{ token?: string; redefinir?: string }>();
  const tokenFromLink = typeof params.token === 'string' ? params.token : '';
  const comToken = !!tokenFromLink;
  /*
    O mesmo link serve para ativar conta nova e para redefinir senha, e o
    e-mail de "esqueci minha senha" marca qual é. Quem está redefinindo já
    preencheu a ficha e já assinou o termo um dia — pedir tudo de novo para
    quem só quer voltar a entrar seria castigo, não segurança.
  */
  const redefinindo = params.redefinir === '1';
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
    resolver: zodResolver(makeSchema(redefinindo)),
    defaultValues: { email: '', telefone: '', rg: '', endereco: '', cep: '', nascimento: '', cpf: '', senha: '', confirmar: '' },
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
    // O termo é assinado uma vez, na entrada. Redefinir senha não é reassinar.
    if (!redefinindo && !versaoAceita) {
      setFaltaAceitar(true);
      return;
    }
    const cpf = values.cpf.replace(/\D/g, '');
    const ficha = redefinindo ? {} : {
      email: (values.email ?? '').trim(),
      telefone: (values.telefone ?? '').replace(/\D/g, ''),
      rg: (values.rg ?? '').trim(),
      endereco: (values.endereco ?? '').trim(),
      cep: (values.cep ?? '').replace(/\D/g, ''),
      dataNascimento: dataParaIso(values.nascimento ?? '') ?? undefined,
    };
    if (comToken) {
      primeiroAcesso.mutate(
        { token: tokenFromLink, cpf, senha: values.senha, termoVersao: versaoAceita ?? undefined, ...ficha },
        { onSuccess: irParaApp },
      );
    } else {
      ativarConta.mutate(
        { cpf, senha: values.senha, termoVersao: versaoAceita ?? undefined, ...ficha },
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

            {/*
              Ao redefinir a senha, a ficha não aparece: quem chega aqui pelo
              e-mail de "esqueci minha senha" já preencheu tudo um dia e só
              quer voltar a entrar.
            */}
            {redefinindo ? null : (
              <>
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

            <Controller
              control={control}
              name="telefone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Telefone com DDD"
                  placeholder="(00) 00000-0000"
                  keyboardType="phone-pad"
                  value={value}
                  onChangeText={(t) => onChange(mascaraTelefone(t))}
                  onBlur={onBlur}
                  error={errors.telefone?.message}
                  leftIcon={<Icon name="call-outline" size={18} color={LC.textMuted} />}
                />
              )}
            />

            <Controller
              control={control}
              name="nascimento"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Data de nascimento"
                  placeholder="DD/MM/AAAA"
                  keyboardType="numeric"
                  value={value}
                  onChangeText={(t) => onChange(mascaraData(t))}
                  onBlur={onBlur}
                  error={errors.nascimento?.message}
                  leftIcon={<Icon name="calendar-number-outline" size={18} color={LC.textMuted} />}
                />
              )}
            />

            <Controller
              control={control}
              name="rg"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="RG"
                  placeholder="00.000.000-0"
                  autoCapitalize="characters"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.rg?.message}
                  leftIcon={<Icon name="id-card-outline" size={18} color={LC.textMuted} />}
                />
              )}
            />

            <Controller
              control={control}
              name="endereco"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Endereço"
                  placeholder="Rua, número, bairro, cidade"
                  autoCapitalize="words"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.endereco?.message}
                  leftIcon={<Icon name="location-outline" size={18} color={LC.textMuted} />}
                />
              )}
            />

            <Controller
              control={control}
              name="cep"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="CEP"
                  placeholder="00000-000"
                  keyboardType="numeric"
                  value={value}
                  onChangeText={(t) => onChange(mascaraCep(t))}
                  onBlur={onBlur}
                  error={errors.cep?.message}
                  leftIcon={<Icon name="map-outline" size={18} color={LC.textMuted} />}
                />
              )}
            />

              </>
            )}
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
            {redefinindo ? null : (
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
            )}

            <Button
              title={redefinindo ? 'Salvar senha nova' : comToken ? 'Criar senha' : 'Ativar conta'}
              size="lg"
              loading={pendente}
              onPress={onSubmit}
            />
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
