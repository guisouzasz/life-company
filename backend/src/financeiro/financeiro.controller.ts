import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FinanceiroService } from './financeiro.service';
import { RegistrarPagamentoDto } from './dto/registrar-pagamento.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('financeiro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('financeiro')
export class FinanceiroController {
  constructor(private service: FinanceiroService) {}

  @Get('meu') @ApiOperation({ summary: 'Situação da mensalidade do aluno logado' })
  meu(@Request() req) {
    return this.service.minhaSituacao(req.user.id);
  }

  // ── Admin ──────────────────────────────────────────────────────────
  @Get('resumo') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Resumo do mês + situação de todos os alunos (admin)' })
  resumo() {
    return this.service.resumo();
  }

  @Get('aluno/:usuarioId') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Histórico de pagamentos do aluno (admin)' })
  historico(@Param('usuarioId') usuarioId: string) {
    return this.service.historicoDoAluno(usuarioId);
  }

  @Post('pagamentos') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Registrar recebimento manual (admin)' })
  registrar(@Body() dto: RegistrarPagamentoDto) {
    return this.service.registrar(dto);
  }

  @Delete('pagamentos/:id') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Desfazer registro de pagamento (admin)' })
  desfazer(@Param('id') id: string) {
    return this.service.desfazer(id);
  }

  @Patch('aluno/:usuarioId/config') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Valor personalizado / dia de vencimento (admin)' })
  configurar(@Param('usuarioId') usuarioId: string, @Body() body: { valorMensalidade?: number | null; diaVencimento?: number }) {
    return this.service.configurarAluno(usuarioId, body);
  }

  @Patch('planos/:planoId/preco') @UseGuards(AdminGuard) @ApiOperation({ summary: 'Preço padrão do plano (admin)' })
  precoPlano(@Param('planoId') planoId: string, @Body() body: { precoPadrao: number | null }) {
    return this.service.definirPrecoPlano(planoId, body.precoPadrao);
  }
}
