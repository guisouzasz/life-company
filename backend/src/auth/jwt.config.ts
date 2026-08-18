import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

/**
 * Segredo que assina e confere os tokens de acesso.
 *
 * Antes, cada um dos três pontos que precisavam dele caía num literal —
 * `'studio-jwt-secret-dev'` — quando a variável não estava definida. Esse
 * literal está no código-fonte: se a API subisse sem JWT_SECRET, ela
 * continuaria funcionando normalmente, assinando tokens com um segredo que
 * qualquer pessoa com acesso ao repositório consegue ler. Daria para forjar
 * um token de administrador e entrar como a dona.
 *
 * O risco não era teórico: é exatamente o que aconteceria ao tirar o .env do
 * versionamento e esquecer de definir a variável na Railway. Agora, nesse
 * caso, a API se recusa a subir — a Railway mantém a versão anterior no ar, e
 * a falha aparece no log em vez de virar uma porta aberta.
 */

/** Curto demais é adivinhável; 32 é o tamanho de um uuid sem hífens. */
const TAMANHO_RECOMENDADO = 32;

const logger = new Logger('JwtConfig');
let jaAvisou = false;

export function segredoJwt(config?: ConfigService): string {
  const valor = (config?.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET ?? '').trim();

  if (!valor) {
    throw new Error(
      'JWT_SECRET não está definido. Defina a variável de ambiente antes de subir a API ' +
        '(na Railway: Variables). Sem ela a API não sobe — de propósito: o que existia ' +
        'no lugar era um segredo fixo, publicado no código.',
    );
  }

  // Curto é fraco, mas não é o mesmo que publicado. Derrubar a API por causa
  // do comprimento tiraria o estúdio do ar por algo que dá para corrigir com
  // calma — então aqui é aviso, não erro.
  if (valor.length < TAMANHO_RECOMENDADO && !jaAvisou) {
    jaAvisou = true;
    logger.warn(
      `JWT_SECRET tem ${valor.length} caracteres; o recomendado é pelo menos ` +
        `${TAMANHO_RECOMENDADO}. Um segredo curto é adivinhável — troque quando puder.`,
    );
  }
  return valor;
}
