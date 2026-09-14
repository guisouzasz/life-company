import { Platform } from 'react-native';

/**
 * O que o navegador do aluno permite na hora de salvar o site na tela inicial.
 *
 * Tudo aqui é só leitura do ambiente, e tudo devolve valor seguro fora da web:
 * o app nativo (se um dia existir) já ESTÁ instalado, então nada disto aparece.
 *
 * As três perguntas que importam, na ordem em que atrapalham:
 *
 *  1. Já está instalado? Então não se oferece nada. Um convite para instalar o
 *     que já está instalado faz o aluno duvidar de que instalou.
 *
 *  2. Está num navegador embutido de outro app? É o caso mais comum aqui, e
 *     não é detalhe: a dona manda o link de primeiro acesso pelo WhatsApp, o
 *     aluno toca, e o WhatsApp abre o site no navegador DELE — onde "adicionar
 *     à tela de início" simplesmente não existe. Sem avisar, o aluno segue o
 *     passo a passo, não encontra a opção e conclui que o sistema é ruim.
 *
 *  3. É iPhone ou Android? No Android o próprio navegador oferece instalar, e
 *     dá para disparar esse convite por código. No iPhone não existe API: o
 *     Safari só instala pelo menu de compartilhar, então ali o único caminho é
 *     ensinar onde tocar.
 */

export type Plataforma = 'iphone' | 'android';

/** iOS não é só iPhone: iPad recente se anuncia como Mac com toque. */
function ehIOS(ua: string): boolean {
  if (/iphone|ipad|ipod/.test(ua)) return true;
  return /macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
}

export function plataformaProvavel(): Plataforma {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'android';
  const ua = navigator.userAgent.toLowerCase();
  return ehIOS(ua) ? 'iphone' : 'android';
}

/**
 * Já abriu como app (ícone da tela inicial) em vez de aba do navegador.
 *
 * `display-mode: standalone` cobre Android e o Safari novo; `navigator.standalone`
 * é o jeito antigo do iOS e continua sendo o único em algumas versões.
 */
export function jaInstalado(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  const comoApp = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const iosAntigo = (window.navigator as any)?.standalone === true;
  return !!comoApp || !!iosAntigo;
}

/**
 * O nome do app cujo navegador embutido está sendo usado, ou null.
 *
 * Detecção por user-agent é imprecisa por natureza — vale para orientar, não
 * para bloquear. Por isso o passo a passo continua visível mesmo quando isto
 * acerta: se o palpite estiver errado, o aluno ignora o aviso e segue.
 */
export function navegadorEmbutido(): string | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (/Line\//i.test(ua)) return 'LINE';
  /*
    O WebView do Android não diz de quem é, mas se anuncia com "; wv". Pega o
    navegador embutido de vários apps de uma vez — inclusive o do WhatsApp em
    aparelhos onde ele não escreve o nome no user-agent.
  */
  if (/\bwv\b/.test(ua) && /Android/i.test(ua)) return 'outro app';
  return null;
}

/**
 * O convite de instalação do próprio navegador (Android/Chrome).
 *
 * O navegador dispara `beforeinstallprompt` UMA vez e só se o site for
 * instalável; guardamos o evento porque ele precisa ser usado depois, no toque
 * do aluno — chamar `prompt()` sem um gesto dele é ignorado pelo navegador.
 *
 * No iPhone isto nunca acontece, e é por isso que lá o caminho é o passo a
 * passo.
 */
let convite: any = null;
const ouvintes = new Set<() => void>();

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: any) => {
    // Sem isto o Chrome mostra a barrinha dele por cima da tela do aluno.
    e.preventDefault();
    convite = e;
    ouvintes.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    convite = null;
    ouvintes.forEach((f) => f());
  });
}

export const temConviteDoNavegador = () => !!convite;

/** Avisa a tela quando o convite aparece, para o botão surgir sem recarregar. */
export function ouvirConvite(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/** Dispara o convite do navegador. Devolve true quando o aluno aceitou. */
export async function instalarPeloNavegador(): Promise<boolean> {
  if (!convite) return false;
  const evento = convite;
  // O evento serve uma vez só: guardar para um segundo toque não funciona.
  convite = null;
  ouvintes.forEach((f) => f());
  try {
    await evento.prompt();
    const r = await evento.userChoice;
    return r?.outcome === 'accepted';
  } catch {
    return false;
  }
}

/** O endereço do site, para o aluno colar no navegador de verdade. */
export function enderecoDoSite(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  return window.location.origin;
}

/** Copia o endereço. Devolve false quando o navegador não deixa. */
export async function copiarEndereco(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(enderecoDoSite());
    return true;
  } catch {
    return false;
  }
}
