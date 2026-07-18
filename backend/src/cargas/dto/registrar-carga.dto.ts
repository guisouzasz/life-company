import { IsNumber, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';

export class RegistrarCargaDto {
  @IsString()
  alunoId: string;

  /** Nome do exercício, como aparece no treino. */
  @IsString() @MinLength(2)
  exercicio: string;

  /** Carga em kg (aceita meio quilo: 22.5). */
  @IsNumber() @Min(0) @Max(1000)
  peso: number;

  @IsOptional() @IsString()
  repeticoes?: string;

  @IsOptional() @IsString()
  observacao?: string;

  /** Dia do treino (YYYY-MM-DD). Default: hoje. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'data deve estar no formato YYYY-MM-DD' })
  data?: string;
}
