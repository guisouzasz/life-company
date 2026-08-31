import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as dayjs from "dayjs";
import * as isoWeek from "dayjs/plugin/isoWeek";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { CriarUsuarioDto } from "./dto/criar-usuario.dto";

(dayjs as any).extend((isoWeek as any).default || isoWeek);

/**
 * Campos do cadastro que podem sair da API.
 *
 * Existe porque consultar sem `select` devolve a linha inteira do banco — e a
 * linha inteira inclui `senhaHash`. A rota de listagem é liberada para
 * PROFESSOR, então o hash da senha de todos os alunos estava indo para
 * qualquer conta de professor (e as do estúdio são compartilhadas por
 * modalidade). Hash de senha se quebra offline, sem limite de tentativas.
 *
 * `fcmToken` também fica de fora: é o endereço de notificação do aparelho do
 * aluno, não serve para nenhuma tela.
 *
 * Ao adicionar coluna nova no schema, decida aqui se ela sai ou não — o
 * padrão passa a ser NÃO sair.
 */
const CAMPOS_DO_CADASTRO = {
  id: true,
  nome: true,
  cpf: true,
  email: true,
  telefone: true,
  rg: true,
  endereco: true,
  cep: true,
  dataNascimento: true,
  ativo: true,
  tipoUsuario: true,
  valorMensalidade: true,
  diaVencimento: true,
  modalidadeProfessorId: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  /** CEP só com dígitos; undefined quando não veio nada. */
  private normalizarCep(cep?: string): string | undefined {
    const d = cep?.replace(/\D/g, "");
    return d ? d : undefined;
  }

  /**
   * Data de nascimento YYYY-MM-DD → Date no início do dia.
   * Recusa data inexistente, futura ou anterior a 1900. O Date do JS "conserta"
   * sozinho uma data impossível (31/02 vira 03/03), então comparar os campos de
   * volta é o que pega esse caso.
   */
  private converterNascimento(valor?: string): Date | undefined {
    if (!valor) return undefined;
    const data = new Date(`${valor}T00:00:00`);
    const [ano, mes, dia] = valor.split("-").map(Number);
    const invalida =
      Number.isNaN(data.getTime()) ||
      data.getFullYear() !== ano ||
      data.getMonth() + 1 !== mes ||
      data.getDate() !== dia ||
      ano < 1900;
    if (invalida) throw new ConflictException("Data de nascimento inválida");
    if (data > new Date()) {
      throw new ConflictException("Data de nascimento não pode ser no futuro");
    }
    return data;
  }

  /** A ficha cadastral completa é exigida do ALUNO; do PROFESSOR, não. */
  private exigirFichaDoAluno(dto: CriarUsuarioDto) {
    const faltando: string[] = [];
    if (!dto.rg?.trim()) faltando.push("RG");
    if (!dto.endereco?.trim()) faltando.push("endereço");
    if (!this.normalizarCep(dto.cep)) faltando.push("CEP");
    if (!dto.email?.trim()) faltando.push("e-mail");
    if (!dto.dataNascimento) faltando.push("data de nascimento");
    if (faltando.length > 0) {
      throw new ConflictException(`Cadastro do aluno exige: ${faltando.join(", ")}`);
    }
  }

  async criar(dto: CriarUsuarioDto) {
    const tipo = dto.tipoUsuario === "PROFESSOR" ? "PROFESSOR" : "ALUNO";
    if (tipo === "ALUNO" && (!dto.planoId || !dto.modalidadeId)) {
      throw new ConflictException("Aluno precisa de plano e modalidade");
    }
    if (tipo === "ALUNO") this.exigirFichaDoAluno(dto);
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
      select: CAMPOS_DO_CADASTRO,
      data: {
        nome: dto.nome,
        cpf: cpfNorm,
        email: dto.email,
        telefone: dto.telefone,
        rg: dto.rg?.trim() || null,
        endereco: dto.endereco?.trim() || null,
        cep: this.normalizarCep(dto.cep) ?? null,
        dataNascimento: this.converterNascimento(dto.dataNascimento) ?? null,
        tipoUsuario: tipo as any,
        ...(tipo === "PROFESSOR" ? { modalidadeProfessorId: dto.modalidadeId } : {}),
        // Mensalidade é coisa de aluno; professor não paga plano.
        ...(tipo === "ALUNO"
          ? {
              ...(dto.valorMensalidade !== undefined
                ? { valorMensalidade: dto.valorMensalidade }
                : {}),
              ...(dto.diaVencimento !== undefined ? { diaVencimento: dto.diaVencimento } : {}),
            }
          : {}),
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
    const alunos = await this.prisma.usuario.findMany({
      select: {
        ...CAMPOS_DO_CADASTRO,
        // Entra só para virar o booleano `ativado` logo abaixo — o hash em si
        // nunca sai daqui (mesmo cuidado de `listarProfessores`).
        senhaHash: true,
        // Só o plano vigente: o histórico de planos encerrados não é da lista.
        usuarioPlanos: {
          select: { plano: true, modalidade: true },
          where: { vigenciaFim: null },
        },
      },
      where: {
        tipoUsuario: "ALUNO",
        // Esconde contas excluídas (anonimizadas) da gestão
        NOT: { cpf: { startsWith: "REMOVIDO-" } },
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
      orderBy: { nome: "asc" },
    });

    /**
     * `ativado` = já tem senha, ou seja, passou pelo primeiro acesso.
     *
     * É diferente de `ativo`: o cadastro novo nasce inativo e só liga quando o
     * aluno abre o app. Sem separar os dois, quem a dona acabou de cadastrar
     * aparece como "Inativo" — que na tela dela quer dizer aluno desligado.
     */
    return alunos.map(({ senhaHash, ...a }) => ({ ...a, ativado: !!senhaHash }));
  }

  /**
   * Professores do estúdio, com a modalidade de cada um.
   *
   * Vive separado de `listar` porque aquela é a lista de alunos, e misturar as
   * duas colocaria professor no meio da gestão de planos. Sem esta rota, o
   * professor criado sumia da vista do admin: não havia tela nenhuma onde ele
   * aparecesse depois de cadastrado.
   *
   * `ativado` diz se a conta já tem senha — é o que separa "aguardando
   * primeiro acesso" de "pronta para usar". O hash em si nunca sai daqui.
   */
  async listarProfessores() {
    const professores = await this.prisma.usuario.findMany({
      where: {
        tipoUsuario: "PROFESSOR",
        NOT: { cpf: { startsWith: "REMOVIDO-" } },
      },
      select: {
        id: true,
        nome: true,
        cpf: true,
        email: true,
        telefone: true,
        ativo: true,
        senhaHash: true,
        createdAt: true,
        modalidadeProfessor: { select: { id: true, nome: true } },
      },
      orderBy: { nome: "asc" },
    });
    return professores.map(({ senhaHash, ...p }) => ({ ...p, ativado: !!senhaHash }));
  }

  /** Define a senha de um aluno/professor (o estúdio não envia e-mail). */
  async definirSenha(id: string, senha: string) {
    return this.authService.definirSenhaPorAdmin(id, senha);
  }

  async buscarPorId(id: string) {
    const u = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        ...CAMPOS_DO_CADASTRO,
        usuarioPlanos: { include: { plano: true, modalidade: true } },
      },
    });
    if (!u) throw new NotFoundException("Usuário não encontrado");
    return u;
  }

  /**
   * Edição completa do cadastro: nome, CPF, e-mail, telefone, ficha cadastral
   * (RG, endereço, CEP, nascimento) e status ativo/inativo — com checagem de
   * unicidade (CPF/e-mail) excluindo o próprio.
   *
   * Cada campo só é tocado quando vem no corpo: assim dá para corrigir um dado
   * isolado sem apagar o resto, e os cadastros antigos, sem ficha, continuam
   * editáveis normalmente.
   */
  async atualizar(id: string, data: Partial<CriarUsuarioDto> & { ativo?: boolean }) {
    const atual = await this.buscarPorId(id);

    // Corrigir a modalidade do professor. Só vale para PROFESSOR: no aluno o
    // `modalidadeId` pertence ao plano, e quem troca isso é `atualizarPlano`.
    // Sem esta linha, professor cadastrado na modalidade errada só se resolvia
    // apagando e refazendo a conta — e a modalidade decide o que ele enxerga:
    // a agenda dela e o formato da ficha de treino.
    const modalidadeProfessorId =
      atual.tipoUsuario === "PROFESSOR" && data.modalidadeId
        ? data.modalidadeId
        : undefined;

    const cpfNorm = data.cpf !== undefined ? data.cpf.replace(/\D/g, "") : undefined;
    if (cpfNorm !== undefined && cpfNorm.length !== 11) {
      throw new ConflictException("CPF deve ter 11 dígitos");
    }
    if (cpfNorm) {
      const outro = await this.prisma.usuario.findFirst({
        where: { cpf: cpfNorm, id: { not: id } },
      });
      if (outro) throw new ConflictException("Já existe um cadastro com este CPF");
    }
    if (data.email) {
      const outro = await this.prisma.usuario.findFirst({
        where: { email: data.email, id: { not: id } },
      });
      if (outro) throw new ConflictException("Já existe um cadastro com este e-mail");
    }

    const atualizado = await this.prisma.usuario.update({
      where: { id },
      select: CAMPOS_DO_CADASTRO,
      data: {
        nome: data.nome,
        cpf: cpfNorm,
        // e-mail vazio limpa o campo (o aluno cadastra o dele na ativação)
        email: data.email !== undefined ? data.email || null : undefined,
        telefone: data.telefone !== undefined ? data.telefone || null : undefined,
        rg: data.rg !== undefined ? data.rg.trim() || null : undefined,
        endereco: data.endereco !== undefined ? data.endereco.trim() || null : undefined,
        cep: data.cep !== undefined ? this.normalizarCep(data.cep) ?? null : undefined,
        dataNascimento:
          data.dataNascimento !== undefined
            ? this.converterNascimento(data.dataNascimento) ?? null
            : undefined,
        ativo: data.ativo,
        modalidadeProfessorId,
      },
    });

    /**
     * Desativar pela ficha tem que tirar das turmas igual ao botão de
     * desativar.
     *
     * Este é o caminho que o estúdio realmente usa: a dona abre o cadastro,
     * marca "Inativo" e salva. Se a limpeza morasse só no DELETE, o aluno
     * continuaria ocupando vaga em toda turma — que era exatamente o que
     * estava acontecendo.
     */
    const desligou = atual.ativo && data.ativo === false;
    if (desligou) {
      const limpeza = await this.tirarDasTurmas(id);
      return { ...atualizado, ...limpeza };
    }

    return atualizado;
  }

  /**
   * Desliga os horários fixos e cancela as aulas futuras de quem saiu.
   *
   * Não gera crédito de reposição: o aluno está saindo do estúdio, não perdeu
   * uma aula que precise repor.
   */
  private async tirarDasTurmas(usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { count: horariosFixosRemovidos } = await tx.horarioFixo.updateMany({
        where: { usuarioId, ativo: true },
        data: { ativo: false },
      });

      // Só as futuras: aula que já aconteceu é histórico e não se apaga.
      const { count: aulasCanceladas } = await tx.agendamento.updateMany({
        where: {
          usuarioId,
          status: "CONFIRMADO",
          dataAula: { gte: dayjs().startOf("day").toDate() },
        },
        data: { status: "CANCELADO" },
      });

      return { horariosFixosRemovidos, aulasCanceladas };
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

  /**
   * Desativa o cadastro E o tira das turmas.
   *
   * Antes isto só marcava `ativo: false`, e o resto ficava de pé: os horários
   * fixos continuavam ativos, as aulas futuras continuavam CONFIRMADAS, e o
   * cron das 3h seguia gerando aulas novas para quem já tinha saído do
   * estúdio. Como a lotação conta agendamento confirmado sem olhar se a
   * pessoa ainda é aluna, as turmas iam enchendo de gente que não treina mais
   * — e a dona, ao tentar colocar alguém num horário fixo, recebia "turma
   * lotada" e concluía que o sistema não estava fixando ninguém. Era esse o
   * problema do horário fixo que não pegava.
   *
   * Não gera crédito de reposição: o aluno está saindo, não perdeu aula.
   *
   * Reativar depois NÃO devolve os horários fixos — eles precisam ser
   * recadastrados. É o comportamento previsível: as turmas mudam, e devolver
   * automaticamente alguém a um horário de meses atrás causaria surpresa pior.
   */
  async excluir(id: string) {
    const usuario = await this.buscarPorId(id);
    const { horariosFixosRemovidos, aulasCanceladas } = await this.tirarDasTurmas(id);
    await this.prisma.usuario.update({ where: { id }, data: { ativo: false } });

    const partes: string[] = [];
    if (horariosFixosRemovidos > 0) partes.push(`${horariosFixosRemovidos} horário(s) fixo(s) removido(s)`);
    if (aulasCanceladas > 0) partes.push(`${aulasCanceladas} aula(s) futura(s) cancelada(s)`);

    return {
      mensagem:
        partes.length > 0
          ? `${usuario.nome} foi desativado. ${partes.join(" e ")} — as vagas voltaram para as turmas.`
          : `${usuario.nome} foi desativado.`,
      horariosFixosRemovidos,
      aulasCanceladas,
    };
  }

  /**
   * Apaga o aluno de vez.
   *
   * Desativar guarda o cadastro para quem pode voltar; isto é para quem não
   * volta — o estúdio pediu porque a lista ia acumulando gente de anos atrás.
   *
   * "Definitivo" aqui é sobre a PESSOA, não sobre a contabilidade: os dados
   * pessoais e o conteúdo dela somem (nome, CPF, contato, treinos, cargas,
   * créditos, acessos), e as aulas e pagamentos ficam como histórico anônimo.
   * Apagar a linha inteira quebraria o financeiro e a frequência de meses
   * fechados — o estúdio perderia o próprio passado para tirar um nome de uma
   * lista.
   *
   * É a mesma rotina que o aluno usa para excluir a própria conta pelo app
   * (exigência das lojas e da LGPD), agora acessível ao estúdio.
   */
  async excluirDefinitivamente(id: string) {
    const usuario = await this.buscarPorId(id);
    if (usuario.tipoUsuario === "ADMIN") {
      throw new ForbiddenException(
        "Contas de administrador não podem ser excluídas por aqui.",
      );
    }

    // Antes de anonimizar, tira das turmas — senão as vagas ficariam ocupadas
    // por um registro que nem nome tem mais.
    await this.excluir(id);
    const r = await this.authService.excluirMinhaConta(id);

    // "O cadastro de Fulana" e não "Fulana foi excluído": o sistema não sabe o
    // gênero de ninguém, e metade do estúdio é mulher.
    return {
      mensagem: `O cadastro de ${usuario.nome} foi excluído definitivamente. ${r.mensagem.replace(/^Sua conta foi excluída\. /, "")}`,
    };
  }

  async saldoSemanal(usuarioId: string) {
    const plano = await this.prisma.usuarioPlano.findFirst({
      where: { usuarioId, vigenciaFim: null },
      include: { plano: true, modalidade: true },
    });
    if (!plano) throw new NotFoundException("Plano não encontrado");
    const inicioSemana = dayjs().startOf("isoWeek").toDate();
    const fimSemana = dayjs().endOf("isoWeek").toDate();

    // Conta as aulas REAIS da semana corrente, do mesmo jeito que a validação
    // de limite em agendamentos.service. O contador aulasUsadasSemana não é
    // usado aqui: ele desanda quando se geram aulas de semanas futuras.
    const usadas = await this.prisma.agendamento.count({
      where: {
        usuarioId,
        dataAula: { gte: inicioSemana, lte: fimSemana },
        status: { in: ["CONFIRMADO", "REALIZADO"] },
        reposicao: false, // reposição usa crédito, não a cota da semana
      },
    });

    // Mantém o contador em dia para os relatórios que ainda o leem.
    if (
      dayjs(plano.semanaReferencia).isBefore(inicioSemana) ||
      plano.aulasUsadasSemana !== usadas
    ) {
      await this.prisma.usuarioPlano.update({
        where: { id: plano.id },
        data: { aulasUsadasSemana: usadas, semanaReferencia: inicioSemana },
      });
    }

    return {
      usadas,
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
