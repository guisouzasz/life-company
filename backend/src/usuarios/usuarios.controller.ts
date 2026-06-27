import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  @Post() @UseGuards(AdminGuard) @ApiOperation({ summary: 'Criar aluno (admin)' })
  criar(@Body() dto: CriarUsuarioDto) { return this.service.criar(dto); }

  @Get() @UseGuards(AdminGuard) listar(@Query('busca') busca?: string) { return this.service.listar(busca); }

  @Get('me/saldo') @ApiOperation({ summary: 'Saldo semanal do aluno logado' })
  saldo(@Request() req) { return this.service.saldoSemanal(req.user.id); }

  @Put('me/fcm-token')
  fcmToken(@Request() req, @Body('fcmToken') fcmToken: string) { return this.service.atualizarFcmToken(req.user.id, fcmToken); }

  @Get(':id') @UseGuards(AdminGuard) buscar(@Param('id') id: string) { return this.service.buscarPorId(id); }

  @Put(':id') @UseGuards(AdminGuard) atualizar(@Param('id') id: string, @Body() dto: Partial<CriarUsuarioDto>) { return this.service.atualizar(id, dto); }

  @Delete(':id') @UseGuards(AdminGuard) excluir(@Param('id') id: string) { return this.service.excluir(id); }

  @Post(':id/gerar-link') @UseGuards(AdminGuard) gerarLink(@Param('id') id: string) { return this.service.gerarLink(id); }
}
