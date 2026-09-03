/**
 * Como o sistema chama o aluno nas mensagens: primeiro nome + último
 * sobrenome. "CARLOS EDUARDO RAVAGLIO DA ROCHA" → "Carlos Rocha".
 *
 * Só o primeiro nome não serve. O estúdio tem três Carlos, e o aviso "Carlos
 * já tem 1 aula nesta semana" fez a dona achar que o sistema tinha misturado
 * os cadastros — ela leu como se estivesse falando de OUTRO Carlos. É como
 * ela chama cada um ("o Carlos Rocha"), então é como o sistema deve falar.
 *
 * Mora aqui, e não dentro de um service, porque as mensagens de erro que
 * chegam na tela da dona saem de mais de um módulo: agendamento, horário
 * fixo, e o que vier depois. Uma cópia por módulo já começou a divergir —
 * uma delas voltou a mandar o nome cru em MAIÚSCULAS.
 *
 * O espelho desta função no app é `src/services/nome.ts`.
 */
const CONECTIVOS = new Set(['da', 'de', 'di', 'do', 'das', 'des', 'dos', 'e']);

const capitaliza = (p: string) =>
  CONECTIVOS.has(p.toLowerCase())
    ? p.toLowerCase()
    : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();

export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return nome;
  const primeiro = capitaliza(partes[0]);
  // Último pedaço que não seja conectivo ("... DA ROCHA" → "Rocha").
  const sobrenome = [...partes].reverse().find((x) => !CONECTIVOS.has(x.toLowerCase()));
  if (partes.length === 1 || !sobrenome || sobrenome === partes[0]) return primeiro;
  return `${primeiro} ${capitaliza(sobrenome)}`;
}
