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

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0];

/**
 * Texto do aviso. Muda conforme a mensalidade está por vencer ou já venceu —
 * cobrar quem ainda está no prazo com o texto de atraso soa mal.
 */
export function mensagemVencimento(params: {
  nome: string;
  vencimento: string;
  atrasado: boolean;
}): string {
  const { nome, vencimento, atrasado } = params;
  const dia = formatDate(vencimento, 'DD/MM');
  if (atrasado) {
    return (
      `Oi, ${primeiroNome(nome)}! Tudo bem? ` +
      `Passando para avisar que a sua mensalidade do ${STUDIO_NOME} venceu no dia ${dia}. ` +
      `Se você já pagou, me manda um retorno que eu registro por aqui. Obrigada!`
    );
  }
  return (
    `Oi, ${primeiroNome(nome)}! Tudo bem? ` +
    `Passando para lembrar que a sua mensalidade do ${STUDIO_NOME} vence no dia ${dia}. ` +
    `Qualquer dúvida, é só me chamar por aqui!`
  );
}

/** Link que abre a conversa com o aluno e o texto já escrito. */
export function linkWhatsapp(numeroComDdi: string, mensagem: string): string {
  return `https://wa.me/${numeroComDdi}?text=${encodeURIComponent(mensagem)}`;
}
