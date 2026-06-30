import { Ionicons } from '@expo/vector-icons';
import { LC } from '../../constants/theme';

export type IconName = keyof typeof Ionicons.glyphMap;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.ComponentProps<typeof Ionicons>['style'];
}

/** Wrapper fino sobre Ionicons com defaults do Design System. */
export function Icon({ name, size = 22, color = LC.textPrimary, style }: IconProps) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
