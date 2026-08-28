/**
 * Nome curto para caber na tela sem virar nome de outra pessoa.
 *
 * O estúdio tem três Carlos ("CARLOS ALBERTO BASSA", "CARLOS EDUARDO RAVAGLIO
 * DA ROCHA", "CARLOS EDUARDO REGUERO"). Enquanto o painel mostrava só o
 * primeiro nome — ou primeiro nome + inicial do segundo, que dava "Carlos E."
 * para dois deles — a dona lia a grade e os avisos como se o sistema estivesse
 * misturando o cadastro de um com o do outro. Primeiro nome + último sobrenome
 * separa os três e continua curto.
 */
const CONECTIVOS = new Set(['da', 'de', 'di', 'do', 'das', 'des', 'dos', 'e']);

const capitaliza = (p: string) =>
  CONECTIVOS.has(p.toLowerCase()) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();

export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return nome;
  const primeiro = capitaliza(partes[0]);
  const sobrenome = [...partes].reverse().find((p) => !CONECTIVOS.has(p.toLowerCase()));
  if (partes.length === 1 || !sobrenome || sobrenome === partes[0]) return primeiro;
  return `${primeiro} ${capitaliza(sobrenome)}`;
}

/** Só o primeiro nome — para falar COM a pessoa (WhatsApp, saudação). */
export function primeiroNome(nome: string): string {
  const p = nome.trim().split(/\s+/)[0];
  return p ? capitaliza(p) : nome;
}
