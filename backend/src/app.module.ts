import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
  ],
})
export class AppModule {}
