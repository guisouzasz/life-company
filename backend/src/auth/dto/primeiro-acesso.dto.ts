import { IsString, MinLength, Matches, IsOptional } from 'class-validator';
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
  @MinLength(6)
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
}
