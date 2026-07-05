import { Module } from '@nestjs/common';
import { HorariosFixosService } from './horarios-fixos.service';
import { HorariosFixosController } from './horarios-fixos.controller';
import { AutoAgendamentoModule } from '../auto-agendamento/auto-agendamento.module';

@Module({
  imports: [AutoAgendamentoModule],
  controllers: [HorariosFixosController],
  providers: [HorariosFixosService],
  exports: [HorariosFixosService],
})
export class HorariosFixosModule {}
