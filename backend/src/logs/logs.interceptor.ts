import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { detalheSeguro } from './detalhe-seguro';
import { idDaRota, resumoDaRota } from './resumo-da-rota';

/**
 * Grava no banco tudo que o estúdio ESCREVE no sistema.
 *
 * Por que um interceptador e não uma chamada dentro de cada service: porque
 * assim nada escapa. Instrumentar service por service depende de eu lembrar
 * de cada um — e o log que falha justamente na ação que a pessoa procura é
 * pior do que não ter log, porque dá a impressão de que aquilo nunca
 * aconteceu.
 *
 * Três recortes deliberados:
 *
 *  1. Só escrita (POST/PATCH/PUT/DELETE). Registrar leitura encheria a tabela
 *     com milhares de linhas por dia sem responder "quem mexeu nisso".
 *
 *  2. Só ADMIN e PROFESSOR. O aluno marcando a própria aula não é o que se
 *     está auditando, e ele é a maioria do tráfego.
 *
 *  3. Sucesso e erro, os dois. Uma tentativa recusada (403 de limite semanal,
 *     por exemplo) explica por que o aluno "não entrou na turma" — é metade
 *     das perguntas que chegam.
 */
@Injectable()
export class LogsInterceptor implements NestInterceptor {
  private readonly log = new Logger('Auditoria');

  constructor(private prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const metodo: string = req?.method ?? '';

    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(metodo)) return next.handle();

    return next.handle().pipe(
      tap({
        next: (resposta) =>
          this.gravar(req, metodo, ctx.switchToHttp().getResponse()?.statusCode ?? 200, resposta),
        error: (erro) => this.gravar(req, metodo, erro?.status ?? erro?.statusCode ?? 500, null),
      }),
    );
  }

  private gravar(req: any, metodo: string, status: number, resposta: any) {
    // `req.user` é preenchido pelo JwtAuthGuard, que roda antes do
    // interceptador nas rotas protegidas.
    const usuario = req?.user;
    let tipo: string | undefined = usuario?.tipo;
    let nome: string | undefined = usuario?.nome;
    let quemId: string | null = usuario?.id ?? null;

    const rota: string = req?.originalUrl ?? req?.url ?? '';
    const caminho = rota.split('?')[0].replace(/\/+$/, '');
    const ehLogin = metodo === 'POST' && caminho.endsWith('/auth/login');

    /**
     * Login é o único caso sem sessão que interessa registrar, e cada metade
     * dele interessa por um motivo diferente:
     *
     *  - o que FALHA sempre entra, seja de quem for. Uma sequência de senhas
     *    erradas na conta da dona é exatamente o tipo de coisa que se quer
     *    encontrar depois;
     *  - o que dá certo entra só para ADMIN e PROFESSOR. Trinta alunos
     *    entrando duas vezes por dia afogariam o registro em linhas que não
     *    respondem "quem mexeu nisso".
     */
    if (ehLogin) {
      const deuCerto = status < 400;
      if (deuCerto) {
        const tipoDaResposta: string | undefined = resposta?.tipoUsuario;
        if (tipoDaResposta !== 'ADMIN' && tipoDaResposta !== 'PROFESSOR') return;
        tipo = tipoDaResposta;
        nome = resposta?.nome;
        quemId = resposta?.usuarioId ?? null;
      } else {
        // Quem tentou: só o que a pessoa digitou no campo, nunca a senha.
        tipo = 'ANONIMO';
        nome = String(req?.body?.email ?? 'desconhecido').slice(0, 120);
        quemId = null;
      }
    } else if (tipo !== 'ADMIN' && tipo !== 'PROFESSOR') {
      return;
    }

    /**
     * Nunca deixa a auditoria derrubar a ação.
     *
     * O log é importante, mas menos do que o estúdio conseguir trabalhar. Se
     * a tabela estiver indisponível, a aula é marcada do mesmo jeito e a
     * falha vai para o log do servidor.
     */
    void this.prisma.logAcao
      .create({
        data: {
          usuarioId: quemId,
          usuarioNome: nome || 'desconhecido',
          usuarioTipo: tipo ?? 'ANONIMO',
          metodo,
          rota: caminho.slice(0, 200),
          resumo: ehLogin && status >= 400 ? 'Tentativa de login recusada' : resumoDaRota(metodo, rota),
          entidadeId: this.entidadeDe(rota, req?.body, resposta),
          detalhe: detalheSeguro(req?.body),
          status,
          ip: this.ipDe(req),
        },
      })
      .catch((e) => this.log.warn(`não consegui gravar o log de ${metodo} ${rota}: ${e?.message}`));
  }

  /**
   * Sobre qual registro a ação foi.
   *
   * Boa parte das rotas traz o id no caminho (`/agendamentos/<id>/cancelar`),
   * mas as de criação trazem no corpo: `POST /agendamentos/admin` recebe o
   * `usuarioId` do aluno. Sem olhar o corpo, justamente as ações mais
   * importantes — colocar e tirar aluno da turma — ficariam sem dono, e não
   * daria para responder "o que aconteceu com o Carlos".
   *
   * O último caso é a criação, e ele custou caro para aparecer: `POST
   * /usuarios` não tem id no caminho nem no corpo (o registro ainda não
   * existe), e a resposta devolve o cadastro DENTRO de `usuario`, junto com o
   * link de primeiro acesso. Lendo só `resposta.id`, o log do cadastro ficava
   * órfão — guardava o nome do aluno e nenhuma forma de ligá-lo à pessoa.
   *
   * Isso só se percebe quando alguém é excluído e se tenta descobrir quem
   * era: o nome está no registro, o id está no registro, e não há como saber
   * que são a mesma pessoa.
   */
  private entidadeDe(rota: string, corpo: any, resposta: any): string | null {
    return (
      idDaRota(rota) ??
      corpo?.usuarioId ??
      corpo?.alunoId ??
      (typeof resposta?.id === 'string' ? resposta.id : null) ??
      (typeof resposta?.usuario?.id === 'string' ? resposta.usuario.id : null) ??
      null
    );
  }

  /**
   * O IP real por trás do proxy da Railway. `x-forwarded-for` vem como uma
   * lista; o primeiro item é o cliente.
   */
  private ipDe(req: any): string | null {
    const encaminhado = req?.headers?.['x-forwarded-for'];
    if (typeof encaminhado === 'string' && encaminhado.length) {
      return encaminhado.split(',')[0].trim().slice(0, 45);
    }
    const direto = req?.ip ?? req?.socket?.remoteAddress;
    return typeof direto === 'string' ? direto.slice(0, 45) : null;
  }
}
