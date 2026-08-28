import { useState } from 'react';
import {
  Modal as RNModal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { LC } from '../constants/theme';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Loading, ErrorState } from './ui/states';
import { useTermo } from '../services/termos/termos.queries';

/** Folga para "chegou ao fim": o último pixel raramente é alcançado. */
const FOLGA = 24;

/**
 * O termo do estúdio em tela cheia, com o aceite no fim.
 *
 * Tela cheia e não o modal central de propósito: o texto tem cinco seções, e
 * num card pequeno o aluno rolaria uma janelinha — o que na prática vira
 * aceitar sem ler. Pelo mesmo motivo o botão de aceitar só liga quando a
 * rolagem chega ao fim (ou quando o texto cabe inteiro na tela, num monitor
 * grande, e não há o que rolar).
 */
export function TermoModal({
  visible,
  onFechar,
  onAceitar,
}: {
  visible: boolean;
  onFechar: () => void;
  onAceitar: (versao: string) => void;
}) {
  const termo = useTermo();
  const [alturaVisivel, setAlturaVisivel] = useState(0);
  const [alturaConteudo, setAlturaConteudo] = useState(0);
  const [rolouAteOFim, setRolouAteOFim] = useState(false);

  const precisaRolar = alturaConteudo > alturaVisivel + FOLGA;
  const podeAceitar = !precisaRolar || rolouAteOFim;

  const aoRolar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - FOLGA) {
      setRolouAteOFim(true);
    }
  };

  return (
    <RNModal visible={visible} animationType="slide" onRequestClose={onFechar} statusBarTranslucent>
      <View style={s.root}>
        <View style={s.header}>
          <Pressable
            onPress={onFechar}
            hitSlop={10}
            style={s.fechar}
            accessibilityRole="button"
            accessibilityLabel="Fechar o termo"
          >
            <Icon name="close" size={22} color={LC.textSecondary} />
          </Pressable>
          <Text style={s.headerTitulo} numberOfLines={2}>
            {termo.data?.titulo ?? 'Termo de Normas'}
          </Text>
        </View>

        {termo.isLoading ? (
          <View style={s.centro}>
            <Loading />
          </View>
        ) : termo.isError || !termo.data ? (
          <View style={s.centro}>
            <ErrorState onRetry={() => termo.refetch()} />
          </View>
        ) : (
          <>
            <ScrollView
              style={s.flex}
              contentContainerStyle={s.conteudo}
              onScroll={aoRolar}
              scrollEventThrottle={64}
              onLayout={(e) => setAlturaVisivel(e.nativeEvent.layout.height)}
              onContentSizeChange={(_, altura) => setAlturaConteudo(altura)}
              showsVerticalScrollIndicator
            >
              <Text style={s.abertura}>{termo.data.abertura}</Text>

              {termo.data.secoes.map((secao) => (
                <View key={secao.titulo} style={s.secao}>
                  <Text style={s.secaoTitulo}>{secao.titulo}</Text>
                  {secao.texto ? <Text style={s.secaoTexto}>{secao.texto}</Text> : null}
                  {secao.itens.map((item) => (
                    <View key={item} style={s.itemLinha}>
                      <View style={s.marcador} />
                      <Text style={s.itemTexto}>{item}</Text>
                    </View>
                  ))}
                </View>
              ))}

              <View style={s.declaracaoBox}>
                <Text style={s.declaracao}>{termo.data.declaracao}</Text>
              </View>
              <Text style={s.versao}>Versão {termo.data.versao}</Text>
            </ScrollView>

            <View style={s.rodape}>
              {!podeAceitar ? (
                <View style={s.dicaRow}>
                  <Icon name="arrow-down" size={14} color={LC.textMuted} />
                  <Text style={s.dica}>Role até o fim do texto para poder aceitar.</Text>
                </View>
              ) : null}
              <Button
                title="Li e concordo"
                size="lg"
                disabled={!podeAceitar}
                onPress={() => onAceitar(termo.data!.versao)}
              />
              <Button title="Fechar" variant="outline" size="sm" onPress={onFechar} style={{ marginTop: 8 }} />
            </View>
          </>
        )}
      </View>
    </RNModal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LC.bg },
  flex: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 52, paddingBottom: 14,
    backgroundColor: LC.bgCard, borderBottomWidth: 1, borderBottomColor: LC.border,
  },
  fechar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: LC.bg },
  headerTitulo: { flex: 1, fontSize: 16, fontWeight: '800', color: LC.textPrimary },
  conteudo: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28, alignSelf: 'center', width: '100%', maxWidth: 640 },
  abertura: { fontSize: 14.5, color: LC.textSecondary, lineHeight: 22 },
  secao: { marginTop: 22 },
  secaoTitulo: { fontSize: 15.5, fontWeight: '800', color: LC.textPrimary, marginBottom: 8 },
  secaoTexto: { fontSize: 14, color: LC.textSecondary, lineHeight: 21, marginBottom: 8 },
  itemLinha: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  marcador: { width: 5, height: 5, borderRadius: 3, backgroundColor: LC.primary, marginTop: 8 },
  itemTexto: { flex: 1, fontSize: 14, color: LC.textSecondary, lineHeight: 21 },
  declaracaoBox: {
    marginTop: 26, padding: 16, borderRadius: LC.radius.md,
    backgroundColor: LC.primaryLight, borderWidth: 1, borderColor: LC.primary,
  },
  declaracao: { fontSize: 14, fontWeight: '700', color: LC.primaryDark, lineHeight: 21 },
  versao: { fontSize: 12, color: LC.textMuted, marginTop: 14, textAlign: 'center' },
  rodape: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    backgroundColor: LC.bgCard, borderTopWidth: 1, borderTopColor: LC.border,
  },
  dicaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 },
  dica: { fontSize: 12.5, color: LC.textMuted },
});
