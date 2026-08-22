import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CriarUsuarioDto } from './criar-usuario.dto';

/**
 * Corpo do PUT /usuarios/:id.
 *
 * Existe como CLASSE de propósito. Antes a rota era tipada como
 * `Partial<CriarUsuarioDto>`, que é tipo do TypeScript e some na compilação:
 * em tempo de execução o Nest via um `Object` qualquer e o ValidationPipe
 * não conferia nada — nem tipo, nem tamanho, nem formato de CEP ou de data.
 *
 * `PartialType` repete os campos de CriarUsuarioDto com as mesmas validações,
 * todas opcionais, que é o que uma edição precisa: mandar só o campo que mudou.
 */
export class AtualizarUsuarioDto extends PartialType(CriarUsuarioDto) {
  /** Liga/desliga o cadastro. Só existe na edição, por isso não vem do criar. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
