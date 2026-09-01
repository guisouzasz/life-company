import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LC } from '../../constants/theme';

type IonIconName = keyof typeof Ionicons.glyphMap;
type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export type IconName = IonIconName | `material-community:${MaterialCommunityIconName}`;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.ComponentProps<typeof Ionicons>['style'];
}

/** Wrapper fino sobre @expo/vector-icons com defaults do Design System. */
export function Icon({ name, size = 22, color = LC.textPrimary, style }: IconProps) {
  if (name.startsWith('material-community:')) {
    const materialName = name.replace('material-community:', '') as MaterialCommunityIconName;
    return <MaterialCommunityIcons name={materialName} size={size} color={color} style={style} />;
  }

  return <Ionicons name={name} size={size} color={color} style={style} />;
}
