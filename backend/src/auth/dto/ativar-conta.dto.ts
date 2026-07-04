import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Provedores de e-mail aceitos na ativação (evita e-mails inventados/typos). */
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
