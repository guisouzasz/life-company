import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HorariosService } from './horarios.service';
import { CriarHorarioDto } from './dto/criar-horario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('horarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('horarios')
export class HorariosController {
  constructor(private service: HorariosService) {}

  @Get()
  @ApiQuery({ name: 'modalidadeId', required: false })
  @ApiQuery({ name: 'diaSemana', required: false })
  listar(@Query('modalidadeId') modalidadeId?: string, @Query('diaSemana') diaSemana?: string) {
    return this.service.listar(modalidadeId, diaSemana);
  }

  @Get('vagas')
  @ApiQuery({ name: 'modalidadeId', required: true })
  @ApiQuery({ name: 'data', required: true })
  vagas(@Query('modalidadeId') modalidadeId: string, @Query('data') data: string) {
    return this.service.listarComVagas(modalidadeId, data);
  }

  @Post() @UseGuards(AdminGuard) criar(@Body() dto: CriarHorarioDto) { return this.service.criar(dto); }
  @Patch(':id/bloquear') @UseGuards(AdminGuard) bloquear(@Param('id') id: string) { return this.service.bloquear(id); }
  @Delete(':id') @UseGuards(AdminGuard) excluir(@Param('id') id: string) { return this.service.excluir(id); }
}
