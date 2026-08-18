import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Qualquer domínio é aceito na ativação.
 *
 * Antes valia uma lista fechada de provedores, para barrar e-mail inventado.
 * Ela barrava junto quem tem e-mail de domínio próprio — o do estúdio,
 * inclusive — e não havia como cadastrar. Como o e-mail é identificador de
 * login e não canal de aviso (quem avisa é o WhatsApp), a lista custava mais
 * do que protegia.
 *
 * Do intuito original sobra só o que ele de fato pegava: erro de digitação
 * nos provedores grandes, onde o aluno erra e não percebe. Domínio
 * desconhecido passa; "gmial.com" não.
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

export class AtivarContaDto {
  @ApiProperty({ example: '12345678901' })
  @IsString()
  cpf: string;

  @ApiProperty({ example: 'maria@gmail.com', description: 'E-mail escolhido pelo aluno (fica salvo no cadastro)' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'minhasenha123' })
  @IsString()
  @MinLength(6)
  senha: string;
}
