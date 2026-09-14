import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LC } from '../constants/theme';
import { Icon } from './ui/icon';
import { InstalarAppModal } from './instalar-app';
import { jaInstalado, navegadorEmbutido } from '../services/instalar';

/**
 * O convite discreto para salvar o site na tela inicial.
 *
 * Existe porque o item no Perfil, sozinho, não é descoberto: ninguém abre o
 * Perfil procurando por algo que não sabe que existe. Este cartão é o que faz
 * o aluno saber.
 *
 * E é discreto de propósito. Um pop-up na cara de quem só quer marcar a aula
 * de amanhã atrapalha mais do que ajuda — o cartão fica na tela inicial, dá
 * para ignorar e dá para dispensar de vez.
 *
 * Some sozinho em três casos: no app nativo, em quem já instalou, e em quem
 * dispensou. A dispensa fica no aparelho (`localStorage`), que é onde ela
 * pertence: instalar é por celular, não por conta. O mesmo aluno no tablet da
 * casa dele deve ver o convite de novo.
 */

const CHAVE = 'lc.convite-instalar.dispensado';

function foiDispensado(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    // Navegador em modo privado ou com dados bloqueados: mostra o convite.
    return false;
  }
}

function dispensar() {
  try {
    localStorage.setItem(CHAVE, '1');
  } catch {
    /* sem armazenamento, o convite volta na próxima visita — melhor que quebrar */
  }
}

export function ConviteInstalar() {
  /*
    Começa escondido e decide depois de montar. No `output: static` do Expo o
    HTML é gerado no servidor, onde não existe `window` — decidir na primeira
    renderização mostraria o cartão por um instante para quem já instalou.
  */
  const [mostrar, setMostrar] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setMostrar(!jaInstalado() && !foiDispensado());
  }, []);

  if (!mostrar) return null;

  const dentroDe = navegadorEmbutido();

  return (
    <>
      <Pressable
        style={({ pressed }) => [s.cartao, pressed && s.pressed]}
        onPress={() => setAberto(true)}
        accessibilityRole="button"
        accessibilityLabel="Ver como adicionar o Life Company à tela de início"
      >
        <View style={s.icone}>
          <Icon name="phone-portrait-outline" size={20} color={LC.primary} />
        </View>
        <View style={s.texto}>
          <Text style={s.titulo}>Deixe na tela inicial do celular</Text>
          <Text style={s.sub}>
            {dentroDe
              ? `Você abriu pelo ${dentroDe}. Veja como deixar o ícone no seu celular.`
              : 'Abre pelo ícone, como um app. Leva 20 segundos.'}
          </Text>
        </View>
        <Pressable
          hitSlop={12}
          onPress={() => {
            dispensar();
            setMostrar(false);
          }}
          accessibilityLabel="Dispensar este convite"
        >
          <Icon name="close" size={18} color={LC.textMuted} />
        </Pressable>
      </Pressable>

      <InstalarAppModal
        visible={aberto}
        onClose={() => {
          setAberto(false);
          // Instalou pelo convite do navegador? O cartão não faz mais sentido.
          if (jaInstalado()) setMostrar(false);
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  cartao: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: LC.bgCard, borderRadius: LC.radius.md,
    borderWidth: 1, borderColor: LC.border,
    padding: 13,
  },
  pressed: { backgroundColor: LC.neutralBg },
  icone: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: LC.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  texto: { flex: 1 },
  titulo: { fontSize: 14, fontWeight: '700', color: LC.textPrimary },
  sub: { fontSize: 12.5, color: LC.textSecondary, marginTop: 2, lineHeight: 17 },
});
