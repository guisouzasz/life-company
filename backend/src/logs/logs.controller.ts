import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DonoGuard } from '../auth/guards/dono.guard';
import { LogsService } from './logs.service';

/**
 * O registro de ações do estúdio. Só leitura, e só para o dono.
 *
 * Não existe rota para apagar nem editar log, de propósito: um registro que
 * quem é auditado pode apagar não serve como registro.
 */
@ApiTags('logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, DonoGuard)
@Controller('logs')
export class LogsController {
  constructor(private service: LogsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar o que foi feito no sistema (dono)' })
  listar(
    @Query('usuarioId') usuarioId?: string,
    @Query('desde') desde?: string,
    @Query('ate') ate?: string,
    @Query('busca') busca?: string,
    @Query('pagina') pagina?: string,
  ) {
    return this.service.listar({ usuarioId, desde, ate, busca, pagina: Number(pagina) || 1 });
  }

  @Get('autores')
  @ApiOperation({ summary: 'Quem aparece no registro (dono)' })
  autores() {
    return this.service.autores();
  }
}
