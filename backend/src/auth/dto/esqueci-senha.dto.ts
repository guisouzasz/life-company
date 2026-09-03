import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EsqueciSenhaDto {
  @ApiProperty({ example: 'maria@gmail.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email: string;
}
