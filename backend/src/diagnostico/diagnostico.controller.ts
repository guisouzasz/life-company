import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DonoGuard } from '../auth/guards/dono.guard';
import { DiagnosticoService } from './diagnostico.service';

/**
 * Conferência do estado do estúdio. Só leitura, e só para o dono.
 *
 * Fica atrás do DonoGuard não por sigilo — não devolve dado pessoal além do
 * nome — mas porque é uma lista de problemas: na mão de quem não vai agir,
 * vira só susto.
 */
@ApiTags('diagnostico')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, DonoGuard)
@Controller('diagnostico')
export class DiagnosticoController {
  constructor(private service: DiagnosticoService) {}

  @Get('horarios-fixos')
  @ApiOperation({ summary: 'Varredura dos horários fixos (dono)' })
  horariosFixos() {
    return this.service.horariosFixos();
  }

  @Post('restaurar-horarios-fixos')
  @ApiOperation({ summary: 'Devolver os horários fixos desligados de quem treina (dono)' })
  restaurarHorariosFixos() {
    return this.service.restaurarHorariosFixos();
  }
}
