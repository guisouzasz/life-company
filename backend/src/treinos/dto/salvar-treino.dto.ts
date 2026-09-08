import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ExercicioDto {
  /** Grupo muscular: "Pernas", "Peitoral"... (opcional). */
  @IsOptional() @IsString()
  grupo?: string;

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

  /**
   * Observação sobre o ALUNO: dor, incômodo, cirurgia, limitação.
   *
   * Vale para esta ficha e aparece no alto dela, logo abaixo do título — quem
   * vai conduzir a série precisa ler isto antes de começar, não depois.
   */
  @IsOptional() @IsString()
  observacoes?: string;

  // ── Metadados da ficha (opcionais) ─────────────────────────────────
  /**
   * Professor responsável pela ficha.
   *
   * Ausente, fica quem está montando — que era o comportamento antigo e segue
   * valendo. Existe porque quem monta nem sempre é quem acompanha: a dona
   * cadastra pelo painel e o treino é do professor da musculação.
   */
  @IsOptional() @IsString()
  professorId?: string;

  /** Vencimento em YYYY-MM-DD (ou vazio para sem prazo). */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'vencimento deve ser YYYY-MM-DD' })
  vencimento?: string;

  @IsOptional() @IsString()
  frequencia?: string;

  /**
   * Legado: o app não envia mais pausa entre séries nem velocidade de
   * execução. Continuam aceitos (e ignorados) para não quebrar versões
   * antigas instaladas — o ValidationPipe roda com forbidNonWhitelisted.
   */
  @IsOptional() @IsString()
  pausaSeries?: string;

  @IsOptional() @IsString()
  velocidade?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ExercicioDto)
  exercicios?: ExercicioDto[];
}
