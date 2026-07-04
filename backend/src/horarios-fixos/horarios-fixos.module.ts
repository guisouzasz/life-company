import { Module } from '@nestjs/common';
import { HorariosFixosService } from './horarios-fixos.service';
import { HorariosFixosController } from './horarios-fixos.controller';

@Module({ controllers: [HorariosFixosController], providers: [HorariosFixosService], exports: [HorariosFixosService] })
export class HorariosFixosModule {}
