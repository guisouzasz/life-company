import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FecharDiaDto {
  @ApiProperty({ example: '2026-10-12' }) @IsDateString() data: string;

  @ApiProperty({ required: false, example: 'Feriado' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  motivo?: string;

  /**
   * Recesso de fim de ano (Termo, seção 4): cada aula do plano que o aluno
   * teria no dia vira um crédito extra. Sem isto é feriado: a aula sai sem
   * reposição (seção 3).
   */
  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  recesso?: boolean;
}
