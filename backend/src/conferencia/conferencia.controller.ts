import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ConferenciaService } from './conferencia.service';

/**
 * A conferência diária dos horários fixos — o alerta das 08:00 da dona.
 *
 * Do painel da dona (AdminGuard), não do dono: é a rotina do estúdio, e só
 * mostra nome e o que falta resolver.
 */
@ApiTags('conferencia')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('conferencia')
export class ConferenciaController {
  constructor(private service: ConferenciaService) {}

  @Get('hoje')
  @ApiOperation({ summary: 'A conferência de hoje dos horários fixos (roda às 08:00)' })
  hoje() {
    return this.service.hoje();
  }

  @Post('rodar')
  @ApiOperation({ summary: 'Conferir de novo agora (depois de resolver os pontos)' })
  rodar() {
    return this.service.rodar();
  }

  @Post(':id/revisada')
  @ApiOperation({ summary: 'Marcar a conferência de hoje como revisada' })
  revisada(@Param('id') id: string, @Request() req) {
    return this.service.marcarRevisada(id, req.user?.nome ?? 'Administrador');
  }
}
