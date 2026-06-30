import { View, Text, StyleSheet } from 'react-native';
import { LC } from '../../constants/theme';

export type BadgeVariant =
  | 'success' // Ativo, Presença
  | 'primary' // Agendada
  | 'info' // Concluída
  | 'danger' // Cancelada, Falta, Lotada
  | 'neutral'; // 3x por semana, Livre

const COLORS: Record<BadgeVariant, { bg: string; fg: string }> = {
  success: { bg: LC.successBg, fg: '#15803D' },
  primary: { bg: LC.primaryLight, fg: LC.primaryDark },
  info: { bg: LC.infoBg, fg: '#1D4ED8' },
  danger: { bg: LC.dangerBg, fg: '#B91C1C' },
  neutral: { bg: '#F1F5F9', fg: LC.textSecondary },
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  outline?: boolean;
}

export function Badge({ label, variant = 'neutral', outline = false }: BadgeProps) {
  const c = COLORS[variant];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: outline ? 'transparent' : c.bg },
        outline && { borderWidth: 1, borderColor: c.fg },
      ]}
    >
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

/** Mapeia status de agendamento/presença do backend para variante visual. */
export function statusBadge(status?: string): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'CONFIRMADO':
      return { label: 'Agendada', variant: 'primary' };
    case 'REALIZADO':
      return { label: 'Concluída', variant: 'info' };
    case 'CANCELADO':
      return { label: 'Cancelada', variant: 'danger' };
    case 'FALTOU':
      return { label: 'Falta', variant: 'danger' };
    case 'PRESENCA':
      return { label: 'Presença', variant: 'success' };
    default:
      return { label: status ?? '—', variant: 'neutral' };
  }
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: LC.radius.full,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '700' },
});
