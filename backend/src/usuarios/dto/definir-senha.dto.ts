import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Senha definida pelo admin para uma conta de aluno ou professor.
 *
 * As regras são as mesmas que a tela de primeiro acesso mostra ao usuário —
 * senha criada pelo painel não pode ser mais fraca do que a que ele criaria
 * sozinho.
 */
export class DefinirSenhaDto {
  @ApiProperty({ example: 'Studio2026' })
  @IsString()
  @MinLength(6, { message: 'A senha precisa de pelo menos 6 caracteres' })
  @Matches(/[A-Z]/, { message: 'A senha precisa de pelo menos uma letra maiúscula' })
  @Matches(/\d/, { message: 'A senha precisa de pelo menos um número' })
  senha: string;
}
