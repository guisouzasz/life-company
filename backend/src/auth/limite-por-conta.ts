import { ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';

/**
 * Limite de tentativas por CONTA nas portas de entrada (login e ativação).
 *
 * Só por IP não dava: o Wi-Fi da academia é um IP só, e uma turma inteira
 * entrando no app ao mesmo tempo — exatamente o que acontece no dia em que a
 * dona manda o link — passava das 8 tentativas por minuto e o resto da turma
 * levava "muitas tentativas" sem ter errado nada.
 *
 * Agora são dois limites:
 *  - este, 8 por minuto para a MESMA conta vinda do mesmo IP — é o que segura
 *    quem tenta adivinhar a senha de alguém, igual ao que valia antes;
 *  - o de cada rota (`@Throttle`), mais largo, por IP — é o teto para quem
 *    varre contas diferentes da mesma rede.
 */
const CHAVE = 'limite-por-conta';

/** Marca a rota para contar tentativas por conta (além do limite por IP). */
export const LimitePorConta = () => SetMetadata(CHAVE, true);

/** A conta da tentativa: o link do primeiro acesso, ou o e-mail/CPF digitado. */
function contaDa(corpo: any): string {
  const bruto = String(corpo?.token ?? corpo?.email ?? corpo?.cpf ?? '').trim().toLowerCase();
  // "123.456.789-09" e "12345678909" são a mesma pessoa.
  const digitos = bruto.replace(/\D/g, '');
  if (/^[\d.\-\s]+$/.test(bruto) && digitos.length === 11) return digitos;
  return bruto.slice(0, 200);
}

export const LIMITE_POR_CONTA: ThrottlerOptions = {
  name: 'conta',
  limit: 8,
  ttl: 60_000,
  // Só vale nas rotas marcadas; no resto do app, nada muda.
  skipIf: (ctx: ExecutionContext) => !Reflect.getMetadata(CHAVE, ctx.getHandler()),
  getTracker: (req) => `${req.ip}|${contaDa(req.body)}`,
};
