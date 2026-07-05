import { Module } from '@nestjs/common';
import { AutoAgendamentoService } from './auto-agendamento.service';
import { AutoAgendamentoController } from './auto-agendamento.controller';
import { AgendamentosModule } from '../agendamentos/agendamentos.module';

@Module({
  imports: [AgendamentosModule],
  controllers: [AutoAgendamentoController],
  providers: [AutoAgendamentoService],
  exports: [AutoAgendamentoService],
})
export class AutoAgendamentoModule {}
