import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/** Global porque o transporte SMTP é um só — abrir um por módulo seria desperdício. */
@Global()
@Module({ providers: [EmailService], exports: [EmailService] })
export class EmailModule {}
