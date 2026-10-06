import { Controller, Post, Body, Get, Delete, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AlterarSenhaDto } from './dto/alterar-senha.dto';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { PrimeiroAcessoDto } from './dto/primeiro-acesso.dto';
import { AtivarContaDto } from './dto/ativar-conta.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LimitePorConta } from './limite-por-conta';

/**
 * Rotas de autenticação são públicas, então levam limites bem mais apertados
 * que o teto global: 8 tentativas por minuto para a mesma conta
 * (`@LimitePorConta`) e um teto por IP para quem varre contas diferentes.
 *
 * O teto por IP já foi 8 e barrava gente honesta: no Wi-Fi da academia todo
 * mundo sai pelo mesmo IP. 30 por minuto deixa uma turma entrar junta e
 * ainda segura varredura de CPF/senha.
 */
const LIMITE_POR_REDE = { default: { limit: 30, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Throttle(LIMITE_POR_REDE)
  @LimitePorConta()
  @ApiOperation({ summary: 'Login com email e senha' })
  login(@Body() dto: LoginDto) { return this.authService.login(dto); }

  @Post('primeiro-acesso')
  @Throttle(LIMITE_POR_REDE)
  @LimitePorConta()
  @ApiOperation({ summary: 'Ativar conta no primeiro acesso (via link/token)' })
  primeiroAcesso(@Body() dto: PrimeiroAcessoDto) { return this.authService.primeiroAcesso(dto); }

  @Post('ativar-conta')
  @Throttle(LIMITE_POR_REDE)
  @LimitePorConta()
  @ApiOperation({ summary: 'Ativar conta com CPF + e-mail (sem link)' })
  ativarConta(@Body() dto: AtivarContaDto) { return this.authService.ativarConta(dto); }

  /*
    Limite bem apertado: é rota pública que dispara e-mail. Sem isso, alguém
    de fora poderia usá-la para encher a caixa de um aluno.
  */
  @Post('esqueci-senha')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Pedir o link de redefinir senha por e-mail' })
  esqueciSenha(@Body() dto: EsqueciSenhaDto) {
    return this.authService.esqueciMinhaSenha(dto.email);
  }

  /*
    Pede a senha atual: com um token roubado, dá para tentar adivinhá-la e
    trancar o dono fora da conta. O limite segura isso.
  */
  @Post('alterar-senha')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trocar a própria senha (sabendo a atual)' })
  alterarSenha(@Request() req, @Body() dto: AlterarSenhaDto) {
    return this.authService.alterarSenha(req.user.id, dto);
  }

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
