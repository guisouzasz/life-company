import { Module } from '@nestjs/common';
import { DiagnosticoController } from './diagnostico.controller';
import { DiagnosticoService } from './diagnostico.service';
import { AutoAgendamentoModule } from '../auto-agendamento/auto-agendamento.module';

@Module({
  // Devolver um horário fixo remarca as aulas na hora, pelo mesmo caminho do
  // cron e da Agenda — então a lotação e a cota do plano seguem valendo.
  imports: [AutoAgendamentoModule],
  controllers: [DiagnosticoController],
  providers: [DiagnosticoService],
})
export class DiagnosticoModule {}
