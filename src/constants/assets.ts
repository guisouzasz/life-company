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

/**
 * Nome de exibição da modalidade. O backend (read-only) ainda guarda a
 * modalidade como "Academia"; renomeada para "Musculação" apenas na UI.
 */
export function nomeModalidade(nome?: string): string {
  const n = (nome ?? '').trim();
  return n.toLowerCase() === 'academia' ? 'Musculação' : n;
}

/** Ignora acento, caixa e espaço em volta — "MUSCULAÇÃO " casa com "musculacao". */
const chave = (nome?: string | null) =>
  (nome ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Funcional monta UM treino por dia, igual para a turma toda; as outras
 * modalidades têm ficha por aluno.
 */
export function usaTreinoDoDia(modalidade?: string | null): boolean {
  return chave(modalidade).includes('funcional');
}

/**
 * A ficha é estruturada (grupo muscular, séries, repetições, carga) ou o
 * treino é escrito em texto livre?
 *
 * A regra é declarada pela exceção — texto livre é de Funcional e Pilates, e
 * todo o resto usa a ficha. O contrário já custou caro: a checagem era
 * `nome === 'Musculação'`, então qualquer diferença na grafia da modalidade
 * ("Musculacao", "MUSCULAÇÃO", um espaço sobrando) derrubava a musculação
 * silenciosamente para o formato do funcional. Assim, no pior caso uma
 * modalidade desconhecida ganha a ficha completa em vez de perder a dela.
 */
export function usaFichaEstruturada(modalidade?: string | null): boolean {
  const n = chave(modalidade);
  if (!n) return true; // admin, ou professor sem modalidade
  return !(n.includes('funcional') || n.includes('pilates') || n.includes('yoga'));
}

/** Cor de destaque por modalidade (ícones/bolhas), com fallback teal. */
export function corPorModalidade(nome?: string): string {
  const n = (nome ?? '').toLowerCase();
  if (n.includes('pilates') || n.includes('yoga')) return '#3B82F6';
  if (n.includes('funcional')) return '#22C55E';
  return '#0E9488';
}
