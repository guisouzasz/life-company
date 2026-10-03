import { Module } from '@nestjs/common';
import { DiasFechadosController } from './dias-fechados.controller';
import { DiasFechadosService } from './dias-fechados.service';

@Module({ controllers: [DiasFechadosController], providers: [DiasFechadosService] })
export class DiasFechadosModule {}
