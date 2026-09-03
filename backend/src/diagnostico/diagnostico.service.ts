import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { varrerHorariosFixos, type Varredura } from './varredura-horarios-fixos';

@Injectable()
export class DiagnosticoService {
  constructor(private prisma: PrismaService) {}

  /** A varredura dos horários fixos. Só leitura — pode rodar com o estúdio aberto. */
  horariosFixos(): Promise<Varredura> {
    return varrerHorariosFixos(this.prisma);
  }
}
