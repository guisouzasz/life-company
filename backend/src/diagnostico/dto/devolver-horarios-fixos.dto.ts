import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class DevolverHorariosFixosDto {
  /**
   * Exatamente quais horários fixos devolver — os ids que a conferência
   * mostrou e o dono marcou na tela.
   *
   * A lista é obrigatória de propósito. A versão anterior devolvia TODOS os
   * fixos desligados de quem treina, e isso trazia junto o horário que a dona
   * tinha removido de propósito semanas antes: a tabela não guarda quando cada
   * um foi desligado, então "engano" e "decisão" têm exatamente a mesma cara.
   * Exigir a escolha transfere para quem sabe a resposta a única pergunta que
   * o banco não sabe responder.
   *
   * O teto de 200 é para uma marcação acidental de "tudo" não virar uma
   * escrita gigante — nenhum estúdio marca 200 horários de uma vez de caso
   * pensado.
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'Marque pelo menos um aluno para devolver' })
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids: string[];
}
