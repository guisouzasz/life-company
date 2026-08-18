import { IsInt, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';

/** Mensalidade do aluno: quando vence e quanto é. */
export class ConfigurarAlunoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  diaVencimento?: number;

  /**
   * Valor combinado com este aluno. `null` limpa — é assim que a dona desfaz
   * um valor lançado por engano, sem precisar apagar o aluno.
   */
  @IsOptional()
  @ValidateIf((_, valor) => valor !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999)
  valorMensalidade?: number | null;
}
