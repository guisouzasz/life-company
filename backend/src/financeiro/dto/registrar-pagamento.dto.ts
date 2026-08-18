import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class RegistrarPagamentoDto {
  @IsString()
  usuarioId: string;

  /** Mês de competência no formato YYYY-MM (default: mês atual). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'referencia deve estar no formato YYYY-MM' })
  referencia?: string;

  @IsOptional()
  @IsString()
  observacao?: string;

  /** Quanto entrou. Sem isto, vale a mensalidade cadastrada do aluno. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor?: number;
}
