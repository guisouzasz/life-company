import { IsEmail, IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CriarUsuarioDto {
  @ApiProperty() @IsString() nome: string;
  @ApiProperty() @IsString() cpf: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() telefone?: string;
  @ApiProperty() @IsUUID() planoId: string;
  @ApiProperty() @IsUUID() modalidadeId: string;
}
