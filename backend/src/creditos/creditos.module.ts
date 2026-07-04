import { Module } from '@nestjs/common';
import { CreditosService } from './creditos.service';
import { CreditosController } from './creditos.controller';

@Module({ controllers: [CreditosController], providers: [CreditosService] })
export class CreditosModule {}
