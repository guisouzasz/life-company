/** Helpers de dinheiro (BRL) sem dependência externa. */

export function formatarReal(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  const fixo = valor.toFixed(2).replace('.', ',');
  const [int, dec] = fixo.split(',');
  const comMilhar = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${comMilhar},${dec}`;
}

/** Converte "250", "250,00", "1.250,50" ou "250.00" em número (null se inválido). */
export function parseValor(texto: string): number | null {
  const limpo = texto.trim().replace(/[R$\s]/g, '');
  if (!limpo) return null;
  // Formato brasileiro: remove pontos de milhar, troca vírgula por ponto
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
