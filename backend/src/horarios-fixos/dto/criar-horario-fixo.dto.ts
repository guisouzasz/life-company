import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CriarHorarioFixoDto {
  @ApiProperty() @IsString() horarioId: string;
  @ApiProperty({ required: false, description: 'Default: hoje' }) @IsOptional() @IsDateString() dataInicio?: string;
  @ApiProperty({ required: false, description: 'Default: sem prazo' }) @IsOptional() @IsDateString() dataFim?: string;
}
