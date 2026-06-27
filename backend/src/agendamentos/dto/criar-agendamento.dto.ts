import { IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CriarAgendamentoDto {
  @ApiProperty() @IsString() horarioId: string;
  @ApiProperty({ example: '2025-01-27' }) @IsDateString() dataAula: string;
}
