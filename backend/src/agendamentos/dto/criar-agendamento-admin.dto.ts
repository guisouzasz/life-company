import { IsString, IsOptional, IsBoolean } from 'class-validator';
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

  /**
   * Reposição dada pelo estúdio na hora: com `usarCredito`, cria o crédito
   * quando o aluno não tem um que valha no dia, e já o usa nesta aula.
   *
   * Antes a dona precisava sair da agenda, ir em Alunos → Créditos, dar o
   * crédito e voltar — e, sem saber disso, a tela só oferecia trocar uma
   * aula do plano, que não era o que ela queria.
   */
  @ApiProperty({ required: false, description: 'Com usarCredito: dá o crédito se faltar e já usa nesta aula' })
  @IsOptional()
  @IsBoolean()
  concederCredito?: boolean;
}
