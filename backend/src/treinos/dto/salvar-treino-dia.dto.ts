import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class SalvarTreinoDiaDto {
  /** Dia do treino (YYYY-MM-DD). */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'data deve estar no formato YYYY-MM-DD' })
  data: string;

  /** Texto livre do treino, igual para todas as aulas do dia. */
  @IsString() @MinLength(3)
  conteudo: string;

  /** Só para admin (professor usa a própria modalidade). */
  @IsOptional() @IsString()
  modalidadeId?: string;
}
