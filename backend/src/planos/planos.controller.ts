import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('planos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('planos')
export class PlanosController {
  constructor(private prisma: PrismaService) {}
  @Get() listar() { return this.prisma.plano.findMany({ orderBy: { aulasSemanais: 'asc' } }); }
}
