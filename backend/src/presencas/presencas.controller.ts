import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('presencas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('presencas')
export class PresencasController {
  constructor(private prisma: PrismaService) {}

  @Post()
  registrar(@Body() body: { agendamentoId: string; compareceu: boolean }) {
    return this.prisma.presenca.upsert({
      where: { agendamentoId: body.agendamentoId },
      update: { compareceu: body.compareceu },
      create: { agendamentoId: body.agendamentoId, compareceu: body.compareceu },
    });
  }
}
