import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LC } from '../../constants/theme';
import { Icon, type IconName } from './icon';
import { Button } from './button';

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={LC.primary} />
      {label ? <Text style={styles.loadingText}>{label}</Text> : null}
    </View>
  );
}

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'calendar-outline', title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={36} color={LC.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDesc}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="outline" fullWidth={false} onPress={onAction} style={styles.emptyBtn} />
      ) : null}
    </View>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: LC.dangerBg }]}>
        <Icon name="cloud-offline-outline" size={36} color={LC.danger} />
      </View>
      <Text style={styles.emptyTitle}>Algo deu errado</Text>
      <Text style={styles.emptyDesc}>{message ?? 'Não foi possível carregar os dados.'}</Text>
      {onRetry ? <Button title="Tentar novamente" variant="outline" fullWidth={false} onPress={onRetry} style={styles.emptyBtn} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: LC.bg, gap: 12 },
  loadingText: { color: LC.textSecondary, fontSize: 14 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: LC.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: LC.textPrimary, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: LC.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 12, paddingHorizontal: 24 },
});
