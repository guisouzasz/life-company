import { Module } from '@nestjs/common';
import { TermosController } from './termos.controller';

@Module({ controllers: [TermosController] })
export class TermosModule {}
