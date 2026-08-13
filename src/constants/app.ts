/** Constantes de marca/configuração do app (não vêm da API). */
export const STUDIO_NOME = 'Studio Life Company';

/**
 * Prazo para usar um crédito de reposição, em dias. Usado nos textos que
 * explicam o cancelamento ao aluno.
 *
 * Quem decide o prazo de verdade é o backend, ao gravar a data de expiração
 * do crédito; este valor existe só para o texto bater com a regra. Espelha
 * DIAS_VALIDADE_CREDITO em backend/src/creditos/creditos.constantes.ts —
 * manter os dois em sincronia.
 */
export const DIAS_VALIDADE_CREDITO = 30;

export const DIAS_PT: Record<string, string> = {
  SEGUNDA: 'Segunda',
  TERCA: 'Terça',
  QUARTA: 'Quarta',
  QUINTA: 'Quinta',
  SEXTA: 'Sexta',
};

/**
 * Provedores de e-mail aceitos na ativação de conta (espelha a lista do
 * backend em auth/dto/ativar-conta.dto.ts — manter as duas em sincronia).
 */
export const DOMINIOS_EMAIL_PERMITIDOS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'outlook.com.br',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'yahoo.com',
  'yahoo.com.br',
  'ymail.com',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
  'globo.com',
  'proton.me',
  'protonmail.com',
];
