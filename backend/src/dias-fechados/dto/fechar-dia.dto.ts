import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FecharDiaDto {
  @ApiProperty({ example: '2026-10-12' }) @IsDateString() data: string;

  @ApiProperty({ required: false, example: 'Feriado' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  motivo?: string;
}
