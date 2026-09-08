import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DonoGuard } from '../auth/guards/dono.guard';
import { DiagnosticoService } from './diagnostico.service';
import { DevolverHorariosFixosDto } from './dto/devolver-horarios-fixos.dto';

/**
 * Conferência do estado do estúdio, e o único conserto que ela oferece.
 *
 * Fica atrás do DonoGuard não por sigilo — não devolve dado pessoal além do
 * nome — mas porque é uma lista de problemas: na mão de quem não vai agir,
 * vira só susto. E porque devolver horário em lote mexe na grade de muita
 * gente de uma vez.
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

  /**
   * O que sobrou de quem foi excluído definitivamente — lista de conferência
   * para recadastrar. Só leitura: a exclusão em si não tem desfazer.
   */
  @Get('cadastros-removidos')
  @ApiOperation({ summary: 'Dados recuperáveis de cadastros excluídos (dono)' })
  cadastrosRemovidos() {
    return this.service.cadastrosRemovidos();
  }

  /**
   * Devolve os horários fixos escolhidos. O corpo é obrigatório: sem lista de
   * ids o ValidationPipe recusa, e é assim que uma versão antiga do app — que
   * chamava esta rota sem corpo esperando "devolve tudo" — para de valer sem
   * precisar de outra rota.
   */
  @Post('restaurar-horarios-fixos')
  @ApiOperation({ summary: 'Devolver os horários fixos marcados na conferência (dono)' })
  restaurarHorariosFixos(@Body() dto: DevolverHorariosFixosDto) {
    return this.service.restaurarHorariosFixos(dto);
  }
}
