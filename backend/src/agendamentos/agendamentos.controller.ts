import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AgendamentosService } from './agendamentos.service';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('agendamentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agendamentos')
export class AgendamentosController {
  constructor(private service: AgendamentosService) {}

  @Post() @ApiOperation({ summary: 'Criar agendamento' })
  criar(@Request() req, @Body() dto: CriarAgendamentoDto) { return this.service.criar(req.user.id, dto); }

  @Get('meus') @ApiOperation({ summary: 'Meus agendamentos futuros' })
  meus(@Request() req) { return this.service.listarMeus(req.user.id); }

  @Get('historico')
  historico(@Request() req, @Query('page') page = '1') { return this.service.historico(req.user.id, parseInt(page)); }

  @Get('horario/:horarioId')
  @UseGuards(AdminGuard)
  porHorario(@Param('horarioId') horarioId: string, @Query('data') data: string) { return this.service.listarPorHorario(horarioId, data); }

  @Patch(':id/cancelar')
  cancelar(@Request() req, @Param('id') id: string) { return this.service.cancelar(id, req.user.id); }

  @Patch(':id/cancelar-admin')
  @UseGuards(AdminGuard)
  adminCancelar(@Param('id') id: string) { return this.service.adminCancelar(id); }
}
