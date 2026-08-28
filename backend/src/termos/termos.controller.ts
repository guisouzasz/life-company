import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TERMO } from './termo';

/**
 * Rota pública de propósito: quem lê o termo ainda não tem conta — está na
 * tela de primeiro acesso, e é justamente o aceite aqui que libera criar a
 * senha.
 */
@ApiTags('termos')
@Controller('termos')
export class TermosController {
  @Get()
  @ApiOperation({ summary: 'Termo vigente do estúdio (público)' })
  vigente() {
    return TERMO;
  }
}
