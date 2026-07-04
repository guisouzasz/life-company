import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HorariosFixosService } from './horarios-fixos.service';
import { CriarHorarioFixoDto } from './dto/criar-horario-fixo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('horarios-fixos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('horarios-fixos')
export class HorariosFixosController {
  constructor(private service: HorariosFixosService) {}

  @Get(':usuarioId') @ApiOperation({ summary: 'Listar horários fixos de um aluno (admin)' })
  listar(@Param('usuarioId') usuarioId: string) {
    return this.service.listarDoAluno(usuarioId);
  }

  @Post(':usuarioId') @ApiOperation({ summary: 'Adicionar horário fixo a um aluno (admin)' })
  criar(@Param('usuarioId') usuarioId: string, @Body() dto: CriarHorarioFixoDto) {
    return this.service.criar(usuarioId, dto);
  }

  @Delete(':id') @ApiOperation({ summary: 'Remover horário fixo (admin)' })
  remover(@Param('id') id: string) {
    return this.service.remover(id);
  }
}
