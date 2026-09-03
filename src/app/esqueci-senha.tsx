import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../constants/theme';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useEsqueciSenha } from '../services/auth/auth.mutations';
import { ApiError } from '../services/http';

/**
 * Esqueci minha senha.
 *
 * Manda o link para o e-mail do PRÓPRIO aluno. O estúdio fala por WhatsApp no
 * resto, mas aqui não serve: o WhatsApp da dona não prova quem está do outro
 * lado, e link de senha tem que chegar numa caixa que só o dono da conta abre.
 *
 * A resposta é a mesma existindo ou não o e-mail — a rota é pública e fica na
 * internet; dizer "não achei" a transformaria numa forma de descobrir quem
 * treina no estúdio, um e-mail por vez. Por isso a tela de sucesso fala em
 * "se este e-mail estiver num cadastro", e não "enviamos".
 */
export default function EsqueciSenha() {
  const pedir = useEsqueciSenha();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState<string | null>(null);

  const enviar = () => {
    const alvo = email.trim();
    if (!alvo || !alvo.includes('@')) {
      setErro('Digite o e-mail que você usa para entrar.');
      return;
    }
    setErro(null);
    pedir.mutate(
      { email: alvo },
      {
        onSuccess: (r) => setResposta(r.mensagem),
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não consegui enviar agora. Tente de novo.'),
      },
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable style={s.back} onPress={() => router.back()} hitSlop={10}>
            <Icon name="chevron-back" size={26} color={LC.textPrimary} />
          </Pressable>

          {resposta ? (
            <>
              <View style={s.selo}>
                <Icon name="mail-outline" size={30} color={LC.primary} />
              </View>
              <Text style={s.titulo}>Confira seu e-mail</Text>
              <Text style={s.subtitulo}>{resposta}</Text>

              <Card style={s.dica} padding={14}>
                <Text style={s.dicaTexto}>
                  O link vale por <Text style={{ fontWeight: '700' }}>72 horas</Text> e só pode ser
                  usado uma vez. Se não chegar, confira a caixa de spam — ou peça o link direto à
                  recepção, que ela gera na hora.
                </Text>
              </Card>

              <Button title="Voltar para o login" onPress={() => router.back()} style={s.botao} />
            </>
          ) : (
            <>
              <Text style={s.titulo}>Esqueci minha senha</Text>
              <Text style={s.subtitulo}>
                Digite o e-mail do seu cadastro. Mandamos um link para você criar uma senha nova.
              </Text>

              {erro ? (
                <View style={s.erroBanner}>
                  <Icon name="alert-circle" size={18} color={LC.danger} />
                  <Text style={s.erroTexto}>{erro}</Text>
                </View>
              ) : null}

              <Input
                label="Seu e-mail"
                placeholder="seuemail@gmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={enviar}
                leftIcon={<Icon name="mail-outline" size={18} color={LC.textMuted} />}
              />

              <Button
                title="Enviar o link"
                onPress={enviar}
                loading={pedir.isPending}
                style={s.botao}
              />

              <Card style={s.dica} padding={14}>
                <Text style={s.dicaTexto}>
                  <Text style={{ fontWeight: '700' }}>Não lembra qual e-mail cadastrou?</Text> Fale
                  com a recepção — ela consegue gerar o link do seu acesso direto pelo cadastro.
                </Text>
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingTop: 28, paddingBottom: 40 },
  back: { width: 40, height: 40, justifyContent: 'center', marginBottom: 6 },
  selo: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: LC.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  titulo: { fontSize: 24, fontWeight: '800', color: LC.textPrimary },
  subtitulo: { fontSize: 14, color: LC.textSecondary, marginTop: 8, lineHeight: 20, marginBottom: 22 },
  erroBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: LC.dangerBg, borderRadius: 10, padding: 12, marginBottom: 16,
  },
  erroTexto: { flex: 1, fontSize: 13, color: LC.dangerFg, lineHeight: 18 },
  botao: { marginTop: 18 },
  dica: { backgroundColor: LC.primaryLight, marginTop: 22 },
  dicaTexto: { fontSize: 12, color: LC.textSecondary, lineHeight: 18 },
});
