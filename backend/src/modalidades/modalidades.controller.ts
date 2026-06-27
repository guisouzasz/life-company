import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('modalidades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('modalidades')
export class ModalidadesController {
  constructor(private prisma: PrismaService) {}
  @Get() listar() { return this.prisma.modalidade.findMany({ orderBy: { nome: 'asc' } }); }
  @Post() @UseGuards(AdminGuard) criar(@Body('nome') nome: string) { return this.prisma.modalidade.create({ data: { nome } }); }
}
