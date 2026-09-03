import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../constants/theme';
import { STUDIO_NOME } from '../constants/app';
import { Card } from '../components/ui/card';
import { Icon } from '../components/ui/icon';
import { Button } from '../components/ui/button';

/**
 * Esqueci minha senha.
 *
 * O estúdio não manda e-mail — o canal dele é o WhatsApp —, então não existe
 * link automático de recuperação e não adianta fingir que existe. Quem
 * devolve o acesso é o próprio estúdio, com o mesmo botão "Link" que ele já
 * usa para o primeiro acesso: o link agora serve para as duas coisas.
 *
 * A tela existe para a pessoa não ficar parada num login que recusa a senha
 * sem dizer o que fazer. Ela explica o caminho em três passos e devolve para
 * o login.
 */
const PASSOS = [
  {
    icone: 'chatbubble-ellipses-outline' as const,
    titulo: 'Fale com o estúdio',
    texto: `Mande uma mensagem para o ${STUDIO_NOME} dizendo que esqueceu a senha. Pode ser pelo WhatsApp de sempre.`,
  },
  {
    icone: 'link-outline' as const,
    titulo: 'O estúdio te manda um link',
    texto: 'Ele abre o cadastro no painel e toca em "Link". Você recebe um endereço só seu, que vale por pouco tempo.',
  },
  {
    icone: 'key-outline' as const,
    titulo: 'Você cria uma senha nova',
    texto: 'Abra o link, confirme o seu CPF e escolha a senha. Não precisa preencher a ficha de novo.',
  },
];

export default function EsqueciSenha() {
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Pressable style={s.back} onPress={() => router.back()} hitSlop={10}>
          <Icon name="chevron-back" size={26} color={LC.textPrimary} />
        </Pressable>

        <Text style={s.titulo}>Esqueci minha senha</Text>
        <Text style={s.subtitulo}>
          Quem devolve o seu acesso é o estúdio — não é automático, e é por isso que ninguém
          consegue entrar na sua conta se souber só o seu e-mail.
        </Text>

        {PASSOS.map((p, i) => (
          <Card key={p.titulo} style={s.passo} padding={16}>
            <View style={s.passoTopo}>
              <View style={s.numero}>
                <Text style={s.numeroTexto}>{i + 1}</Text>
              </View>
              <Icon name={p.icone} size={18} color={LC.primary} />
              <Text style={s.passoTitulo}>{p.titulo}</Text>
            </View>
            <Text style={s.passoTexto}>{p.texto}</Text>
          </Card>
        ))}

        <Card style={s.aviso} padding={14}>
          <Text style={s.avisoTexto}>
            <Text style={{ fontWeight: '700' }}>Já lembrou?</Text> Se você entrar normalmente, não
            precisa de nada disto — e se já tem o link em mãos, é só abrir.
          </Text>
        </Card>

        <Button title="Voltar para o login" variant="outline" onPress={() => router.back()} style={s.botao} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  scroll: { padding: 20, paddingTop: 28, paddingBottom: 40 },
  back: { width: 40, height: 40, justifyContent: 'center', marginBottom: 6 },
  titulo: { fontSize: 24, fontWeight: '800', color: LC.textPrimary },
  subtitulo: { fontSize: 13, color: LC.textSecondary, marginTop: 6, lineHeight: 19, marginBottom: 20 },
  passo: { marginBottom: 12 },
  passoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  numero: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: LC.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  numeroTexto: { color: '#fff', fontSize: 12, fontWeight: '800' },
  passoTitulo: { flex: 1, fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  passoTexto: { fontSize: 13, color: LC.textSecondary, lineHeight: 19 },
  aviso: { backgroundColor: LC.primaryLight, marginTop: 6 },
  avisoTexto: { fontSize: 12, color: LC.textSecondary, lineHeight: 18 },
  botao: { marginTop: 20 },
});
