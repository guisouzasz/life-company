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
import { AlterarSenhaDto } from './dto/alterar-senha.dto';
import { EmailService } from '../email/email.service';
import { modeloRedefinirSenha } from '../email/modelo-redefinir-senha';
import { nomeCurto } from '../comum/nome';
import { PrimeiroAcessoDto } from "./dto/primeiro-acesso.dto";
import { AtivarContaDto, erroDeEmail } from "./dto/ativar-conta.dto";
import { segredoJwt } from "./jwt.config";
import { VERSAO_TERMO } from "../termos/termo";

/** Domínio público do estúdio — destino dos links de primeiro acesso. */
const APP_URL_PUBLICA = "https://www.academialifecompany.com.br";

/**
 * O que os dois caminhos de ativação têm em comum na ficha do aluno.
 * `AtivarContaDto` (sem link) e `PrimeiroAcessoDto` (com link) declaram os
 * mesmos campos; este tipo deixa uma função só atender aos dois.
 */
type FichaDoPrimeiroAcesso = {
  email?: string;
  telefone?: string;
  rg?: string;
  endereco?: string;
  cep?: string;
  dataNascimento?: string;
};

/** Quanto vale o link de acesso. O e-mail avisa o mesmo número. */
const HORAS_DO_LINK = 72;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private email: EmailService,
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
        // A marca de dono vem daqui para o app saber se mostra a área de
        // registro. É só uma dica de tela — quem manda é o guard na API.
        dono: true,
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
    /**
     * Conta que já tem senha não é erro — é quem esqueceu a senha.
     *
     * Antes isto recusava com "Conta já ativada", e não havia MAIS NENHUM
     * caminho de volta: o estúdio não manda e-mail, então não existe link de
     * recuperação, e a rota que define senha de professor recusa admin. Quem
     * esquecia a senha ficava fora do app para sempre.
     *
     * Agora o mesmo link serve para as duas coisas. Quem manda continua sendo
     * a dona, pelo botão "Link" no cadastro do aluno — ninguém redefine a
     * própria senha sozinho, e o link expira.
     */
    const redefinindo = !!registro.usuario.senhaHash;
    // O termo é assinado uma vez, na entrada. Redefinir senha não é reassinar.
    if (!redefinindo) this.conferirAceiteDoTermo(registro.usuario.tipoUsuario, dto.termoVersao);
    /*
      Quem está redefinindo já preencheu a ficha um dia — não faz sentido
      pedir RG e CEP de novo para quem só quer voltar a entrar.
    */
    const ficha = redefinindo ? {} : await this.fichaDaAtivacao(registro.usuario, dto);
    const senhaHash = await bcrypt.hash(dto.senha, 12);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: registro.usuarioId },
        data: { senhaHash, ativo: true, ...ficha },
      }),
      this.prisma.primeiroAcesso.update({
        where: { id: registro.id },
        data: { usado: true },
      }),
      /*
        Senha nova derruba as sessões antigas: se a pessoa está redefinindo
        porque perdeu o aparelho, deixar o token velho valendo não adiantaria
        nada.
      */
      this.prisma.refreshToken.updateMany({
        where: { usuarioId: registro.usuarioId, revogado: false },
        data: { revogado: true },
      }),
      ...(redefinindo ? [] : this.gravarAceiteDoTermo(registro.usuarioId, registro.usuario.tipoUsuario)),
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

    this.conferirAceiteDoTermo(usuario.tipoUsuario, dto.termoVersao);
    const ficha = await this.fichaDaAtivacao(usuario, dto);
    const senhaHash = await bcrypt.hash(dto.senha, 12);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { senhaHash, ativo: true, ...ficha },
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
   * A ficha cadastral que o ALUNO preenche no primeiro acesso.
   *
   * O cadastro feito pela dona pede só nome e CPF — ela cadastra no balcão,
   * com o aluno na frente, e não tem RG nem CEP à mão. Os dados pessoais são
   * exigidos aqui, onde quem digita é o dono deles.
   *
   * Professor e admin ativam pela mesma rota e não têm ficha: para eles isto
   * devolve vazio e nada é gravado.
   */
  private async fichaDaAtivacao(
    usuario: { id: string; tipoUsuario: string },
    dto: FichaDoPrimeiroAcesso,
  ) {
    const tipoUsuario = usuario.tipoUsuario;
    if (tipoUsuario !== "ALUNO") return {};

    const cep = dto.cep?.replace(/\D/g, "");
    const faltando: string[] = [];
    if (!dto.email?.trim()) faltando.push("e-mail");
    if (!dto.telefone?.trim()) faltando.push("telefone");
    if (!dto.rg?.trim()) faltando.push("RG");
    if (!dto.endereco?.trim()) faltando.push("endereço");
    if (!cep || cep.length !== 8) faltando.push("CEP");
    if (!dto.dataNascimento) faltando.push("data de nascimento");
    if (faltando.length > 0) {
      throw new BadRequestException(
        `Para concluir o cadastro, informe: ${faltando.join(", ")}.`,
      );
    }

    const nascimento = new Date(`${dto.dataNascimento}T00:00:00`);
    const [ano, mes, dia] = dto.dataNascimento!.split("-").map(Number);
    const dataInvalida =
      Number.isNaN(nascimento.getTime()) ||
      nascimento.getFullYear() !== ano ||
      nascimento.getMonth() + 1 !== mes ||
      nascimento.getDate() !== dia ||
      ano < 1900 ||
      nascimento > new Date();
    if (dataInvalida) {
      throw new BadRequestException("Data de nascimento inválida — confira o dia, o mês e o ano.");
    }

    const email = dto.email!.trim().toLowerCase();
    const erroEmail = erroDeEmail(email);
    if (erroEmail) throw new BadRequestException(erroEmail);
    const emailEmUso = await this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, id: { not: usuario.id } },
    });
    if (emailEmUso) {
      throw new ConflictException("Este e-mail já está em uso por outra conta.");
    }

    return {
      email,
      telefone: dto.telefone!.replace(/\D/g, ""),
      rg: dto.rg!.trim(),
      endereco: dto.endereco!.trim(),
      cep,
      dataNascimento: nascimento,
    };
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

  /**
   * Troca a própria senha, sabendo a atual.
   *
   * Existe porque não havia NENHUMA forma de um admin trocar a própria senha:
   * a rota que define senha de aluno e professor recusa contas de
   * administrador de propósito, e o estúdio não manda e-mail de recuperação.
   * A senha inicial do dono, colocada por variável de ambiente na primeira
   * subida, ficaria valendo para sempre — guardada em texto no painel da
   * hospedagem.
   *
   * Vale para qualquer conta com senha, inclusive ADMIN e dono.
   */
  async alterarSenha(usuarioId: string, dto: AlterarSenhaDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario?.senhaHash) throw new NotFoundException("Conta não encontrada");

    const confere = await bcrypt.compare(dto.senhaAtual, usuario.senhaHash);
    if (!confere) throw new UnauthorizedException("A senha atual não confere.");
    if (dto.senhaAtual === dto.novaSenha) {
      throw new BadRequestException("A senha nova precisa ser diferente da atual.");
    }

    const senhaHash = await bcrypt.hash(dto.novaSenha, 12);
    await this.prisma.$transaction([
      this.prisma.usuario.update({ where: { id: usuarioId }, data: { senhaHash } }),
      /*
        Derruba as outras sessões. Quem troca a senha quase sempre está
        trocando porque desconfia de alguém — deixar o token antigo valendo
        esvaziaria o gesto. A sessão atual continua: o app renova com o token
        que acabou de receber.
      */
      this.prisma.refreshToken.updateMany({
        where: { usuarioId, revogado: false },
        data: { revogado: true },
      }),
    ]);
    return { mensagem: "Senha alterada. As outras sessões foram desconectadas." };
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

  /**
   * "Esqueci minha senha": manda o link para o e-mail do próprio aluno.
   *
   * O e-mail é o canal certo AQUI, e só aqui. O estúdio fala por WhatsApp,
   * mas o WhatsApp da dona não prova quem está do outro lado — e um link de
   * senha tem que chegar numa caixa que só o dono da conta abre.
   *
   * A resposta é a MESMA existindo ou não o e-mail. Esta rota é pública e
   * fica na internet: responder "não achei" a transformaria numa forma de
   * descobrir quem treina no estúdio, um e-mail por vez.
   *
   * Sem SMTP configurado, ela diz isso em vez de fingir que mandou — a tela
   * então oferece o caminho antigo, de pedir o link à dona.
   */
  async esqueciMinhaSenha(email: string) {
    const generico = {
      mensagem:
        'Se este e-mail estiver num cadastro, o link para criar uma senha nova chega em alguns minutos. ' +
        'Confira também a caixa de spam.',
    };

    if (!this.email.ligado) {
      return {
        mensagem:
          'O envio de e-mail ainda não está ligado neste estúdio. ' +
          'Peça o link de acesso direto à recepção — ela gera na hora, pelo cadastro.',
        enviado: false,
      };
    }

    const alvo = email.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findFirst({
      where: { email: { equals: alvo, mode: 'insensitive' } },
      select: { id: true, nome: true, email: true, ativo: true, senhaHash: true },
    });

    /*
      Conta desligada não recebe link: devolver o acesso a quem o estúdio
      desativou é decisão da dona, não de quem digita um e-mail. O aluno que
      ainda não fez o primeiro acesso PASSA — para ele o link é justamente o
      caminho de entrada.
    */
    const desligado = usuario && !usuario.ativo && usuario.senhaHash;
    if (!usuario || desligado) return generico;

    const { link } = await this.gerarLinkPrimeiroAcesso(usuario.id);
    const linkRedefinir = `${link}&redefinir=1`;
    const { assunto, texto, html } = modeloRedefinirSenha(
      nomeCurto(usuario.nome),
      linkRedefinir,
      HORAS_DO_LINK,
    );
    await this.email.enviar(usuario.email!, assunto, texto, html);
    return generico;
  }

  async gerarLinkPrimeiroAcesso(usuarioId: string) {
    const token = uuidv4();
    const expiraEm = dayjs().add(HORAS_DO_LINK, "hour").toDate();
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
