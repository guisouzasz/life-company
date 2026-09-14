import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LC } from '../constants/theme';
import { Icon, type IconName } from './ui/icon';
import { Button } from './ui/button';
import {
  copiarEndereco,
  enderecoDoSite,
  instalarPeloNavegador,
  navegadorEmbutido,
  ouvirConvite,
  plataformaProvavel,
  temConviteDoNavegador,
  type Plataforma,
} from '../services/instalar';

/**
 * Como salvar o site na tela inicial do celular.
 *
 * O aluno chega aqui pelo link que a dona manda no WhatsApp e usa o sistema
 * pelo navegador. Salvo na tela inicial, ele abre pelo ícone como qualquer
 * app — sem barra de endereço, porque o manifesto já declara `standalone`.
 *
 * A tela existe porque esse caminho é invisível: ninguém descobre sozinho que
 * "compartilhar → adicionar à tela de início" transforma um site em app.
 *
 * Dois caminhos, e não é capricho de layout:
 *
 *  - ANDROID: o navegador tem convite próprio de instalação, e dá para
 *    dispará-lo por código. Um toque resolve, e é o que se oferece.
 *  - IPHONE: não existe API. O Safari só instala pelo menu de compartilhar,
 *    então o único caminho honesto é dizer onde tocar.
 *
 * E o obstáculo que aparece antes dos dois: o navegador embutido do WhatsApp.
 * Como o link chega por lá, é onde o aluno abre o site — e ali a opção de
 * adicionar à tela inicial não existe. Sem esse aviso, ele segue o passo a
 * passo, não acha o botão e conclui que o sistema é ruim.
 */

