import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TreinosService } from './treinos.service';
import { SalvarTreinoDto } from './dto/salvar-treino.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffGuard } from '../auth/guards/staff.guard';

@ApiTags('treinos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('treinos')
export class TreinosController {
  constructor(private service: TreinosService) {}

  @Get('meus') @ApiOperation({ summary: 'Treinos do aluno logado' })
  meus(@Request() req) {
    return this.service.meus(req.user.id);
  }

  // ── Professor/Admin ────────────────────────────────────────────────
  @Get('aluno/:alunoId') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Treinos de um aluno (professor/admin)' })
  doAluno(@Param('alunoId') alunoId: string) {
    return this.service.doAluno(alunoId);
  }

  @Post() @UseGuards(StaffGuard) @ApiOperation({ summary: 'Criar treino para um aluno (professor/admin)' })
  criar(@Request() req, @Body() dto: SalvarTreinoDto) {
    return this.service.criar(req.user.id, dto);
  }

  @Put(':id') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Editar treino (substitui exercícios)' })
  atualizar(@Param('id') id: string, @Body() dto: SalvarTreinoDto) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Remover treino (professor/admin)' })
  remover(@Param('id') id: string) {
    return this.service.remover(id);
  }
}
