import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Troca de senha por quem já está logado.
 *
 * Pede a senha ATUAL de propósito: sem isso, um celular esquecido destrancado
 * na recepção viraria acesso permanente à conta da dona.
 *
 * As regras da nova senha são as mesmas da tela de primeiro acesso — a senha
 * trocada aqui não pode ser mais fraca do que a que a pessoa criaria lá.
 */
export class AlterarSenhaDto {
  @ApiProperty({ example: 'minhaSenhaAtual1' })
  @IsString()
  senhaAtual: string;

  @ApiProperty({ example: 'MinhaSenhaNova2' })
  @IsString()
  @MinLength(6, { message: 'A senha precisa de pelo menos 6 caracteres' })
  @Matches(/[A-Z]/, { message: 'A senha precisa de pelo menos uma letra maiúscula' })
  @Matches(/\d/, { message: 'A senha precisa de pelo menos um número' })
  novaSenha: string;
}
