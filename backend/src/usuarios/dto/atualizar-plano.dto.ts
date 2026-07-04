import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AtualizarPlanoDto {
  @ApiProperty() @IsString() planoId: string;
  @ApiProperty() @IsString() modalidadeId: string;
}
