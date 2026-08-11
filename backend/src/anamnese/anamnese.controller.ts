import { Body, Controller, Get, Param, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnamneseService } from './anamnese.service';
import { SalvarAnamneseDto } from './dto/salvar-anamnese.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffGuard } from '../auth/guards/staff.guard';

@ApiTags('anamnese')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('anamnese')
export class AnamneseController {
  constructor(private service: AnamneseService) {}

  @Get('me') @ApiOperation({ summary: 'Minha ficha de anamnese (null se não preenchida)' })
  minha(@Request() req) {
    return this.service.minha(req.user.id);
  }

  @Put('me') @ApiOperation({ summary: 'Preencher/atualizar a própria ficha' })
  salvar(@Request() req, @Body() dto: SalvarAnamneseDto) {
    return this.service.salvar(req.user.id, dto);
  }

  @Get('aluno/:alunoId') @UseGuards(StaffGuard)
  @ApiOperation({ summary: 'Ficha de um aluno (professor da modalidade / admin)' })
  doAluno(@Request() req, @Param('alunoId') alunoId: string) {
    return this.service.doAluno(alunoId, req.user);
  }
}
