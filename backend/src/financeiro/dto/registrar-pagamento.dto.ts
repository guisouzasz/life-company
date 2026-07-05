import { IsIn, IsNumber, IsOptional, IsPositive, IsString, Matches } from 'class-validator';

export class RegistrarPagamentoDto {
  @IsString()
  usuarioId: string;

  @IsNumber()
  @IsPositive()
  valor: number;

  /** Mês de competência no formato YYYY-MM (default: mês atual). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'referencia deve estar no formato YYYY-MM' })
  referencia?: string;

  @IsOptional()
  @IsIn(['PIX', 'DINHEIRO', 'CARTAO', 'OUTRO'])
  formaPagamento?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
