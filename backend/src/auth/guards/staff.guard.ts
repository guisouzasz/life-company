import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/** Libera ADMIN e PROFESSOR (leituras de agenda, treinos). Aluno é barrado. */
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const tipo = req.user?.tipo;
    if (tipo !== 'ADMIN' && tipo !== 'PROFESSOR') {
      throw new ForbiddenException('Apenas administradores e professores');
    }
    return true;
  }
}
