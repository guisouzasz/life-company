import { Controller, Post, Body, Get, Delete, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PrimeiroAcessoDto } from './dto/primeiro-acesso.dto';
import { AtivarContaDto } from './dto/ativar-conta.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Rotas de autenticação são públicas, então levam um limite bem mais apertado
 * que o teto global: 8 tentativas por minuto por IP em login e ativação, o
 * que impede varredura de CPF/senha sem incomodar quem só errou a senha.
 */
const LIMITE_TENTATIVAS = { default: { limit: 8, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Throttle(LIMITE_TENTATIVAS)
  @ApiOperation({ summary: 'Login com email e senha' })
  login(@Body() dto: LoginDto) { return this.authService.login(dto); }

  @Post('primeiro-acesso')
  @Throttle(LIMITE_TENTATIVAS)
  @ApiOperation({ summary: 'Ativar conta no primeiro acesso (via link/token)' })
  primeiroAcesso(@Body() dto: PrimeiroAcessoDto) { return this.authService.primeiroAcesso(dto); }

  @Post('ativar-conta')
  @Throttle(LIMITE_TENTATIVAS)
  @ApiOperation({ summary: 'Ativar conta com CPF + e-mail (sem link)' })
  ativarConta(@Body() dto: AtivarContaDto) { return this.authService.ativarConta(dto); }

  @Post('refresh')
  @ApiOperation({ summary: 'Renovar access token' })
  refresh(@Body('refreshToken') token: string) { return this.authService.refreshToken(token); }

  @Post('logout')
  logout(@Body('refreshToken') token: string) { return this.authService.logout(token); }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@Request() req) { return this.authService.me(req.user.id); }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Excluir a própria conta (remove dados pessoais)' })
  excluirMinhaConta(@Request() req) { return this.authService.excluirMinhaConta(req.user.id); }
}
