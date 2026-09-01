import { Module } from '@nestjs/common';
import { HorariosService } from './horarios.service';
import { HorariosController } from './horarios.controller';
import { AutoAgendamentoModule } from '../auto-agendamento/auto-agendamento.module';

@Module({
  imports: [AutoAgendamentoModule],
  controllers: [HorariosController],
  providers: [HorariosService],
  exports: [HorariosService],
})
export class HorariosModule {}
