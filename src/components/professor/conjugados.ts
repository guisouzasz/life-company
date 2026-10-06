/**
 * Bi-set, tri-set: exercícios feitos em sequência, sem descanso entre eles.
 *
 * Na ficha cada um é um exercício de verdade — com a sua carga e o seu
 * histórico de evolução —, e o `conjugado` diz "este vai junto com o
 * PRÓXIMO". Antes o professor escrevia os dois num exercício só ("Supino +
 * crucifixo") e tinha um campo de carga para os dois pesos.
 */
export interface Conjugacao {
  /** "Bi-set", "Tri-set" ou "Circuito" (4 ou mais). */
  rotulo: string;
  /** Os outros exercícios do mesmo bloco, na ordem da ficha. */
  parceiros: string[];
}

export function rotuloDoBloco(tamanho: number): string {
  return tamanho === 2 ? 'Bi-set' : tamanho === 3 ? 'Tri-set' : 'Circuito';
}

/** Para cada posição da ficha que faz parte de um bloco, o rótulo e os parceiros. */
export function conjugacoes(exercicios: { nome: string; conjugado?: boolean | null }[]): Map<number, Conjugacao> {
  const mapa = new Map<number, Conjugacao>();
  let i = 0;
  while (i < exercicios.length) {
    let j = i;
    while (j < exercicios.length - 1 && exercicios[j].conjugado) j++;
    if (j > i) {
      const bloco = exercicios.slice(i, j + 1).map((e) => e.nome);
      for (let k = i; k <= j; k++) {
        mapa.set(k, { rotulo: rotuloDoBloco(bloco.length), parceiros: bloco.filter((_, x) => x !== k - i) });
      }
    }
    i = j + 1;
  }
  return mapa;
}

/** "Crucifixo reto" | "Crucifixo reto e Voador" | "A, B e C" */
export function juntarParceiros(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}
