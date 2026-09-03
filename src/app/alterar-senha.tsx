import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../constants/theme';
import { Button } from '../components/ui/button';
import { Input, PasswordToggle } from '../components/ui/input';
import { Icon } from '../components/ui/icon';
import { InfoModal } from '../components/ui/modal';
import { useAlterarSenha } from '../services/auth/auth.mutations';
import { ApiError } from '../services/http';

const REGRAS = [
  { label: 'Mínimo de 6 caracteres', test: (v: string) => v.length >= 6 },
  { label: 'Pelo menos uma letra maiúscula', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Pelo menos um número', test: (v: string) => /\d/.test(v) },
];

/**
 * Trocar a própria senha.
 *
 * Vale para qualquer conta, inclusive a da dona e a do dono — e é a ÚNICA
 * forma de eles trocarem: a rota que define senha de aluno e professor recusa
 * administrador de propósito, e o estúdio não manda e-mail de recuperação.
 * Sem esta tela, a senha inicial do dono, colocada por variável de ambiente
 * na primeira subida, valeria para sempre.
 */
export default function AlterarSenha() {
  const alterar = useAlterarSenha();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  const salvar = () => {
    if (!atual) return setErro('Digite a sua senha atual.');
    if (!REGRAS.every((r) => r.test(nova))) return setErro('A senha nova não cumpre os requisitos abaixo.');
    if (nova !== confirmar) return setErro('As senhas não conferem.');
    setErro(null);
    alterar.mutate(
      { senhaAtual: atual, novaSenha: nova },
      {
        onSuccess: () => setPronto(true),
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível alterar a senha.'),
      },
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Pressable style={s.back} onPress={() => router.back()} hitSlop={10}>
            <Icon name="chevron-back" size={26} color={LC.textPrimary} />
          </Pressable>

          <Text style={s.titulo}>Alterar minha senha</Text>
          <Text style={s.subtitulo}>
            Você precisa saber a senha atual. Ao trocar, as outras sessões são desconectadas.
          </Text>

          {erro ? (
            <View style={s.erroBanner}>
              <Icon name="alert-circle" size={18} color={LC.danger} />
              <Text style={s.erroTexto}>{erro}</Text>
            </View>
          ) : null}

          <View style={s.form}>
            <Input
              label="Senha atual"
              placeholder="A senha que você usa hoje"
              secureTextEntry={!mostrar}
              autoCapitalize="none"
              value={atual}
              onChangeText={setAtual}
              leftIcon={<Icon name="lock-closed-outline" size={18} color={LC.textMuted} />}
              rightSlot={<PasswordToggle visible={mostrar} onToggle={() => setMostrar((v) => !v)} />}
            />
            <Input
              label="Senha nova"
              placeholder="Crie uma senha segura"
              secureTextEntry={!mostrar}
              autoCapitalize="none"
              value={nova}
              onChangeText={setNova}
              leftIcon={<Icon name="key-outline" size={18} color={LC.textMuted} />}
            />
            <Input
              label="Confirmar senha nova"
              placeholder="Repita a senha nova"
              secureTextEntry={!mostrar}
              autoCapitalize="none"
              value={confirmar}
              onChangeText={setConfirmar}
              onSubmitEditing={salvar}
              leftIcon={<Icon name="key-outline" size={18} color={LC.textMuted} />}
            />
          </View>

          <View style={s.regras}>
            {REGRAS.map((r) => {
              const ok = r.test(nova);
              return (
                <View key={r.label} style={s.regra}>
                  <Icon
                    name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={ok ? LC.success : LC.textMuted}
                  />
                  <Text style={[s.regraTexto, ok && { color: LC.successFg }]}>{r.label}</Text>
                </View>
              );
            })}
          </View>

          <Button title="Salvar senha nova" onPress={salvar} loading={alterar.isPending} style={s.botao} />
        </ScrollView>
      </KeyboardAvoidingView>

      <InfoModal
        visible={pronto}
        title="Senha alterada"
        message="Pronto. Da próxima vez que entrar, use a senha nova. As outras sessões foram desconectadas."
        onClose={() => { setPronto(false); router.back(); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingTop: 28, paddingBottom: 40 },
  back: { width: 40, height: 40, justifyContent: 'center', marginBottom: 6 },
  titulo: { fontSize: 24, fontWeight: '800', color: LC.textPrimary },
  subtitulo: { fontSize: 13, color: LC.textSecondary, marginTop: 6, lineHeight: 19, marginBottom: 20 },
  erroBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: LC.dangerBg, borderRadius: 10, padding: 12, marginBottom: 16,
  },
  erroTexto: { flex: 1, fontSize: 13, color: LC.dangerFg, lineHeight: 18 },
  form: { gap: 14 },
  regras: { marginTop: 16, gap: 6 },
  regra: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  regraTexto: { fontSize: 12, color: LC.textSecondary },
  botao: { marginTop: 24 },
});
