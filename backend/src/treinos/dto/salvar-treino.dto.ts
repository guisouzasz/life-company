import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ExercicioDto {
  @IsString() @MinLength(2)
  nome: string;

  @IsOptional() @IsInt() @Min(1) @Max(20)
  series?: number;

  @IsOptional() @IsString()
  repeticoes?: string;

  @IsOptional() @IsString()
  carga?: string;

  @IsOptional() @IsString()
  observacao?: string;
}

export class SalvarTreinoDto {
  @IsString()
  alunoId: string;

  @IsString() @MinLength(2)
  titulo: string;

  /** Treino em texto livre (Funcional/Pilates). Exige conteudo OU exercicios. */
  @IsOptional() @IsString() @MinLength(3)
  conteudo?: string;

  @IsOptional() @IsString()
  observacoes?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ExercicioDto)
  exercicios?: ExercicioDto[];
}
