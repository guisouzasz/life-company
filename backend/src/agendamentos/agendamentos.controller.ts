import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AgendamentosService } from './agendamentos.service';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StaffGuard } from '../auth/guards/staff.guard';

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

  // Professor também vê a lista de alunos da aula (só da modalidade dele)
  @Get('horario/:horarioId')
  @UseGuards(StaffGuard)
  porHorario(@Request() req, @Param('horarioId') horarioId: string, @Query('data') data: string) { return this.service.listarPorHorario(horarioId, data, req.user); }

  /**
   * Próximas aulas de UM aluno (admin).
   *
   * A dona só enxergava os horários fixos, que são a combinação — não as
   * aulas de fato marcadas. Quando sobrava aula de um horário fixo removido,
   * ela não tinha tela nenhuma para achar e desmarcar: o aluno seguia
   * ocupando vaga e estourando a cota da semana dele, e o horário fixo novo
   * não conseguia gerar aula ("Limite semanal atingido").
   */
  @Get('aluno/:usuarioId')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Próximas aulas de um aluno (admin)' })
  doAluno(@Param('usuarioId') usuarioId: string) { return this.service.listarMeus(usuarioId); }

  @Patch(':id/cancelar')
  cancelar(@Request() req, @Param('id') id: string) { return this.service.cancelar(id, req.user.id); }

  /** Tira o aluno da aula sem gerar crédito — arrumação de agenda, não cancelamento de aula. */
  @Patch(':id/desmarcar')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Desmarcar aula de um aluno, sem crédito (admin)' })
  desmarcar(@Param('id') id: string) { return this.service.desmarcarSemCredito(id); }

  @Patch(':id/cancelar-admin')
  @UseGuards(AdminGuard)
  adminCancelar(@Param('id') id: string) { return this.service.adminCancelar(id); }
}
