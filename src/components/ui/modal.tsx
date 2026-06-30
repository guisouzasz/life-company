import { Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { Icon } from './icon';
import { Button } from './button';

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Fecha ao tocar no fundo escuro (default true). */
  dismissable?: boolean;
}

/** Modal central reutilizável — funciona em web e nativo (ao contrário de Alert). */
export function AppModal({ visible, onClose, title, children, dismissable = true }: AppModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={dismissable ? onClose : undefined}>
        <Pressable style={styles.card} onPress={() => {}}>
          {title ? (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Icon name="close" size={22} color={LC.textSecondary} />
              </Pressable>
            </View>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
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
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: LC.bgCard, borderRadius: LC.radius.xl, padding: 20, ...LC.shadowStrong },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: LC.textPrimary, flex: 1 },
  message: { fontSize: 14, color: LC.textSecondary, lineHeight: 20, marginBottom: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
