import {
  BadRequestException,
  ConflictException,
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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
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
    ]);
    return this.gerarTokens(
      registro.usuarioId,
      registro.usuario.tipoUsuario,
      registro.usuario.nome,
    );
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
    const baseUrl = this.config.get("APP_URL") || "http://localhost:8081";
    return { link: `${baseUrl}/primeiro-acesso?token=${token}`, token };
  }

  private async gerarTokens(
    usuarioId: string,
    tipoUsuario: string,
    nome: string,
  ) {
    const payload = { sub: usuarioId, tipo: tipoUsuario };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: "15m",
      secret: this.config.get("JWT_SECRET") || "studio-jwt-secret-dev",
    });
    const refreshToken = uuidv4();
    const expiraEm = dayjs().add(7, "day").toDate();
    await this.prisma.refreshToken.create({
      data: { usuarioId, token: refreshToken, expiraEm },
    });
    return { accessToken, refreshToken, tipoUsuario, usuarioId, nome };
  }
}
