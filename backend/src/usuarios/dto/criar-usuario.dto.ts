import { IsEmail, IsString, IsOptional, IsIn, IsInt, IsNumber, Matches, Max, Min, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CriarUsuarioDto {
  @ApiProperty() @IsString() nome: string;
  @ApiProperty() @IsString() cpf: string;
  // Opcional aqui e obrigatório para ALUNO (validado no service): o cadastro de
  // PROFESSOR sai só com nome e CPF.
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() telefone?: string;

  // ── Ficha cadastral do aluno (também exigida no service) ────────────
  /** RG como consta no documento — o formato varia de estado para estado. */
  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MinLength(5) @MaxLength(20)
  rg?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MinLength(5) @MaxLength(200)
  endereco?: string;

  /** 8 dígitos, com ou sem hífen. */
  @ApiProperty({ required: false })
  @IsOptional() @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP deve ter 8 dígitos (00000-000)' })
  cep?: string;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataNascimento deve estar em YYYY-MM-DD' })
  dataNascimento?: string;

  // ALUNO (default) ou PROFESSOR (sem plano; acesso só à agenda e treinos).
  @ApiProperty({ required: false, enum: ['ALUNO', 'PROFESSOR'] })
  @IsOptional() @IsIn(['ALUNO', 'PROFESSOR']) tipoUsuario?: string;
  // planoId/modalidadeId são ids de referência (os planos usam ids curtos como "p3",
  // não UUID), por isso validamos como string e não como UUID.
  // Obrigatórios para ALUNO; ignorados para PROFESSOR (validado no service).
  // ── Mensalidade (só ALUNO) ──────────────────────────────────────────
  /**
   * Valor combinado com este aluno. Fica aqui, e não no plano, porque o preço
   * é caso a caso; preenchido no cadastro, o aluno já nasce contando no
   * previsto do mês em vez de aparecer como "sem valor definido".
   */
  @ApiProperty({ required: false })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99999)
  valorMensalidade?: number;

  @ApiProperty({ required: false, description: 'Dia do vencimento (1 a 28)' })
  @IsOptional() @IsInt() @Min(1) @Max(28)
  diaVencimento?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsString() planoId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() modalidadeId?: string;
}
