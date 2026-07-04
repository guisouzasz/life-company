import { IsEmail, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CriarUsuarioDto {
  @ApiProperty() @IsString() nome: string;
  @ApiProperty() @IsString() cpf: string;
  // Opcional: o aluno cadastra o próprio e-mail ao ativar a conta pelo app.
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() telefone?: string;
  // planoId/modalidadeId são ids de referência (os planos usam ids curtos como "p3",
  // não UUID), por isso validamos como string e não como UUID.
  @ApiProperty() @IsString() planoId: string;
  @ApiProperty() @IsString() modalidadeId: string;
}
