import { useWindowDimensions } from 'react-native';
import { Breakpoints } from '../constants/theme';

/**
 * Viewport largo o suficiente para o painel admin com sidebar.
 * Baseado na largura da janela (reativo a resize no web), não em Platform —
 * celular no navegador deve continuar vendo o layout mobile.
 */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= Breakpoints.desktop;
}

/**
 * Largura de tablet para cima — o suficiente para duas colunas.
 * O professor da musculação usa o sistema num tablet apoiado na sala, e ali
 * o treino cabe ao lado da lista da turma, sem precisar abrir e fechar nada.
 */
export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= Breakpoints.tablet;
}
