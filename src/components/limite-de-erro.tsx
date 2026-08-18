import { Component, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LC } from '../constants/theme';
import { Icon } from './ui/icon';

/**
 * Rede de segurança para erro de programação em tempo de execução.
 *
 * Sem isto, um erro em qualquer tela derruba a árvore inteira do React e o
 * usuário fica com a tela branca — sem mensagem, sem botão, sem saber se
 * fechou, travou ou perdeu o que fez. Foi o que aconteceu no Financeiro
 * quando a API respondeu sem um campo que a tela esperava.
 *
 * O erro continua sendo erro e precisa de correção; o que muda é que quem
 * está usando vê o que houve e tem como sair do lugar.
 *
 * Precisa ser classe: só componente de classe captura erro de renderização.
 */

interface Props {
  children: ReactNode;
}
interface State {
  erro: Error | null;
}

export class LimiteDeErro extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error) {
    // Vai para o console do navegador, que é onde dá para investigar depois.
    console.error('[LimiteDeErro]', erro);
  }

  private recarregar = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    // No app não dá para recarregar a página: limpa o erro e tenta desenhar
    // de novo, o que resolve quando a falha veio de um dado momentâneo.
    this.setState({ erro: null });
  };

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <View style={s.root}>
        <View style={s.icone}>
          <Icon name="alert-circle-outline" size={34} color={LC.danger} />
        </View>
        <Text style={s.titulo}>Algo deu errado nesta tela</Text>
        <Text style={s.texto}>
          Nada do que você fez foi perdido. Recarregue para continuar — se acontecer de novo na
          mesma tela, avise para a gente corrigir.
        </Text>
        <Pressable
          style={({ pressed }) => [s.botao, pressed && s.botaoPress]}
          onPress={this.recarregar}
          accessibilityRole="button"
        >
          <Icon name="refresh-outline" size={18} color="#fff" />
          <Text style={s.botaoTexto}>Recarregar</Text>
        </Pressable>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icone: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: LC.dangerBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  titulo: { fontSize: 18, fontWeight: '800', color: LC.textPrimary, textAlign: 'center' },
  texto: {
    fontSize: 14, color: LC.textSecondary, textAlign: 'center',
    lineHeight: 20, marginTop: 10, maxWidth: 340,
  },
  botao: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24,
    paddingHorizontal: 22, paddingVertical: 13, borderRadius: LC.radius.md, backgroundColor: LC.primary,
  },
  botaoPress: { opacity: 0.8 },
  botaoTexto: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
