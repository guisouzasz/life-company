import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
