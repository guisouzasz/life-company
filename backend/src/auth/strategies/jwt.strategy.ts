import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { segredoJwt } from '../jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: segredoJwt(config),
    });
  }

  /**
   * O usuário já é lido do banco a cada requisição — é o que faz um cadastro
   * desativado perder o acesso na hora, sem esperar o token vencer. Como a
   * consulta já acontece, `nome` e `dono` vêm de graça:
   *
   *  - `nome` é o que a auditoria grava junto da ação, para o registro ficar
   *    legível sem uma segunda consulta por linha;
   *  - `dono` fica FORA do token de propósito. Tirar a marca de alguém passa
   *    a valer no ato; se viajasse dentro do JWT, continuaria valendo até o
   *    token expirar.
   */
  async validate(payload: { sub: string; tipo: string }) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!usuario || !usuario.ativo) throw new UnauthorizedException();
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipoUsuario,
      dono: usuario.dono,
    };
  }
}
