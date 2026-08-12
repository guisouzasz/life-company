import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PlanosModule } from './planos/planos.module';
import { ModalidadesModule } from './modalidades/modalidades.module';
import { HorariosModule } from './horarios/horarios.module';
import { AgendamentosModule } from './agendamentos/agendamentos.module';
import { PresencasModule } from './presencas/presencas.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { CreditosModule } from './creditos/creditos.module';
import { HorariosFixosModule } from './horarios-fixos/horarios-fixos.module';
import { AutoAgendamentoModule } from './auto-agendamento/auto-agendamento.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { TreinosModule } from './treinos/treinos.module';
import { CargasModule } from './cargas/cargas.module';
import { AnamneseModule } from './anamnese/anamnese.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Teto largo por IP para o uso normal do app; as rotas de autenticação
    // apertam esse limite com @Throttle no próprio controller.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    PlanosModule,
    ModalidadesModule,
    HorariosModule,
    AgendamentosModule,
    PresencasModule,
    RelatoriosModule,
    CreditosModule,
    HorariosFixosModule,
    AutoAgendamentoModule,
    FinanceiroModule,
    TreinosModule,
    CargasModule,
    AnamneseModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
