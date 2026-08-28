import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Patch, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HorariosService } from './horarios.service';
import { AtualizarHorarioDto, CriarHorarioDto } from './dto/criar-horario.dto';
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
  @ApiQuery({ name: 'todos', required: false, description: 'Inclui horários inativos (gestão admin)' })
  listar(
    @Query('modalidadeId') modalidadeId?: string,
    @Query('diaSemana') diaSemana?: string,
    @Query('todos') todos?: string,
  ) {
    return this.service.listar(modalidadeId, diaSemana, todos === '1' || todos === 'true');
  }

  /**
   * A grade da semana com os alunos de cada turma (admin).
   *
   * Fica antes das rotas com parâmetro para o Nest não ler "semana" como um id.
   */
  @Get('semana')
  @UseGuards(AdminGuard)
  @ApiQuery({ name: 'inicio', required: false, description: 'Qualquer data da semana desejada (YYYY-MM-DD). Padrão: semana atual.' })
  semana(@Query('inicio') inicio?: string) {
    return this.service.listarSemana(inicio);
  }

  @Get('vagas')
  @ApiQuery({ name: 'modalidadeId', required: false })
  @ApiQuery({ name: 'data', required: true })
  vagas(@Request() req, @Query('modalidadeId') modalidadeId: string | undefined, @Query('data') data: string) {
    return this.service.listarComVagas(modalidadeId || undefined, data, req.user);
  }

  @Post() @UseGuards(AdminGuard) criar(@Body() dto: CriarHorarioDto) { return this.service.criar(dto); }
  @Patch(':id/bloquear') @UseGuards(AdminGuard) bloquear(@Param('id') id: string) { return this.service.bloquear(id); }
  @Patch(':id') @UseGuards(AdminGuard) atualizar(@Param('id') id: string, @Body() dto: AtualizarHorarioDto) { return this.service.atualizar(id, dto); }
  @Delete(':id') @UseGuards(AdminGuard) excluir(@Param('id') id: string) { return this.service.excluir(id); }
}
