import { Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LC } from '../constants/theme';
import { Assets } from '../constants/assets';
import { Icon } from '../components/ui/icon';

/**
 * Boas-vindas: porta de entrada do app, para alunos, professores e admin.
 * Todos são cadastrados pelo studio (sem senha), então os dois caminhos são
 * "já tenho conta" (login por e-mail/CPF) e "primeiro acesso" (ativação por CPF).
 * O login redireciona por papel; a ativação vale para qualquer tipo de conta.
 */
export default function BoasVindas() {
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={LC.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.flex}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false}>
          <Image source={Assets.logoColor} style={s.logo} tintColor="#FFFFFF" resizeMode="contain" />

          <Text style={s.eyebrow}>BEM-VINDO · LIFE COMPANY</Text>
          <Text style={s.titulo}>Bora treinar?</Text>
          <Text style={s.sub}>
            Antes de começar, conta pra gente: você já tem conta aqui ou é o seu primeiro acesso?
          </Text>

          <View style={s.portas}>
            <Pressable
              style={({ pressed }) => [s.porta, s.portaClara, pressed && s.pressed]}
              onPress={() => router.push('/login')}
            >
              <Text style={s.tagClara}>ALUNOS E EQUIPE</Text>
              <Text style={s.portaTituloClaro}>Já tenho conta</Text>
              <Text style={s.portaTextoClaro}>
                Entre com seu e-mail ou CPF e a sua senha.
              </Text>
              <View style={s.acao}>
                <Text style={s.acaoTextoClaro}>ENTRAR</Text>
                <Icon name="arrow-forward" size={16} color={LC.primary} />
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.porta, s.portaEscura, pressed && s.pressed]}
              onPress={() => router.push('/primeiro-acesso')}
            >
              <Text style={s.tagEscura}>PRIMEIRO ACESSO</Text>
              <Text style={s.portaTituloEscuro}>Meu primeiro acesso</Text>
              <Text style={s.portaTextoEscuro}>
                Já tem cadastro no studio? Ative sua conta com o CPF.
              </Text>
              <View style={s.acao}>
                <Text style={s.acaoTextoEscuro}>ATIVAR MINHA CONTA</Text>
                <Icon name="arrow-forward" size={16} color="#fff" />
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bgDark },
  flex: { flex: 1 },
  // maxWidth centraliza a coluna no desktop (admin usa no computador);
  // no celular o conteúdo ocupa a largura toda normalmente.
  scroll: {
    flexGrow: 1, justifyContent: 'center', alignSelf: 'center',
    width: '100%', maxWidth: 540,
    paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40,
  },

  logo: { width: 120, height: 74, marginBottom: 34 },
  eyebrow: { color: '#7FD8D0', fontSize: 11.5, fontWeight: '800', letterSpacing: 2 },
  titulo: { color: '#fff', fontSize: 42, fontWeight: '800', letterSpacing: -1.2, marginTop: 12 },
  sub: { color: 'rgba(255,255,255,0.78)', fontSize: 15.5, lineHeight: 23, marginTop: 14, maxWidth: 420 },

  portas: { marginTop: 34, gap: 14 },
  porta: { borderRadius: LC.radius.xl, padding: 22 },
  pressed: { opacity: 0.85 },
  portaClara: { backgroundColor: '#fff', ...LC.shadowStrong },
  portaEscura: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)' },

  tagClara: { color: LC.primary, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6 },
  tagEscura: { color: '#7FD8D0', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6 },
  portaTituloClaro: { color: LC.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 },
  portaTituloEscuro: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 },
  portaTextoClaro: { color: LC.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  portaTextoEscuro: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20, marginTop: 6 },

  acao: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  acaoTextoClaro: { color: LC.primary, fontSize: 12.5, fontWeight: '800', letterSpacing: 1 },
  acaoTextoEscuro: { color: '#fff', fontSize: 12.5, fontWeight: '800', letterSpacing: 1 },
});
