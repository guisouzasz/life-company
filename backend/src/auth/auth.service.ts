import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { PrimeiroAcessoDto } from "./dto/primeiro-acesso.dto";
import { AtivarContaDto, erroDeEmail } from "./dto/ativar-conta.dto";
import { segredoJwt } from "./jwt.config";
import { VERSAO_TERMO } from "../termos/termo";

/** Domínio público do estúdio — destino dos links de primeiro acesso. */
const APP_URL_PUBLICA = "https://www.academialifecompany.com.br";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  /**
   * Exclusão da própria conta (exigência da App Store / Google Play + LGPD).
   * Anonimiza todos os dados pessoais e bloqueia o acesso, preservando os
   * registros históricos do estúdio (financeiro/frequência) de forma anônima.
   * Administradores não podem se autoexcluir (evita travar o estúdio).
   */
  async excluirMinhaConta(usuarioId: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!u) throw new NotFoundException('Conta não encontrada');
    if (u.tipoUsuario === 'ADMIN') {
      throw new ForbiddenException('Contas de administrador são gerenciadas pela equipe do estúdio');
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove dados pessoais / acessos e conteúdos do usuário
      await tx.refreshToken.deleteMany({ where: { usuarioId } });
      await tx.primeiroAcesso.deleteMany({ where: { usuarioId } });
      await tx.horarioFixo.deleteMany({ where: { usuarioId } });
      await tx.creditoReposicao.deleteMany({ where: { usuarioId } });
      await tx.registroCarga.deleteMany({ where: { OR: [{ alunoId: usuarioId }, { professorId: usuarioId }] } });
      await tx.treino.deleteMany({ where: { OR: [{ alunoId: usuarioId }, { professorId: usuarioId }] } });
      await tx.treinoDia.deleteMany({ where: { professorId: usuarioId } });

      // Anonimiza o cadastro (mantém agendamentos/pagamentos como histórico anônimo)
      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          nome: 'Conta removida',
          cpf: `REMOVIDO-${usuarioId}`,
          email: null,
          telefone: null,
          senhaHash: null,
          fcmToken: null,
          ativo: false,
          modalidadeProfessorId: null,
        },
      });
    });

    return { mensagem: 'Sua conta foi excluída. Seus dados pessoais foram removidos.' };
  }

  /** Dados do usuário logado (inclui a modalidade quando é professor). */
  async me(usuarioId: string) {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true, nome: true, email: true, cpf: true, telefone: true, tipoUsuario: true,
        modalidadeProfessor: { select: { id: true, nome: true } },
      },
    });
    if (!u) throw new UnauthorizedException();
    return { ...u, tipo: u.tipoUsuario };
  }

  async login(dto: LoginDto) {
    // O campo aceita e-mail ou CPF: 11 dígitos (com ou sem máscara) = CPF.
    const entrada = dto.email.trim();
    const somenteDigitos = entrada.replace(/\D/g, "");
    const ehCpf = somenteDigitos.length === 11 && !entrada.includes("@");
    const usuario = await this.prisma.usuario.findUnique({
      where: ehCpf ? { cpf: somenteDigitos } : { email: entrada },
    });
    if (!usuario || !usuario.senhaHash)
      throw new UnauthorizedException("Credenciais inválidas");
    if (!usuario.ativo) throw new UnauthorizedException("Conta inativa");
    const ok = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!ok) throw new UnauthorizedException("Credenciais inválidas");
    return this.gerarTokens(usuario.id, usuario.tipoUsuario, usuario.nome);
  }

  async primeiroAcesso(dto: PrimeiroAcessoDto) {
    const registro = await this.prisma.primeiroAcesso.findUnique({
      where: { token: dto.token },
      include: { usuario: true },
    });
    if (!registro) throw new NotFoundException("Link inválido");
    if (registro.usado) throw new BadRequestException("Link já utilizado");
    if (dayjs().isAfter(registro.expiraEm))
      throw new BadRequestException("Link expirado");
    const cpfNorm = dto.cpf.replace(/\D/g, "");
    const cpfCad = registro.usuario.cpf.replace(/\D/g, "");
    if (cpfNorm !== cpfCad)
      throw new UnauthorizedException("CPF não corresponde");
    if (registro.usuario.senhaHash)
      throw new ConflictException("Conta já ativada");
    this.conferirAceiteDoTermo(registro.usuario.tipoUsuario, dto.termoVersao);
    const senhaHash = await bcrypt.hash(dto.senha, 12);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: registro.usuarioId },
        data: { senhaHash, ativo: true },
      }),
      this.prisma.primeiroAcesso.update({
        where: { id: registro.id },
        data: { usado: true },
      }),
      ...this.gravarAceiteDoTermo(registro.usuarioId, registro.usuario.tipoUsuario),
    ]);
    return this.gerarTokens(
      registro.usuarioId,
      registro.usuario.tipoUsuario,
      registro.usuario.nome,
    );
  }

  /**
   * Ativação sem link: o aluno informa o CPF (cadastrado pelo admin), escolhe
   * o próprio e-mail e cria a senha direto no app. O CPF é a verificação de
   * identidade; o e-mail informado fica salvo no cadastro. Só contas ainda
   * sem senha podem ser ativadas.
   */
  async ativarConta(dto: AtivarContaDto) {
    const cpfNorm = dto.cpf.replace(/\D/g, "");
    const usuario = await this.prisma.usuario.findUnique({
      where: { cpf: cpfNorm },
    });
    if (!usuario)
      throw new NotFoundException(
        "CPF não encontrado. Confirme com o estúdio se o seu cadastro já foi feito.",
      );
    if (usuario.senhaHash)
      throw new ConflictException("Conta já ativada. Faça login com sua senha.");

    const email = dto.email.trim().toLowerCase();
    const erroEmail = erroDeEmail(email);
    if (erroEmail) throw new BadRequestException(erroEmail);
    const emailEmUso = await this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, id: { not: usuario.id } },
    });
    if (emailEmUso)
      throw new ConflictException("Este e-mail já está em uso por outra conta.");

    this.conferirAceiteDoTermo(usuario.tipoUsuario, dto.termoVersao);
    const senhaHash = await bcrypt.hash(dto.senha, 12);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { email, senhaHash, ativo: true },
      }),
      // Invalida qualquer link de primeiro acesso pendente para esta conta
      this.prisma.primeiroAcesso.updateMany({
        where: { usuarioId: usuario.id, usado: false },
        data: { usado: true },
      }),
      ...this.gravarAceiteDoTermo(usuario.id, usuario.tipoUsuario),
    ]);
    return this.gerarTokens(usuario.id, usuario.tipoUsuario, usuario.nome);
  }

  /**
   * O aceite do termo é condição para o aluno concluir o primeiro acesso.
   *
   * Fica no serviço, e não só no app: a checagem tem de valer para qualquer
   * chamada da rota, senão bastaria montar o pedido fora da tela para criar a
   * senha sem ter aceitado nada — e o aceite perderia o sentido.
   *
   * Só vale para ALUNO. Professor e admin ativam a conta pelas mesmas rotas e
   * não assinam um termo que fala de mensalidade e reposição de aula.
   */
  private conferirAceiteDoTermo(tipoUsuario: string, versaoAceita?: string) {
    if (tipoUsuario !== "ALUNO") return;
    if (!versaoAceita) {
      throw new BadRequestException(
        "É preciso aceitar o Termo de Normas para concluir o primeiro acesso.",
      );
    }
    if (versaoAceita !== VERSAO_TERMO) {
      // Acontece quando o estúdio publica um termo novo com a tela aberta: o
      // aluno leu a redação antiga, e registrar esse aceite como se fosse do
      // texto novo seria falso.
      throw new BadRequestException(
        "O termo foi atualizado enquanto você lia. Recarregue a página e leia a versão nova.",
      );
    }
  }

  /**
   * A linha do aceite, para entrar na MESMA transação que cria a senha: ou o
   * aluno é ativado e o aceite fica registrado, ou nada acontece.
   */
  private gravarAceiteDoTermo(usuarioId: string, tipoUsuario: string) {
    if (tipoUsuario !== "ALUNO") return [];
    return [
      this.prisma.aceiteTermo.create({
        data: { usuarioId, versao: VERSAO_TERMO },
      }),
    ];
  }

  /**
   * Senha definida pelo admin para um aluno ou professor.
   *
   * Existe porque o estúdio não envia e-mail: sem isto, senha perdida é conta
   * perdida — não há "esqueci minha senha" para o usuário resolver sozinho.
   * Serve também para deixar a conta pronta para uso já na criação, sem
   * depender de alguém abrir o link de primeiro acesso.
   *
   * Ativa a conta (é o que o primeiro acesso faria), queima qualquer link
   * pendente e derruba as sessões abertas — se a senha está sendo trocada
   * porque vazou ou se perdeu, quem estava logado com a antiga tem que sair.
   */
  async definirSenhaPorAdmin(usuarioId: string, senha: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException("Usuário não encontrado");
    if (usuario.tipoUsuario === "ADMIN") {
      throw new ForbiddenException(
        "A senha de administrador não é alterada por aqui.",
      );
    }
    const senhaHash = await bcrypt.hash(senha, 12);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { senhaHash, ativo: true },
      }),
      this.prisma.primeiroAcesso.updateMany({
        where: { usuarioId, usado: false },
        data: { usado: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { usuarioId, revogado: false },
        data: { revogado: true },
      }),
    ]);
    return { mensagem: "Senha definida. A conta está ativa." };
  }

  async refreshToken(token: string) {
    const reg = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { usuario: true },
    });
    if (!reg || reg.revogado) throw new UnauthorizedException("Token inválido");
    if (dayjs().isAfter(reg.expiraEm))
      throw new UnauthorizedException("Token expirado");
    await this.prisma.refreshToken.update({
      where: { id: reg.id },
      data: { revogado: true },
    });
    return this.gerarTokens(
      reg.usuarioId,
      reg.usuario.tipoUsuario,
      reg.usuario.nome,
    );
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken, revogado: false },
      data: { revogado: true },
    });
    return { mensagem: "Logout realizado" };
  }

  async gerarLinkPrimeiroAcesso(usuarioId: string) {
    const token = uuidv4();
    const expiraEm = dayjs().add(72, "hour").toDate();
    await this.prisma.primeiroAcesso.upsert({
      where: { usuarioId },
      update: { token, expiraEm, usado: false },
      create: { usuarioId, token, expiraEm },
    });
    return { link: `${this.baseDoApp()}/primeiro-acesso?token=${token}`, token };
  }

  /**
   * Base dos links de primeiro acesso enviados aos alunos.
   *
   * Um link para localhost não abre no celular de ninguém — e localhost é
   * justamente o que está no `.env` versionado, que sobe junto no deploy. Por
   * isso o valor local é RECUSADO, em vez de virar um link quebrado na mão do
   * aluno; quem testa o fluxo na própria máquina libera com APP_URL_LOCAL=1.
   *
   * A checagem não olha NODE_ENV de propósito: esse mesmo `.env` declara
   * "development", então ele não serve para saber se a API está em produção.
   */
  private baseDoApp(): string {
    const configurada = (this.config.get<string>("APP_URL") ?? "")
      .trim()
      .replace(/\/+$/, ""); // barra no fim geraria //primeiro-acesso
    if (!configurada) return APP_URL_PUBLICA;
    const ehLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.0\.2\.2)(:|\/|$)/i.test(
      configurada,
    );
    if (ehLocal && this.config.get("APP_URL_LOCAL") !== "1") return APP_URL_PUBLICA;
    return configurada;
  }

  private async gerarTokens(
    usuarioId: string,
    tipoUsuario: string,
    nome: string,
  ) {
    const payload = { sub: usuarioId, tipo: tipoUsuario };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: "15m",
      secret: segredoJwt(this.config),
    });
    const refreshToken = uuidv4();
    const expiraEm = dayjs().add(7, "day").toDate();
    await this.prisma.refreshToken.create({
      data: { usuarioId, token: refreshToken, expiraEm },
    });
    return { accessToken, refreshToken, tipoUsuario, usuarioId, nome };
  }
}
