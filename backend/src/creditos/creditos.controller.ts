import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreditosService } from './creditos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('creditos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('creditos')
export class CreditosController {
  constructor(private service: CreditosService) {}

  @Get('meus') @ApiOperation({ summary: 'Créditos de reposição do aluno logado' })
  meus(@Request() req) {
    return this.service.meus(req.user.id);
  }

  @Get('meus/saldo') @ApiOperation({ summary: 'Qtd de créditos válidos do aluno logado' })
  saldo(@Request() req) {
    return this.service.saldo(req.user.id);
  }

  // ── Admin ──────────────────────────────────────────────────────────
  @Get() @UseGuards(AdminGuard) @ApiOperation({ summary: 'Listar créditos (admin)' })
  listar(@Query('usuarioId') usuarioId?: string) {
    return this.service.listar(usuarioId);
  }

  @Post() @UseGuards(AdminGuard) @ApiOperation({ summary: 'Conceder crédito manual (admin)' })
  conceder(@Body() body: { usuarioId: string; dias?: number }) {
    return this.service.conceder(body.usuarioId, body.dias);
  }

  @Patch(':id') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Alterar validade/revogar (admin)' })
  atualizar(@Param('id') id: string, @Body() body: { expiraEm?: string; revogado?: boolean }) {
    return this.service.atualizar(id, body);
  }

  @Delete(':id') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Revogar crédito (admin)' })
  remover(@Param('id') id: string) {
    return this.service.remover(id);
  }
}
