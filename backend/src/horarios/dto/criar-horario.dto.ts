import { IsString, IsEnum, IsInt, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CriarHorarioDto {
  @ApiProperty() @IsString() modalidadeId: string;
  @ApiProperty({ enum: ['SEGUNDA','TERCA','QUARTA','QUINTA','SEXTA'] }) @IsEnum(['SEGUNDA','TERCA','QUARTA','QUINTA','SEXTA']) diaSemana: string;
  @ApiProperty({ example: '07:00' }) @IsString() horaInicio: string;
  @ApiProperty({ example: '08:00' }) @IsString() horaFim: string;
  @ApiProperty({ default: 4 }) @IsOptional() @IsInt() @Min(1) @Max(20) capacidadeMaxima?: number;
  @ApiProperty({ default: true }) @IsOptional() @IsBoolean() ativo?: boolean;
}

export class AtualizarHorarioDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() modalidadeId?: string;
  @ApiProperty({ enum: ['SEGUNDA','TERCA','QUARTA','QUINTA','SEXTA'], required: false }) @IsOptional() @IsEnum(['SEGUNDA','TERCA','QUARTA','QUINTA','SEXTA']) diaSemana?: string;
  @ApiProperty({ example: '07:00', required: false }) @IsOptional() @IsString() horaInicio?: string;
  @ApiProperty({ example: '08:00', required: false }) @IsOptional() @IsString() horaFim?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) @Max(20) capacidadeMaxima?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() ativo?: boolean;
}
