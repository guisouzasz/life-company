/**
 * Referências centralizadas de imagens de marca.
 * Apenas o logo colorido oficial está disponível no projeto; backgrounds
 * fotográficos (login-bg, banners) ainda não foram fornecidos e são
 * substituídos por gradientes/ícones nos componentes até estarem presentes.
 */
export const Assets = {
  logoColor: require('../../assets/images/logo-life-color.png.png'),
};

/** Ícone (Ionicons) por modalidade, com fallback genérico. */
export function iconePorModalidade(nome?: string): 'body-outline' | 'barbell-outline' | 'fitness-outline' {
  const n = (nome ?? '').toLowerCase();
  if (n.includes('pilates') || n.includes('yoga')) return 'body-outline';
  if (n.includes('funcional')) return 'fitness-outline';
  return 'barbell-outline';
}
