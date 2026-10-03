import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DiasFechadosService } from './dias-fechados.service';
import { FecharDiaDto } from './dto/fechar-dia.dto';

@ApiTags('dias-fechados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dias-fechados')
export class DiasFechadosController {
  constructor(private service: DiasFechadosService) {}

  /** Qualquer pessoa logada: o aluno precisa saber que o dia está fechado. */
  @Get()
  @ApiQuery({ name: 'de', required: false })
  @ApiQuery({ name: 'ate', required: false })
  listar(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.service.listar(de, ate);
  }

  @Post() @UseGuards(AdminGuard) @ApiOperation({ summary: 'Fechar um dia: feriado, recesso (admin)' })
  fechar(@Body() dto: FecharDiaDto) {
    return this.service.fechar(dto);
  }

  @Delete(':id') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Reabrir um dia fechado (admin)' })
  reabrir(@Param('id') id: string) {
    return this.service.reabrir(id);
  }
}
