import { IsString, IsDateString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CriarAgendamentoDto {
  @ApiProperty() @IsString() horarioId: string;
  @ApiProperty({ example: '2025-01-27' }) @IsDateString() dataAula: string;
  @ApiProperty({ required: false, description: 'Agendar usando crédito de reposição' })
  @IsOptional()
  @IsBoolean()
  usarCredito?: boolean;
}
