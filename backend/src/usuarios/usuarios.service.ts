import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as dayjs from "dayjs";
import * as isoWeek from "dayjs/plugin/isoWeek";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { CriarUsuarioDto } from "./dto/criar-usuario.dto";

(dayjs as any).extend((isoWeek as any).default || isoWeek);

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async criar(dto: CriarUsuarioDto) {
    const tipo = dto.tipoUsuario === "PROFESSOR" ? "PROFESSOR" : "ALUNO";
    if (tipo === "ALUNO" && (!dto.planoId || !dto.modalidadeId)) {
      throw new ConflictException("Aluno precisa de plano e modalidade");
    }
    // Professor pertence a UMA modalidade: só vê a agenda e os treinos dela.
    if (tipo === "PROFESSOR" && !dto.modalidadeId) {
      throw new ConflictException("Professor precisa de uma modalidade");
    }
    const cpfNorm = dto.cpf.replace(/\D/g, "");
    const condicoes: object[] = [{ cpf: cpfNorm }];
    if (dto.email) condicoes.push({ email: dto.email });
    const existe = await this.prisma.usuario.findFirst({
      where: { OR: condicoes },
    });
    if (existe) throw new ConflictException("CPF ou e-mail já cadastrado");
    const usuario = await this.prisma.usuario.create({
      data: {
        nome: dto.nome,
        cpf: cpfNorm,
        email: dto.email,
        telefone: dto.telefone,
        tipoUsuario: tipo as any,
        ...(tipo === "PROFESSOR" ? { modalidadeProfessorId: dto.modalidadeId } : {}),
        ativo: false,
      },
    });
    if (tipo === "ALUNO") {
      const inicioSemana = dayjs().startOf("week").add(1, "day").toDate();
      await this.prisma.usuarioPlano.create({
        data: {
          usuarioId: usuario.id,
          planoId: dto.planoId!,
          modalidadeId: dto.modalidadeId!,
          vigenciaInicio: new Date(),
          semanaReferencia: inicioSemana,
        },
      });
    }
    const { link } = await this.authService.gerarLinkPrimeiroAcesso(usuario.id);
    return { usuario, linkAcesso: link };
  }

  async listar(busca?: string) {
    return this.prisma.usuario.findMany({
      where: {
        tipoUsuario: "ALUNO",
        ...(busca
          ? {
              OR: [
                { nome: { contains: busca, mode: "insensitive" } },
                { cpf: { contains: busca } },
                { email: { contains: busca, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        usuarioPlanos: {
          include: { plano: true, modalidade: true },
          where: { vigenciaFim: null },
        },
      },
      orderBy: { nome: "asc" },
    });
  }

  async buscarPorId(id: string) {
    const u = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        usuarioPlanos: { include: { plano: true, modalidade: true } },
      },
    });
    if (!u) throw new NotFoundException("Usuário não encontrado");
    return u;
  }

  async atualizar(id: string, data: Partial<CriarUsuarioDto>) {
    await this.buscarPorId(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { nome: data.nome, email: data.email, telefone: data.telefone },
    });
  }

  async atualizarPlano(usuarioId: string, dto: { planoId: string; modalidadeId: string }) {
    await this.buscarPorId(usuarioId);
    const atual = await this.prisma.usuarioPlano.findFirst({
      where: { usuarioId, vigenciaFim: null },
    });
    const agora = new Date();
    const inicioSemana = dayjs().startOf("isoWeek").toDate();
    return this.prisma.$transaction(async (tx) => {
      if (atual) {
        await tx.usuarioPlano.update({
          where: { id: atual.id },
          data: { vigenciaFim: agora },
        });
      }
      return tx.usuarioPlano.create({
        data: {
          usuarioId,
          planoId: dto.planoId,
          modalidadeId: dto.modalidadeId,
          vigenciaInicio: agora,
          semanaReferencia: inicioSemana,
          aulasUsadasSemana: 0,
        },
        include: { plano: true, modalidade: true },
      });
    });
  }

  async excluir(id: string) {
    await this.buscarPorId(id);
    await this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
    return { mensagem: "Usuário desativado" };
  }

  async saldoSemanal(usuarioId: string) {
    const plano = await this.prisma.usuarioPlano.findFirst({
      where: { usuarioId, vigenciaFim: null },
      include: { plano: true, modalidade: true },
    });
    if (!plano) throw new NotFoundException("Plano não encontrado");
    // Verifica reset semanal
    const inicioSemana = dayjs().startOf("isoWeek").toDate();
    if (dayjs(plano.semanaReferencia).isBefore(inicioSemana)) {
      await this.prisma.usuarioPlano.update({
        where: { id: plano.id },
        data: { aulasUsadasSemana: 0, semanaReferencia: inicioSemana },
      });
      plano.aulasUsadasSemana = 0;
    }
    return {
      usadas: plano.aulasUsadasSemana,
      total: plano.plano.aulasSemanais,
      modalidade: plano.modalidade.nome,
      plano: plano.plano.nome,
    };
  }

  async gerarLink(usuarioId: string) {
    return this.authService.gerarLinkPrimeiroAcesso(usuarioId);
  }

  async atualizarFcmToken(usuarioId: string, fcmToken: string) {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { fcmToken },
    });
    return { mensagem: "Token FCM atualizado" };
  }
}
