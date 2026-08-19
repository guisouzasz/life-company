/** Constantes de marca/configuração do app (não vêm da API). */

/**
 * Nome do estúdio como ele aparece para o aluno e na barra do painel.
 *
 * O nome é feminino ("a Academia"), e as mensagens de cobrança do WhatsApp
 * dizem "da ${STUDIO_NOME}" — se um dia isto virar um nome masculino, os
 * artigos em services/whatsapp.ts precisam mudar junto.
 */
export const STUDIO_NOME = 'Academia Life Company';

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
 * Qualquer domínio de e-mail é aceito na ativação — inclusive domínio
 * próprio, como o do estúdio. Da lista fechada de provedores que existia
 * aqui sobrou só o que ela de fato pegava: erro de digitação nos provedores
 * grandes, onde o aluno erra e não percebe.
 *
 * Espelha auth/dto/ativar-conta.dto.ts no backend — manter as duas em
 * sincronia. A do backend é a que vale; esta só adianta o aviso na tela.
 */
const DOMINIOS_COM_ERRO_DE_DIGITACAO: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'htomail.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outook.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'iclound.com': 'icloud.com',
  'iclod.com': 'icloud.com',
  'icloud.con': 'icloud.com',
};

/**
 * Erro a mostrar para o e-mail informado, ou null quando ele serve.
 * Só reclama de engano evidente — nunca de domínio que apenas não conhece.
 */
export function erroDeEmail(email: string): string | null {
  const dominio = email.trim().toLowerCase().split('@')[1] ?? '';
  const certo = DOMINIOS_COM_ERRO_DE_DIGITACAO[dominio];
  return certo ? `Parece engano de digitação: você quis dizer @${certo}?` : null;
}
