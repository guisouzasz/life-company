import { Module } from '@nestjs/common';
import { CargasService } from './cargas.service';
import { CargasController } from './cargas.controller';

@Module({ controllers: [CargasController], providers: [CargasService] })
export class CargasModule {}
