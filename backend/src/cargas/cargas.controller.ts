import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CargasService } from './cargas.service';
import { RegistrarCargaDto } from './dto/registrar-carga.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffGuard } from '../auth/guards/staff.guard';

@ApiTags('cargas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cargas')
export class CargasController {
  constructor(private service: CargasService) {}

  @Get('meus') @ApiOperation({ summary: 'Minha evolução de cargas (aluno logado)' })
  meus(@Request() req) {
    return this.service.meus(req.user.id);
  }

  // ── Professor/Admin (professor limitado à própria modalidade) ─────
  @Get('aluno/:alunoId') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Evolução de cargas do aluno (professor/admin)' })
  doAluno(@Request() req, @Param('alunoId') alunoId: string) {
    return this.service.doAluno(alunoId, req.user);
  }

  @Post() @UseGuards(StaffGuard) @ApiOperation({ summary: 'Registrar carga de um exercício' })
  registrar(@Request() req, @Body() dto: RegistrarCargaDto) {
    return this.service.registrar(req.user, dto);
  }

  @Delete(':id') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Remover registro de carga' })
  remover(@Request() req, @Param('id') id: string) {
    return this.service.remover(id, req.user);
  }
}
