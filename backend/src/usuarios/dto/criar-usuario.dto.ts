import { IsEmail, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CriarUsuarioDto {
  @ApiProperty() @IsString() nome: string;
  @ApiProperty() @IsString() cpf: string;
  // Opcional: o aluno cadastra o próprio e-mail ao ativar a conta pelo app.
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() telefone?: string;
  // ALUNO (default) ou PROFESSOR (sem plano; acesso só à agenda e treinos).
  @ApiProperty({ required: false, enum: ['ALUNO', 'PROFESSOR'] })
  @IsOptional() @IsIn(['ALUNO', 'PROFESSOR']) tipoUsuario?: string;
  // planoId/modalidadeId são ids de referência (os planos usam ids curtos como "p3",
  // não UUID), por isso validamos como string e não como UUID.
  // Obrigatórios para ALUNO; ignorados para PROFESSOR (validado no service).
  @ApiProperty({ required: false }) @IsOptional() @IsString() planoId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() modalidadeId?: string;
}
