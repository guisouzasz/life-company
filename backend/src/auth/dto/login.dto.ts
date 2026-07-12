import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  /** Aceita e-mail ou CPF (o service decide pela forma do valor). */
  @ApiProperty({ example: 'maria@email.com', description: 'E-mail ou CPF' })
  @IsString()
  @MinLength(3)
  email: string;

  @ApiProperty({ example: 'aluno123' })
  @IsString()
  @MinLength(6)
  senha: string;
}
