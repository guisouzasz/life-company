import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CriarAgendamentoDto } from './criar-agendamento.dto';

/**
 * O estúdio colocando um aluno numa aula.
 *
 * Herda horarioId/dataAula de `CriarAgendamentoDto` e acrescenta de quem é a
 * aula — no fluxo do aluno isso vem do token, aqui vem do corpo.
 */
export class CriarAgendamentoAdminDto extends CriarAgendamentoDto {
  @ApiProperty({ description: 'Aluno que vai entrar na aula' })
  @IsString()
  usuarioId: string;

  /**
   * Aula da MESMA semana que sai para esta entrar.
   *
   * É o remanejamento: o aluno de plano 1x já tem quinta às 19h e a dona quer
   * ele na sexta às 17h. Sem isto ela esbarra no limite semanal e precisa
   * desmarcar em outra tela antes de voltar aqui.
   */
  @ApiProperty({ required: false, description: 'Desmarca esta aula (sem crédito) para liberar a vaga da semana' })
  @IsOptional()
  @IsString()
  substituirAgendamentoId?: string;
}
