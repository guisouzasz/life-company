import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { AtualizarPlanoDto } from './dto/atualizar-plano.dto';
import { DefinirSenhaDto } from './dto/definir-senha.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StaffGuard } from '../auth/guards/staff.guard';

@ApiTags('usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  @Post() @UseGuards(AdminGuard) @ApiOperation({ summary: 'Criar aluno (admin)' })
  criar(@Body() dto: CriarUsuarioDto) { return this.service.criar(dto); }

  // Professor também lista alunos (para montar treinos) — leitura apenas
  @Get() @UseGuards(StaffGuard) listar(@Query('busca') busca?: string) { return this.service.listar(busca); }

  // Rota fixa ANTES de @Get(':id'), senão "professores" entraria como um id
  @Get('professores') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Professores do estúdio (admin)' })
  listarProfessores() { return this.service.listarProfessores(); }

  @Get('me/saldo') @ApiOperation({ summary: 'Saldo semanal do aluno logado' })
  saldo(@Request() req) { return this.service.saldoSemanal(req.user.id); }

  @Put('me/fcm-token')
  fcmToken(@Request() req, @Body('fcmToken') fcmToken: string) { return this.service.atualizarFcmToken(req.user.id, fcmToken); }

  @Get(':id') @UseGuards(AdminGuard) buscar(@Param('id') id: string) { return this.service.buscarPorId(id); }

  @Put(':id') @UseGuards(AdminGuard) atualizar(@Param('id') id: string, @Body() dto: AtualizarUsuarioDto) { return this.service.atualizar(id, dto); }

  @Put(':id/plano') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Trocar plano ativo do aluno (admin)' })
  atualizarPlano(@Param('id') id: string, @Body() dto: AtualizarPlanoDto) { return this.service.atualizarPlano(id, dto); }

  @Put(':id/senha') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Definir a senha de um aluno/professor (admin)' })
  definirSenha(@Param('id') id: string, @Body() dto: DefinirSenhaDto) { return this.service.definirSenha(id, dto.senha); }

  @Delete(':id') @UseGuards(AdminGuard) excluir(@Param('id') id: string) { return this.service.excluir(id); }

  /**
   * Exclusão definitiva. Rota separada do DELETE simples de propósito: quem
   * desativa e quem apaga de vez não podem ser o mesmo botão nem o mesmo
   * endereço — um toque errado aqui não tem volta.
   */
  @Delete(':id/definitivo')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Excluir aluno definitivamente (dados pessoais e conteúdo)' })
  excluirDefinitivo(@Param('id') id: string) { return this.service.excluirDefinitivamente(id); }

  @Post(':id/gerar-link') @UseGuards(AdminGuard) gerarLink(@Param('id') id: string) { return this.service.gerarLink(id); }
}
