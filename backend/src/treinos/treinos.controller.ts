import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TreinosService } from './treinos.service';
import { SalvarTreinoDto } from './dto/salvar-treino.dto';
import { SalvarTreinoDiaDto } from './dto/salvar-treino-dia.dto';
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

  // ── Treino do DIA (Funcional) — rotas fixas ANTES das rotas :id ────
  @Get('dia/meu') @ApiOperation({ summary: 'Treino do dia de hoje das aulas do aluno logado' })
  diaMeu(@Request() req) {
    return this.service.diaMeu(req.user.id);
  }

  @Get('dia') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Treino do dia da modalidade (professor/admin)' })
  @ApiQuery({ name: 'data', required: true })
  @ApiQuery({ name: 'modalidadeId', required: false })
  diaVer(@Request() req, @Query('data') data: string, @Query('modalidadeId') modalidadeId?: string) {
    return this.service.diaVer(req.user, data, modalidadeId);
  }

  @Put('dia') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Criar/substituir o treino do dia (upsert)' })
  diaSalvar(@Request() req, @Body() dto: SalvarTreinoDiaDto) {
    return this.service.diaSalvar(req.user, dto);
  }

  @Delete('dia/:id') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Remover treino do dia' })
  diaRemover(@Request() req, @Param('id') id: string) {
    return this.service.diaRemover(id, req.user);
  }

  // ── Professor/Admin (professor limitado à própria modalidade) ─────
  @Get('aluno/:alunoId') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Treinos de um aluno (professor/admin)' })
  doAluno(@Request() req, @Param('alunoId') alunoId: string) {
    return this.service.doAluno(alunoId, req.user);
  }

  @Post() @UseGuards(StaffGuard) @ApiOperation({ summary: 'Criar treino para um aluno (professor/admin)' })
  criar(@Request() req, @Body() dto: SalvarTreinoDto) {
    return this.service.criar(req.user, dto);
  }

  @Put(':id') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Editar treino (substitui exercícios)' })
  atualizar(@Request() req, @Param('id') id: string, @Body() dto: SalvarTreinoDto) {
    return this.service.atualizar(id, dto, req.user);
  }

  @Delete(':id') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Remover treino (professor/admin)' })
  remover(@Request() req, @Param('id') id: string) {
    return this.service.remover(id, req.user);
  }
}
