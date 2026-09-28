/**
 * Referências centralizadas de imagens de marca.
 * Apenas o logo colorido oficial está disponível no projeto; backgrounds
 * fotográficos (login-bg, banners) ainda não foram fornecidos e são
 * substituídos por gradientes/ícones nos componentes até estarem presentes.
 */
export const Assets = {
  logoColor: require('../../assets/images/logo-life-color.png.png'),
};

/** Ícone por modalidade, com fallback genérico. */
export function iconePorModalidade(nome?: string): 'body-outline' | 'barbell-outline' | 'material-community:kettlebell' {
  const n = chave(nome);
  if (n.includes('pilates') || n.includes('yoga')) return 'body-outline';
  if (n.includes('funcional')) return 'material-community:kettlebell';
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

type Mod = { id: string; nome: string };

/**
 * Modalidades de um professor, a principal primeiro.
 *
 * Um professor pode dar aula em mais de uma (Gabriele: Musculação e
 * Funcional). Cai na modalidade única quando a lista não vem — é o que uma
 * API anterior devolve —, para a tela nunca ficar sem nenhuma.
 */
export function modalidadesDe(p?: { modalidades?: Mod[]; modalidadeProfessor?: Mod | null } | null): Mod[] {
  if (p?.modalidades?.length) return p.modalidades;
  return p?.modalidadeProfessor ? [p.modalidadeProfessor] : [];
}

/** "Musculação", "Musculação e Funcional", "Musculação, Funcional e Pilates". */
export function juntarNomes(mods: { nome: string }[]): string {
  const nomes = mods.map((m) => nomeModalidade(m.nome));
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
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
  const n = chave(nome);
  if (n.includes('pilates') || n.includes('yoga')) return '#3B82F6';
  if (n.includes('funcional')) return '#F97316';
  return '#0E9488';
}
