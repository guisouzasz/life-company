import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TreinosService } from './treinos.service';
import { SalvarTreinoDto } from './dto/salvar-treino.dto';
import { SalvarTreinoDiaDto } from './dto/salvar-treino-dia.dto';
import { OrdenarTreinosDto } from './dto/ordenar-treinos.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffGuard } from '../auth/guards/staff.guard';
import { lerLinhasDoPdf, LIMITE_PDF_BYTES } from './ler-pdf';

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
  @Get('resumo') @UseGuards(StaffGuard)
  @ApiOperation({ summary: 'Situação das fichas de cada aluno e a próxima aula dele (professor/admin)' })
  resumo(@Request() req) {
    return this.service.resumo(req.user);
  }

  @Get('aluno/:alunoId') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Treinos de um aluno (professor/admin)' })
  doAluno(@Request() req, @Param('alunoId') alunoId: string) {
    return this.service.doAluno(alunoId, req.user);
  }

  @Post() @UseGuards(StaffGuard) @ApiOperation({ summary: 'Criar treino para um aluno (professor/admin)' })
  criar(@Request() req, @Body() dto: SalvarTreinoDto) {
    return this.service.criar(req.user, dto);
  }

  /**
   * Lê o texto de uma ficha em PDF (feita no Word ou no Excel). Não grava
   * nada: devolve as linhas, o app monta a ficha e o professor confere antes
   * de salvar pelo POST de sempre. O arquivo fica só na memória deste pedido.
   */
  @Post('ler-pdf') @UseGuards(StaffGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  // Sem `dest`, o multer guarda em memória: nada vai para o disco.
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: LIMITE_PDF_BYTES, files: 1 } }))
  @ApiOperation({ summary: 'Ler o texto de uma ficha de treino em PDF (professor/admin)' })
  lerPdf(@UploadedFile() arquivo?: { buffer: Buffer }) {
    if (!arquivo?.buffer) throw new BadRequestException('Escolha o PDF da ficha.');
    return lerLinhasDoPdf(arquivo.buffer);
  }

  // Rota fixa antes de ':id', senão "ordem" entraria como um id.
  @Put('ordem') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Reordenar as fichas de um aluno (professor/admin)' })
  ordenar(@Request() req, @Body() dto: OrdenarTreinosDto) {
    return this.service.ordenar(dto.alunoId, dto.ids, req.user);
  }

  @Put(':id') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Editar treino (substitui exercícios)' })
  atualizar(@Request() req, @Param('id') id: string, @Body() dto: SalvarTreinoDto) {
    return this.service.atualizar(id, dto, req.user);
  }

  @Patch(':id/status') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Concluir/reativar a ficha (professor/admin)' })
  definirStatus(@Request() req, @Param('id') id: string, @Body('concluido') concluido: boolean) {
    return this.service.definirStatus(id, !!concluido, req.user);
  }

  @Delete(':id') @UseGuards(StaffGuard) @ApiOperation({ summary: 'Remover treino (professor/admin)' })
  remover(@Request() req, @Param('id') id: string) {
    return this.service.remover(id, req.user);
  }
}
