/**
 * Máscaras dos campos de cadastro (CPF, CEP, data) e as conversões entre o
 * que a pessoa digita e o que a API espera.
 *
 * Todas trabalham em cima do que já foi digitado, então servem direto no
 * onChangeText: o valor volta formatado a cada tecla.
 */

/** 000.000.000-00 */
export function mascaraCpf(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** 00000-000 */
export function mascaraCep(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
}

/** (00) 00000-0000 — aceita fixo de 8 dígitos e celular de 9. */
export function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** DD/MM/AAAA */
export function mascaraData(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Só os dígitos — o que vai para a API em CPF, CEP e telefone. */
export const soDigitos = (v: string): string => v.replace(/\D/g, '');

/**
 * "DD/MM/AAAA" → "AAAA-MM-DD" para mandar à API.
 * Devolve null quando a data não existe no calendário (31/02, mês 13),
 * é futura ou anterior a 1900 — o Date do JS acomoda essas datas sem
 * reclamar, então a checagem é comparar os componentes de volta.
 */
export function dataParaIso(v: string): string | null {
  const d = v.replace(/\D/g, '');
  if (d.length !== 8) return null;
  const dia = Number(d.slice(0, 2));
  const mes = Number(d.slice(2, 4));
  const ano = Number(d.slice(4));
  if (ano < 1900) return null;
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() + 1 !== mes || data.getDate() !== dia) return null;
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  if (data > hoje) return null;
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * "DD/MM/AAAA" → "AAAA-MM-DD", aceitando data FUTURA.
 *
 * `dataParaIso` recusa o futuro porque foi feita para nascimento. Validade de
 * ficha de treino é o oposto: ela vence adiante, e é a data futura que
 * interessa. O resto da checagem continua igual — dia que não existe no
 * calendário (31/02, mês 13) segue recusado.
 */
export function dataFuturaParaIso(v: string): string | null {
  const d = v.replace(/\D/g, '');
  if (d.length !== 8) return null;
  const dia = Number(d.slice(0, 2));
  const mes = Number(d.slice(2, 4));
  const ano = Number(d.slice(4));
  if (ano < 2000 || ano > 2100) return null;
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() + 1 !== mes || data.getDate() !== dia) return null;
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Data vinda da API (ISO) → "DD/MM/AAAA" para preencher o formulário. */
export function isoParaData(v?: string | null): string {
  if (!v) return '';
  const m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/**
 * Lê um valor em dinheiro que pode não vir.
 *
 * Existe porque a API e o site sobem separados: numa janela de deploy o site
 * novo conversa com a API antiga, que ainda não manda o campo. Tratar
 * `undefined` como "sem valor" — e não confiar que só `null` acontece — é o
 * que impede a tela de quebrar nessa janela.
 */
export function valorOuNulo(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Dinheiro em real, para leitura: 180 → "R$ 180,00".
 * `null`/indefinido vira um traço — é o jeito de a tela dizer "ainda não
 * definido" sem fingir que o valor é zero.
 */
export function formatarReal(valor?: number | null): string {
  const v = valorOuNulo(valor);
  if (v === null) return '—';
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

/** Campo de valor: só dígitos, lidos como centavos. "18000" → 180.00 */
export function mascaraReal(texto: string): string {
  const centavos = texto.replace(/\D/g, '').slice(0, 8);
  if (!centavos) return '';
  const n = Number(centavos) / 100;
  return n.toFixed(2).replace('.', ',');
}

/** Lê o texto do campo de valor como número. "180,00" → 180 */
export function realParaNumero(texto: string): number | null {
  const limpo = texto.replace(/\./g, '').replace(',', '.').trim();
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}
