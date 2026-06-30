import { View, Text, Image, StyleSheet } from 'react-native';
import { LC } from '../../constants/theme';

interface AvatarProps {
  nome?: string | null;
  uri?: string | null;
  size?: number;
}

function iniciais(nome?: string | null): string {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  const first = partes[0]?.[0] ?? '';
  const last = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function Avatar({ nome, uri, size = 56 }: AvatarProps) {
  const radius = size / 2;
  if (uri) {
    return <Image source={{ uri }} style={[styles.img, { width: size, height: size, borderRadius: radius }]} />;
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{iniciais(nome)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: LC.border },
  fallback: {
    backgroundColor: LC.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: LC.primaryDark, fontWeight: '800' },
});
