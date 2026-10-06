import { Module } from '@nestjs/common';
import { ConferenciaController } from './conferencia.controller';
import { ConferenciaService } from './conferencia.service';

@Module({ controllers: [ConferenciaController], providers: [ConferenciaService] })
export class ConferenciaModule {}
