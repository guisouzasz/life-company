/**
 * Aviso de mensalidade pelo WhatsApp, no modo semiautomático: o app monta a
 * conversa com o texto pronto e quem envia é o admin, com um toque.
 *
 * Não usa a API oficial da Meta de propósito — ela exige número dedicado,
 * modelo de mensagem aprovado e cobrança por envio. O link wa.me funciona
 * hoje, sem custo e sem aprovação, à custa de o envio ser manual.
 */
import { STUDIO_NOME } from '../constants/app';
import { formatDate } from './date';
import { formatarReal } from './mascaras';

/** Código do país usado quando o telefone vem só com DDD + número. */
const DDI_BRASIL = '55';

/**
 * Telefone no formato que o wa.me aceita: só dígitos, com DDI.
 * Devolve null quando não dá para montar um número válido — aí o botão fica
 * desabilitado em vez de abrir uma conversa com número errado.
 */
export function telefoneParaWhatsapp(telefone?: string | null): string | null {
  const d = (telefone ?? '').replace(/\D/g, '');
  if (!d) return null;
  // 10 dígitos = DDD + fixo; 11 = DDD + celular com o 9
  if (d.length === 10 || d.length === 11) return DDI_BRASIL + d;
  // Já veio com o DDI na frente
  if ((d.length === 12 || d.length === 13) && d.startsWith(DDI_BRASIL)) return d;
  return null;
}

/**
 * "MARIA APARECIDA SOUZA" → "Maria".
 *
 * O cadastro é todo em caixa alta, e "Oi, MARIA!" numa mensagem soa como
 * grito. Vale para todos os textos daqui.
 */
const primeiroNome = (nome: string) => {
  const p = nome.trim().split(/\s+/)[0] ?? nome;
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

/**
 * Texto do aviso. Muda conforme a mensalidade está por vencer ou já venceu —
 * cobrar quem ainda está no prazo com o texto de atraso soa mal.
 */
export function mensagemVencimento(params: {
  nome: string;
  vencimento: string;
  atrasado: boolean;
  /** Valor combinado; omitido quando o estúdio ainda não definiu. */
  valor?: number | null;
}): string {
  const { nome, vencimento, atrasado, valor } = params;
  const dia = formatDate(vencimento, 'DD/MM');
  // Falar o valor evita a ida e volta de "quanto é mesmo?" — mas só quando
  // ele existe; mandar "R$ 0,00" seria pior do que não falar nada.
  const quanto = valor ? ` de ${formatarReal(valor)}` : '';
  if (atrasado) {
    return (
      `Oi, ${primeiroNome(nome)}! Tudo bem? ` +
      `Passando para avisar que a sua mensalidade${quanto} da ${STUDIO_NOME} venceu no dia ${dia}. ` +
      `Se você já pagou, me manda um retorno que eu registro por aqui. Obrigada!`
    );
  }
  return (
    `Oi, ${primeiroNome(nome)}! Tudo bem? ` +
    `Passando para lembrar que a sua mensalidade${quanto} da ${STUDIO_NOME} vence no dia ${dia}. ` +
    `Qualquer dúvida, é só me chamar por aqui!`
  );
}

/**
 * Convite do primeiro acesso, com o link já no meio do texto.
 *
 * O link é o que dá acesso à conta: quem o abrir cria a senha. Por isso o
 * texto pede para não repassar — a dona manda para o número do cadastro, e
 * o aluno precisa saber que aquilo não é para circular no grupo da turma.
 */
export function mensagemPrimeiroAcesso(params: {
  nome: string;
  link: string;
  /** Professor recebe outro texto: ele não marca aula, ele monta treino. */
  professor?: boolean;
}): string {
  const { nome, link, professor = false } = params;
  if (professor) {
    return (
      `Oi, ${primeiroNome(nome)}! Tudo bem? ` +
      `Criei o seu acesso ao sistema da ${STUDIO_NOME} — é por ele que você vê a agenda das suas aulas ` +
      `e monta os treinos dos alunos. Abra o link abaixo para criar a sua senha:\n\n${link}\n\n` +
      `O link é só seu, não precisa repassar.`
    );
  }
  return (
    `Oi, ${primeiroNome(nome)}! Tudo bem? ` +
    `Criei o seu acesso ao app da ${STUDIO_NOME} — é por ele que você marca e cancela as suas aulas. ` +
    `Abra o link abaixo para criar a sua senha:\n\n${link}\n\n` +
    `O link é só seu, não precisa repassar. Qualquer dúvida, é só me chamar por aqui!`
  );
}

/**
 * Parabéns do estúdio, assinado pela equipe.
 *
 * Assina "Equipe {estúdio}" e não a dona: quem manda pode ser ela ou quem
 * estiver na recepção, e o aluno recebe como mensagem da academia.
 *
 * A idade fica de fora de propósito — nem todo mundo gosta de ver o número,
 * e a mensagem funciona igual sem ele.
 */
export function mensagemAniversario(nome: string): string {
  return (
    `Parabéns, ${primeiroNome(nome)}! 🎉\n\n` +
    `Hoje é o seu dia, e a gente queria desejar muita saúde, alegria e treinos bons no ano que começa. ` +
    `É uma alegria ter você com a gente!\n\n` +
    `Um abraço da Equipe ${STUDIO_NOME} 💚`
  );
}

/** Link que abre a conversa com o aluno e o texto já escrito. */
export function linkWhatsapp(numeroComDdi: string, mensagem: string): string {
  return `https://wa.me/${numeroComDdi}?text=${encodeURIComponent(mensagem)}`;
}
