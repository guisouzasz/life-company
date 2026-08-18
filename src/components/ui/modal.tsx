import { Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LC } from '../../constants/theme';
import { Icon } from './icon';
import { Button } from './button';

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Fecha ao tocar no fundo (default true). */
  dismissable?: boolean;
  /** Largura máxima do card (default 420). Uma ficha de treino pede mais. */
  larguraMax?: number;
  /** Conteúdo antes do título — setas de navegação, avatar. */
  headerLeft?: React.ReactNode;
}

/**
 * Modal central reutilizável — funciona em web e nativo (ao contrário de Alert).
 * Backdrop com glassmorphism (desfoque + tint translúcido) e card sólido flutuante.
 */
export function AppModal({
  visible,
  onClose,
  title,
  children,
  dismissable = true,
  larguraMax,
  headerLeft,
}: AppModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {/* Backdrop: desfoque + tint */}
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={[StyleSheet.absoluteFill, styles.tint]} onPress={dismissable ? onClose : undefined} />

        {/* Card */}
        <View style={[styles.card, larguraMax ? { maxWidth: larguraMax } : null, { pointerEvents: 'box-none' }]}>
          <View style={styles.cardInner}>
            {title ? (
              <View style={styles.header}>
                {headerLeft}
                <Text style={styles.title}>{title}</Text>
                <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
                  <Icon name="close" size={20} color={LC.textSecondary} />
                </Pressable>
              </View>
            ) : null}
            {children}
          </View>
        </View>
      </View>
    </RNModal>
  );
}

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Diálogo de confirmação cross-platform (substitui Alert.alert com botões). */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AppModal visible={visible} onClose={onCancel} title={title} dismissable={!loading}>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.actions}>
        <Button title={cancelLabel} variant="outline" onPress={onCancel} style={styles.action} />
        <Button
          title={confirmLabel}
          variant={destructive ? 'danger' : 'primary'}
          loading={loading}
          onPress={onConfirm}
          style={styles.action}
        />
      </View>
    </AppModal>
  );
}

interface InfoModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttonLabel?: string;
  onClose: () => void;
}

/** Aviso simples com um botão (substitui Alert.alert de mensagem única). */
export function InfoModal({ visible, title, message, buttonLabel = 'OK', onClose }: InfoModalProps) {
  return (
    <AppModal visible={visible} onClose={onClose} title={title}>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Button title={buttonLabel} onPress={onClose} />
    </AppModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tint: { backgroundColor: 'rgba(15,23,42,0.32)' },
  card: { width: '100%', maxWidth: 420 },
  cardInner: {
    backgroundColor: LC.bgCard,
    borderRadius: LC.radius.xxl,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    ...LC.shadowStrong,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: LC.textPrimary, flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: LC.bg },
  message: { fontSize: 14, color: LC.textSecondary, lineHeight: 20, marginBottom: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
