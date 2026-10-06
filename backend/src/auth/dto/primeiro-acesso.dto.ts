import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PrimeiroAcessoDto {
  @ApiProperty({ example: 'uuid-do-token' })
  @IsString()
  token: string;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  cpf: string;

  @ApiProperty({ example: 'minhasenha123' })
  @IsString()
  // A mesma régua da tela (e da troca de senha): sem ela no servidor, quem
  // montasse o pedido fora do app criaria a conta com "123456".
  @MinLength(6, { message: 'A senha precisa de pelo menos 6 caracteres' })
  @MaxLength(72, { message: 'A senha pode ter no máximo 72 caracteres' })
  @Matches(/[A-Z]/, { message: 'A senha precisa de pelo menos uma letra maiúscula' })
  @Matches(/\d/, { message: 'A senha precisa de pelo menos um número' })
  senha: string;

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

  /*
    A ficha cadastral. Vale para os dois caminhos de ativação — com link e
    sem link — porque o cadastro feito pela dona agora pede só nome e CPF.
    Opcionais aqui e exigidas no serviço quando quem ativa é ALUNO: professor
    e admin usam a mesma rota e não têm ficha de matrícula.
  */
  @ApiProperty({ required: false, example: 'maria@gmail.com' })
  @IsOptional() @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: '11999998888' })
  @IsOptional() @IsString() @MinLength(10, { message: 'Telefone precisa do DDD' }) @MaxLength(20)
  telefone?: string;

  @ApiProperty({ required: false, example: '12.345.678-9' })
  @IsOptional() @IsString() @MinLength(5) @MaxLength(20)
  rg?: string;

  @ApiProperty({ required: false, example: 'Rua das Flores, 100, Centro' })
  @IsOptional() @IsString() @MinLength(5) @MaxLength(200)
  endereco?: string;

  @ApiProperty({ required: false, example: '01001-000' })
  @IsOptional() @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP deve ter 8 dígitos (00000-000)' })
  cep?: string;

  @ApiProperty({ required: false, example: '1995-05-20', description: 'YYYY-MM-DD' })
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de nascimento deve estar em YYYY-MM-DD' })
  dataNascimento?: string;
}
