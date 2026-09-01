import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LC } from '../../constants/theme';

type IonIconName = keyof typeof Ionicons.glyphMap;
type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export type IconName = IonIconName | `material-community:${MaterialCommunityIconName}`;

const PREFIXO_MATERIAL = 'material-community:';

/**
 * `name.startsWith(...)` não estreita a união sozinho — o TypeScript continua
 * enxergando os dois formatos no `else` e reclamava do `<Ionicons>`. Com o
 * predicado, cada ramo fica com o nome do seu próprio conjunto de ícones.
 */
function ehMaterial(nome: IconName): nome is `material-community:${MaterialCommunityIconName}` {
  return nome.startsWith(PREFIXO_MATERIAL);
}

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.ComponentProps<typeof Ionicons>['style'];
}

/** Wrapper fino sobre @expo/vector-icons com defaults do Design System. */
export function Icon({ name, size = 22, color = LC.textPrimary, style }: IconProps) {
  if (ehMaterial(name)) {
    const materialName = name.slice(PREFIXO_MATERIAL.length) as MaterialCommunityIconName;
    return <MaterialCommunityIcons name={materialName} size={size} color={color} style={style} />;
  }

  return <Ionicons name={name} size={size} color={color} style={style} />;
}
