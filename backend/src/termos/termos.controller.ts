import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TERMO } from './termo';
import { TermosService } from './termos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class AceitarTermoDto {
  @IsString()
  versao: string;
}

@ApiTags('termos')
@Controller('termos')
export class TermosController {
  constructor(private service: TermosService) {}

  /**
   * Pública de propósito: quem lê o termo pela primeira vez ainda não tem
   * conta — está na tela de primeiro acesso, e é o aceite aqui que libera
   * criar a senha.
   */
  @Get()
  @ApiOperation({ summary: 'Termo vigente do estúdio (público)' })
  vigente() {
    return TERMO;
  }

  @Get('meu')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Se o aluno logado ainda precisa aceitar o termo' })
  meu(@Request() req) {
    return this.service.situacao(req.user.id);
  }

  @Post('aceitar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar o aceite do aluno logado' })
  aceitar(@Request() req, @Body() dto: AceitarTermoDto) {
    return this.service.aceitar(req.user.id, dto.versao);
  }
}