const PASSOS: Record<Plataforma, { icone: IconName; texto: string }[]> = {
  iphone: [
    {
      icone: 'share-outline',
      texto: 'Toque no ícone de compartilhar (o quadrado com a seta para cima), na barra de baixo do Safari.',
    },
    { icone: 'add-circle-outline', texto: 'Role a lista e toque em “Adicionar à Tela de Início”.' },
    { icone: 'checkmark-circle-outline', texto: 'Toque em “Adicionar”, no canto superior direito. Pronto.' },
  ],
  android: [
    { icone: 'ellipsis-vertical', texto: 'Toque nos três pontinhos, no canto superior direito do Chrome.' },
    { icone: 'add-circle-outline', texto: 'Toque em “Adicionar à tela inicial” ou “Instalar aplicativo”.' },
    { icone: 'checkmark-circle-outline', texto: 'Confirme em “Adicionar” ou “Instalar”. Pronto.' },
  ],
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function InstalarAppModal({ visible, onClose }: Props) {
  const [plataforma, setPlataforma] = useState<Plataforma>(plataformaProvavel);
  const [copiado, setCopiado] = useState(false);
  /*
    O convite do navegador pode chegar depois de a tela abrir. Reagir a ele
    evita o pior dos mundos: o Android lendo passo a passo quando tinha um
    botão de um toque disponível.
  */
  const [temConvite, setTemConvite] = useState(temConviteDoNavegador);
  useEffect(() => ouvirConvite(() => setTemConvite(temConviteDoNavegador())), []);

  const dentroDe = navegadorEmbutido();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.fundo}>
        <View style={s.folha}>
          <View style={s.cabecalho}>
            <View style={s.selo}>
              <Icon name="phone-portrait-outline" size={22} color={LC.primary} />
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Fechar">
              <Icon name="close" size={22} color={LC.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.corpo}>
            <Text style={s.titulo}>Deixe o Life Company na tela inicial</Text>
            <Text style={s.subtitulo}>
              O sistema funciona direto no navegador, mas salvo na tela inicial ele abre pelo ícone,
              como um app — e você não precisa mais procurar o link.
            </Text>

            {/*
              O aviso vem ANTES de tudo quando o aluno está no navegador de
              outro app: seguir os passos ali não leva a nada.
            */}
            {dentroDe ? (
              <View style={s.aviso}>
                <View style={s.avisoTopo}>
                  <Icon name="open-outline" size={16} color={LC.warningFg} />
                  <Text style={s.avisoTitulo}>Primeiro, abra no navegador</Text>
                </View>
                <Text style={s.avisoTexto}>
                  Você entrou pelo {dentroDe}, e por aqui não dá para adicionar à tela de início.
                </Text>
                <Text style={s.avisoPasso}>
                  1. Toque nos três pontinhos desta tela (o menu do {dentroDe}).
                </Text>
                <Text style={s.avisoPasso}>
                  2. Escolha “Abrir no navegador”{plataforma === 'iphone' ? ' ou “Abrir no Safari”' : ''}.
                </Text>
                <Text style={s.avisoPasso}>3. Aí siga os passos abaixo, já no navegador.</Text>
                <Pressable
                  style={({ pressed }) => [s.copiar, pressed && s.copiarPress]}
                  onPress={async () => setCopiado(await copiarEndereco())}
                  accessibilityRole="button"
                >
                  <Icon name={copiado ? 'checkmark' : 'copy-outline'} size={16} color={LC.textPrimary} />
                  <Text style={s.copiarTexto}>
                    {copiado ? 'Endereço copiado' : 'Copiar o endereço do site'}
                  </Text>
                </Pressable>
                {copiado ? <Text style={s.endereco}>{enderecoDoSite()}</Text> : null}
              </View>
            ) : null}

            {/*
              Android com convite do navegador: um toque, sem passo a passo.
              Fica acima das abas porque, quando existe, é o caminho certo.
            */}
            {temConvite && !dentroDe ? (
              <>
                <Button
                  title="Instalar agora"
                  size="lg"
                  leftIcon={<Icon name="download-outline" size={18} color="#fff" />}
                  onPress={async () => {
                    const aceitou = await instalarPeloNavegador();
                    if (aceitou) onClose();
                  }}
                  style={s.botaoInstalar}
                />
                <Text style={s.ou}>ou faça na mão:</Text>
              </>
            ) : null}

            <View style={s.abas}>
              {(['iphone', 'android'] as const).map((p) => {
                const ativa = plataforma === p;
                return (
                  <Pressable
                    key={p}
                    style={[s.aba, ativa && s.abaAtiva]}
                    onPress={() => setPlataforma(p)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: ativa }}
                  >
                    <Text style={[s.abaTexto, ativa && s.abaTextoAtivo]}>
                      {p === 'iphone' ? 'iPhone' : 'Android'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {PASSOS[plataforma].map((passo, i) => (
              <View key={i} style={s.passo}>
                <View style={s.numero}>
                  <Text style={s.numeroTexto}>{i + 1}</Text>
                </View>
                <Icon name={passo.icone} size={18} color={LC.primary} />
                <Text style={s.passoTexto}>{passo.texto}</Text>
              </View>
            ))}

            <Text style={s.rodape}>
              O ícone do Life Company vai aparecer junto com os seus outros apps.
            </Text>

            <Button title="Entendi" size="lg" onPress={onClose} style={s.entendi} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  folha: {
    backgroundColor: LC.bg,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: '92%', paddingTop: 14,
  },
  cabecalho: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 6,
  },
  selo: {
    width: 44, height: 44, borderRadius: 13, backgroundColor: LC.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  corpo: { paddingHorizontal: 18, paddingBottom: 28 },

  titulo: { fontSize: 20, fontWeight: '800', color: LC.textPrimary, marginTop: 8 },
  subtitulo: { fontSize: 13.5, color: LC.textSecondary, lineHeight: 20, marginTop: 8, marginBottom: 16 },

  aviso: {
    backgroundColor: LC.warningBg, borderRadius: 12,
    padding: 13, marginBottom: 16,
  },
  avisoTopo: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  avisoTitulo: { fontSize: 14, fontWeight: '800', color: LC.warningFg },
  avisoTexto: { fontSize: 13, color: LC.warningFg, lineHeight: 19, marginBottom: 8 },
  avisoPasso: { fontSize: 13, color: LC.warningFg, lineHeight: 20 },
  copiar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: LC.bgCard, borderRadius: 999,
    paddingVertical: 11, marginTop: 11,
  },
  copiarPress: { opacity: 0.7 },
  copiarTexto: { fontSize: 13.5, fontWeight: '700', color: LC.textPrimary },
  endereco: { fontSize: 12, color: LC.warningFg, textAlign: 'center', marginTop: 7 },

  botaoInstalar: { marginBottom: 12 },
  ou: { fontSize: 12.5, color: LC.textMuted, textAlign: 'center', marginBottom: 14 },

  abas: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  aba: {
    flex: 1, paddingVertical: 10, borderRadius: 999,
    backgroundColor: LC.neutralBg, alignItems: 'center',
  },
  abaAtiva: { backgroundColor: LC.primary },
  abaTexto: { fontSize: 14, fontWeight: '700', color: LC.textSecondary },
  abaTextoAtivo: { color: '#fff' },

  passo: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 15 },
  numero: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: LC.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  numeroTexto: { fontSize: 13, fontWeight: '800', color: '#fff' },
  passoTexto: { flex: 1, fontSize: 13.5, color: LC.textPrimary, lineHeight: 20 },

  rodape: { fontSize: 12.5, color: LC.textMuted, lineHeight: 18, marginTop: 4, marginBottom: 18 },
  entendi: { marginBottom: 4 },
});
