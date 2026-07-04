import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AutoAgendamentoService } from './auto-agendamento.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('auto-agendamento')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('auto-agendamento')
export class AutoAgendamentoController {
  constructor(private service: AutoAgendamentoService) {}

  @Post('executar-agora') @ApiOperation({ summary: 'Dispara manualmente o job de auto-agendamento (teste/debug)' })
  executar() {
    return this.service.gerarAgendamentosFixos();
  }
}
