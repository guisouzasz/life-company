import { Module } from '@nestjs/common';
import { DiagnosticoController } from './diagnostico.controller';
import { DiagnosticoService } from './diagnostico.service';
import { AutoAgendamentoModule } from '../auto-agendamento/auto-agendamento.module';

@Module({
  imports: [AutoAgendamentoModule],
  controllers: [DiagnosticoController],
  providers: [DiagnosticoService],
})
export class DiagnosticoModule {}
