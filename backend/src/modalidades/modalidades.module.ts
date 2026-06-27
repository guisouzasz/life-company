import { Module } from '@nestjs/common';
import { ModalidadesController } from './modalidades.controller';
@Module({ controllers: [ModalidadesController] })
export class ModalidadesModule {}
