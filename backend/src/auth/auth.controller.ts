import { Controller, Post, Body, Get, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PrimeiroAcessoDto } from './dto/primeiro-acesso.dto';
import { AtivarContaDto } from './dto/ativar-conta.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login com email e senha' })
  login(@Body() dto: LoginDto) { return this.authService.login(dto); }

  @Post('primeiro-acesso')
  @ApiOperation({ summary: 'Ativar conta no primeiro acesso (via link/token)' })
  primeiroAcesso(@Body() dto: PrimeiroAcessoDto) { return this.authService.primeiroAcesso(dto); }

  @Post('ativar-conta')
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
