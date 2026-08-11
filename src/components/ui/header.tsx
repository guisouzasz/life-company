import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LC } from '../../constants/theme';
import { Icon, type IconName } from './icon';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightIcon?: IconName;
  onRightPress?: () => void;
  rightBadge?: boolean;
}

/** Cabeçalho padrão das telas internas. */
export function Header({ title, subtitle, showBack, rightIcon, onRightPress, rightBadge }: HeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Icon name="chevron-back" size={24} color={LC.textPrimary} />
          </Pressable>
        ) : null}
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightIcon ? (
        <Pressable style={styles.rightBtn} onPress={onRightPress} hitSlop={8}>
          <Icon name={rightIcon} size={22} color={LC.textPrimary} />
          {rightBadge ? <View style={styles.dot} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    ...LC.coluna,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: LC.bg,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', marginLeft: -8 },
  title: { fontSize: 22, fontWeight: '800', color: LC.textPrimary },
  subtitle: { fontSize: 14, color: LC.textSecondary, marginTop: 2 },
  rightBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LC.bgCard,
    borderWidth: 1,
    borderColor: LC.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LC.danger,
    borderWidth: 1.5,
    borderColor: LC.bgCard,
  },
});
