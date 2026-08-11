import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SalvarAnamneseDto {
  @ApiProperty({ required: false, example: 'Emagrecimento' })
  @IsOptional() @IsString() @MaxLength(80)
  objetivo?: string;

  @ApiProperty({ required: false, example: 'Sedentário' })
  @IsOptional() @IsString() @MaxLength(80)
  nivelAtividade?: string;

  @ApiProperty({ required: false, example: 'Hipertensão controlada' })
  @IsOptional() @IsString() @MaxLength(500)
  problemasSaude?: string;

  @ApiProperty({ required: false, example: 'Cirurgia no joelho direito em 2022' })
  @IsOptional() @IsString() @MaxLength(500)
  lesoes?: string;

  @ApiProperty({ required: false, example: 'Dor lombar ao final do dia' })
  @IsOptional() @IsString() @MaxLength(500)
  dores?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(500)
  medicamentos?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(500)
  alergias?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  gestante?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  fumante?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  liberacaoMedica?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(1000)
  observacoes?: string;
}
