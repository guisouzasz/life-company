import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * A ficha de anamnese como o estúdio a reescreveu.
 *
 * As listas (objetivos, patologias, PAR-Q, regiões de dor) chegam como array e
 * são gravadas em JSON. O conteúdo não é validado contra as opções da tela de
 * propósito: são respostas de saúde declaradas pelo aluno, o estúdio pode
 * reescrever uma pergunta amanhã, e recusar a ficha inteira porque um texto
 * mudou de vírgula seria pior do que aceitá-la. O que se limita é o tamanho —
 * é o que protege o banco.
 *
 * Os campos `sim/não` são booleanos separados do texto ao lado. Sem eles,
 * "não tenho lesão" e "não respondi" ficariam idênticos: os dois em branco.
 */
export class SalvarAnamneseDto {
  // ── Identificação ──────────────────────────────────────────────────
  @ApiProperty({ required: false, example: 'Maria Souza (mãe)' })
  @IsOptional() @IsString() @MaxLength(120)
  contatoEmergenciaNome?: string;

  @ApiProperty({ required: false, example: '41999998888' })
  @IsOptional() @IsString() @MaxLength(30)
  contatoEmergenciaTelefone?: string;

  // ── Objetivos e rotina ─────────────────────────────────────────────
  /**
   * Até 2, como o documento pede. O limite está aqui e não só na tela: a
   * regra é do estúdio, e uma versão antiga do app não deve poder furá-la.
   */
  @ApiProperty({ required: false, type: [String], maxItems: 2 })
  @IsOptional() @IsArray() @ArrayMaxSize(2)
  @IsString({ each: true }) @MaxLength(120, { each: true })
  objetivos?: string[];

  @ApiProperty({ required: false, example: 'Já treino regularmente (praticante ativo)' })
  @IsOptional() @IsString() @MaxLength(120)
  experiencia?: string;

  // ── Fatores da profissão ───────────────────────────────────────────
  @ApiProperty({ required: false, example: 'Professora' })
  @IsOptional() @IsString() @MaxLength(120)
  profissao?: string;

  @ApiProperty({ required: false, example: 'Em pé em movimento/caminhando' })
  @IsOptional() @IsString() @MaxLength(120)
  posturaPredominante?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  movimentosRepetitivos?: boolean;

  @ApiProperty({ required: false, example: 'Digitar e usar o mouse o dia inteiro' })
  @IsOptional() @IsString() @MaxLength(500)
  movimentosRepetitivosQuais?: string;

  // ── Patologias ─────────────────────────────────────────────────────
  @ApiProperty({ required: false, type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @IsString({ each: true }) @MaxLength(160, { each: true })
  patologias?: string[];

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(300)
  patologiaOutra?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  usaMedicamento?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(500)
  medicamentos?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  fezCirurgia?: boolean;

  @ApiProperty({ required: false, example: 'Ligamento do joelho direito, em 2022' })
  @IsOptional() @IsString() @MaxLength(500)
  cirurgiaQual?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  temLesao?: boolean;

  @ApiProperty({ required: false, example: 'Tendinite no ombro esquerdo' })
  @IsOptional() @IsString() @MaxLength(500)
  lesoes?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  temDor?: boolean;

  @ApiProperty({ required: false, example: 'Dor lombar ao final do dia' })
  @IsOptional() @IsString() @MaxLength(500)
  dores?: string;

  /** Ids das regiões marcadas no boneco: ["ombro-d", "lombar"]. */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(30)
  @IsString({ each: true }) @MaxLength(40, { each: true })
  regioesDor?: string[];

  // ── PAR-Q resumido ─────────────────────────────────────────────────
  @ApiProperty({ required: false, type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(10)
  @IsString({ each: true }) @MaxLength(300, { each: true })
  parq?: string[];

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(1000)
  observacoes?: string;
}
