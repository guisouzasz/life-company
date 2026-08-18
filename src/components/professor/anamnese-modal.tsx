import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { Icon } from '../ui/icon';
import { FichaSaude } from './ficha-saude';
import type { Anamnese } from '../../services/anamnese/anamnese.types';

/**
 * Ficha de saúde numa janela, para consultar no meio da aula sem sair da
 * turma. O conteúdo vem de `FichaSaude`, o mesmo da tela cheia — as perguntas
 * vão mudar com o tempo, e mantê-las escritas em dois lugares garantiria que
 * um dos dois ficasse para trás.
 */

interface Props {
  visible: boolean;
  alunoNome: string;
  ficha: Anamnese | null | undefined;
  onClose: () => void;
}

export function AnamneseModal({ visible, alunoNome, ficha, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.caixa}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>Ficha de saúde</Text>
              <Text style={s.sub}>{alunoNome}</Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar ficha de saúde"
            >
              <Icon name="close" size={22} color={LC.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={s.corpo} showsVerticalScrollIndicator={false}>
            <FichaSaude ficha={ficha} alunoNome={alunoNome} completa />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(11,28,29,0.55)', justifyContent: 'center', padding: 20 },
  caixa: {
    backgroundColor: LC.bgCard, borderRadius: LC.radius.xl, padding: 20,
    maxHeight: '82%', width: '100%', maxWidth: 480, alignSelf: 'center', ...LC.shadowStrong,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  titulo: { fontSize: 18, fontWeight: '800', color: LC.textPrimary },
  sub: { fontSize: 13, color: LC.textSecondary, marginTop: 2 },
  corpo: { flexGrow: 0 },
});
