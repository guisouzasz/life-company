import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Só o dono do sistema passa.
 *
 * A marca vem do banco a cada requisição (a estratégia do JWT relê o usuário),
 * não do token — então tirar o acesso de alguém vale no ato.
 *
 * A mensagem é propositalmente vaga: quem não é dono não precisa saber que
 * existe uma área de registro de ações.
 */
@Injectable()
export class DonoGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.dono) throw new ForbiddenException('Área restrita');
    return true;
  }
}
