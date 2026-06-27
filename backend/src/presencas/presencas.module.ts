import { Module } from '@nestjs/common';
import { PresencasController } from './presencas.controller';
@Module({ controllers: [PresencasController] })
export class PresencasModule {}
