import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { varrerHorariosFixos, type Varredura } from './varredura-horarios-fixos';

@Injectable()
export class DiagnosticoService {
  constructor(private prisma: PrismaService) {}

  horariosFixos(): Promise<Varredura> {
    return varrerHorariosFixos(this.prisma);
  }

  // Mantém a rota para clientes antigos, sem restaurar histórico indiscriminadamente.
  restaurarHorariosFixos(): never {
    throw new BadRequestException(
      'A restauração em lote foi desativada porque também recuperava horários removidos de propósito. ' +
        'Abra o cadastro do aluno e escolha os horários atuais em Plano e horários. ' +
        'Cada horário será validado pelo plano e pela disponibilidade da turma.',
    );
  }
}
