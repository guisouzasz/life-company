import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
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

  /*
    Opcional aqui e exigido no serviço para ALUNO, junto com o resto da ficha.
    Deixá-lo obrigatório no DTO fazia o pedido morrer antes, com o "email must
    be an email" cru do validador — em inglês e sem dizer que faltavam também
    telefone, RG, endereço e CEP.
  */
  @ApiProperty({ required: false, example: 'maria@gmail.com', description: 'E-mail escolhido pelo aluno (fica salvo no cadastro)' })
  @IsOptional() @IsEmail()
  email?: string;

  @ApiProperty({ example: 'minhasenha123' })
  @IsString()
  @MinLength(6)
  senha: string;

  /*
    A ficha cadastral saiu do balcão e veio para cá.

    Quem sabe o próprio RG, endereço e telefone é o aluno — a dona não tem
    esses dados na mão quando ele chega no estúdio. Aqui é o momento em que
    quem digita é o dono do dado.

    Opcionais no DTO e exigidos no serviço quando quem ativa é ALUNO, igual ao
    `termoVersao` logo abaixo: professor e admin ativam por esta mesma rota e
    não têm ficha de matrícula.
  */
  @ApiProperty({ required: false, example: '11999998888' })
  @IsOptional() @IsString() @MinLength(10, { message: 'Telefone precisa do DDD' }) @MaxLength(20)
  telefone?: string;

  @ApiProperty({ required: false, example: '12.345.678-9' })
  @IsOptional() @IsString() @MinLength(5) @MaxLength(20)
  rg?: string;

  @ApiProperty({ required: false, example: 'Rua das Flores, 100, Centro, São Paulo' })
  @IsOptional() @IsString() @MinLength(5) @MaxLength(200)
  endereco?: string;

  @ApiProperty({ required: false, example: '01001-000' })
  @IsOptional() @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP deve ter 8 dígitos (00000-000)' })
  cep?: string;

  @ApiProperty({ required: false, example: '1995-05-20', description: 'YYYY-MM-DD' })
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de nascimento deve estar em YYYY-MM-DD' })
  dataNascimento?: string;

  /**
   * Versão do termo que o aluno declarou aceitar.
   *
   * Opcional no DTO, obrigatório no serviço quando quem ativa é ALUNO:
   * professor e admin ativam pela mesma rota e não assinam o termo do aluno.
   * A versão precisa bater com a vigente — aceite de texto antigo não vale.
   */
  @ApiProperty({ required: false, example: '2026-08-27', description: 'Versão do termo aceito (obrigatória para ALUNO)' })
  @IsOptional()
  @IsString()
  termoVersao?: string;
}
