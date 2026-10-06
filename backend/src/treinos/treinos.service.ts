import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { SalvarTreinoDto } from './dto/salvar-treino.dto';
import { SalvarTreinoDiaDto } from './dto/salvar-treino-dia.dto';
import { escolherModalidade, modalidadesDoProfessor, modalidadesQueLimitam } from '../usuarios/modalidades-do-professor';

type Solicitante = { id: string; tipo: string };

/**
 * Treinos montados pelo professor para os alunos.
 * O professor dá aula em uma ou mais modalidades: cria treinos carimbados com
 * uma delas e só vê/edita treinos das suas. Admin vê e gerencia tudo.
 * O aluno lê os próprios treinos (todas as modalidades).
 */
@Injectable()
export class TreinosService {
  constructor(private prisma: PrismaService) {}

  private readonly incluir = {
    exercicios: { orderBy: { ordem: 'asc' as const } },
    professor: { select: { id: true, nome: true } },
    aluno: { select: { id: true, nome: true } },
    modalidade: { select: { id: true, nome: true } },
  };

  /** Modalidades do professor (null para admin). Professor sem modalidade é barrado. */
  private modalidadesDe(solicitante: Solicitante): Promise<string[] | null> {
    return modalidadesQueLimitam(this.prisma, solicitante);
  }

  /** Treinos ativos do aluno logado (todas as modalidades). */
  async meus(alunoId: string) {
    return this.prisma.treino.findMany({
      where: { alunoId, ativo: true },
      include: this.incluir,
      orderBy: [{ concluido: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  /** Treinos de um aluno — professor vê só os das suas modalidades. */
  async doAluno(alunoId: string, solicitante: Solicitante) {
    const modalidades = await this.modalidadesDe(solicitante);
    return this.prisma.treino.findMany({
      where: { alunoId, ativo: true, ...(modalidades ? { modalidadeId: { in: modalidades } } : {}) },
      include: this.incluir,
      orderBy: [{ concluido: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  /**
   * A situação de cada aluno, numa consulta só, para a lista do professor.
   *
   * Sem isto, saber quem está sem ficha ou com a ficha vencida exigia abrir
   * aluno por aluno — ninguém faz isso, e o aluno novo passava semanas
   * treinando "de cabeça". Aqui vêm: quantas fichas em uso, o vencimento mais
   * próximo, a última carga registrada e a próxima aula dele nas turmas do
   * professor (é o que separa "precisa de ficha para amanhã" de "sumiu").
   *
   * Tudo limitado às modalidades de quem pede, como o resto dos treinos.
   * Funcional fica fora da próxima aula: lá o treino é o do dia, não ficha.
   */
  async resumo(solicitante: Solicitante) {
    const modalidades = await this.modalidadesDe(solicitante);
    const filtroMod = modalidades ? { modalidadeId: { in: modalidades } } : {};

    const [fichas, cargas, mods] = await Promise.all([
      this.prisma.treino.findMany({
        where: { ativo: true, concluido: false, ...filtroMod },
        select: { alunoId: true, vencimento: true, updatedAt: true },
      }),
      this.prisma.registroCarga.groupBy({
        by: ['alunoId'],
        where: filtroMod,
        _max: { data: true },
      }),
      this.prisma.modalidade.findMany({ select: { id: true, nome: true } }),
    ]);

    const ehFuncional = (nome: string) =>
      nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('funcional');
    const comFicha = mods
      .filter((m) => !ehFuncional(m.nome) && (!modalidades || modalidades.includes(m.id)))
      .map((m) => m.id);

    const hoje = dayjs().startOf('day');
    const aulas = await this.prisma.agendamento.findMany({
      where: {
        status: 'CONFIRMADO',
        dataAula: { gte: hoje.toDate(), lt: hoje.add(7, 'day').toDate() },
        horario: { modalidadeId: { in: comFicha } },
        usuario: { tipoUsuario: 'ALUNO', ativo: true },
      },
      select: { usuarioId: true, dataAula: true, horario: { select: { horaInicio: true, modalidade: { select: { nome: true } } } } },
      orderBy: [{ dataAula: 'asc' }],
    });

    type Linha = {
      alunoId: string;
      fichas: number;
      vencimento: Date | null;
      atualizadaEm: Date | null;
      ultimaCarga: Date | null;
      proximaAula: { data: string; hora: string; modalidade: string } | null;
    };
    const porAluno = new Map<string, Linha>();
    const linha = (alunoId: string) => {
      let l = porAluno.get(alunoId);
      if (!l) {
        l = { alunoId, fichas: 0, vencimento: null, atualizadaEm: null, ultimaCarga: null, proximaAula: null };
        porAluno.set(alunoId, l);
      }
      return l;
    };

    for (const f of fichas) {
      const l = linha(f.alunoId);
      l.fichas++;
      if (f.vencimento && (!l.vencimento || f.vencimento < l.vencimento)) l.vencimento = f.vencimento;
      if (!l.atualizadaEm || f.updatedAt > l.atualizadaEm) l.atualizadaEm = f.updatedAt;
    }
    for (const c of cargas) linha(c.alunoId).ultimaCarga = c._max.data;

    // A primeira aula de cada aluno (a lista já vem em ordem de data; dentro
    // do mesmo dia, fica a mais cedo).
    const agora = dayjs();
    for (const a of aulas) {
      const dia = dayjs(a.dataAula).format('YYYY-MM-DD');
      const hora = a.horario.horaInicio;
      // Aula de hoje que já passou não é "próxima".
      if (dia === hoje.format('YYYY-MM-DD') && dayjs(`${dia}T${hora}`).add(1, 'hour').isBefore(agora)) continue;
      const l = linha(a.usuarioId);
      if (!l.proximaAula || dia < l.proximaAula.data || (dia === l.proximaAula.data && hora < l.proximaAula.hora)) {
        l.proximaAula = { data: dia, hora, modalidade: a.horario.modalidade.nome };
      }
    }

    return [...porAluno.values()];
  }

  /** Metadados opcionais da ficha (vencimento, frequência). */
  private metaDados(dto: SalvarTreinoDto) {
    return {
      vencimento: dto.vencimento ? new Date(dto.vencimento + 'T00:00:00') : null,
      frequencia: dto.frequencia?.trim() || null,
      // pausaSeries/velocidade saíram da ficha: nunca mais são gravados.
      pausaSeries: null,
      velocidade: null,
    };
  }

  /**
   * Quem assina a ficha, e com qual modalidade ela fica carimbada.
   *
   * Sem `professorId` no corpo, é quem está montando — o comportamento de
   * sempre. Com ele, a ficha passa a ser do professor escolhido.
   *
   * A modalidade acompanha o professor escolhido, e isso não é detalhe: ela é
   * o que `buscarComPermissao` usa para decidir quem pode editar. Uma ficha
   * criada pela dona nasce sem modalidade, então nenhum professor conseguia
   * abrir depois — a dona vinculava o professor e ele não podia mexer no
   * próprio treino.
   */
  private async donoDaFicha(
    solicitante: Solicitante,
    dto: SalvarTreinoDto,
    /** Na edição: quem assina hoje. Sem professor no corpo, é quem continua. */
    atual?: { professorId: string; modalidadeId: string | null },
  ) {
    const modalidadesDoSolicitante = await this.modalidadesDe(solicitante);

    /**
     * Editar não troca o dono da ficha por omissão.
     *
     * Sem isto, salvar sem professor no corpo assinava a ficha com quem estava
     * editando. Para o professor dava no mesmo; para a DONA era um roubo: a
     * ficha do Rubens virava "Administrador", perdia a modalidade, e o Rubens
     * deixava de enxergar o treino do próprio aluno. Bastava um toque no nome
     * dele — que já vem marcado na edição — para desmarcar e salvar.
     *
     * Trocar de professor continua possível: é só mandar o novo.
     */
    if (atual && !dto.professorId && (!dto.modalidadeId || dto.modalidadeId === atual.modalidadeId)) {
      return atual;
    }

    /**
     * A dona não assina ficha em nome próprio.
     *
     * Ela não tem modalidade, então a ficha nascia sem carimbo — e o carimbo é
     * o que dá acesso ao professor. O treino aparecia para o aluno e sumia
     * para todos os professores, sem aviso nenhum. Ela precisa dizer de quem
     * é o treino; recusar aqui é mais barato do que descobrir depois.
     */
    if (solicitante.tipo !== 'PROFESSOR' && !dto.professorId) {
      throw new BadRequestException(
        'Escolha o professor responsável pela ficha. Sem isso ela fica sem modalidade ' +
          'e nenhum professor consegue abrir.',
      );
    }

    const professorId = dto.professorId || atual?.professorId || solicitante.id;
    let opcoes: string[];
    if (professorId === solicitante.id && modalidadesDoSolicitante) {
      opcoes = modalidadesDoSolicitante;
    } else {
      const escolhido = await this.prisma.usuario.findUnique({
        where: { id: professorId },
        select: { id: true, tipoUsuario: true, ativo: true },
      });
      if (!escolhido || escolhido.tipoUsuario !== 'PROFESSOR' || !escolhido.ativo) {
        throw new NotFoundException('Professor não encontrado');
      }
      opcoes = await modalidadesDoProfessor(this.prisma, escolhido.id);
      /**
       * Professor não passa ficha para colega de outra modalidade: quem monta
       * um treino de musculação carimba musculação, e o carimbo é o que dá
       * acesso. Com várias modalidades, vale o que os dois têm em comum.
       * Admin não tem essa amarra — é ela quem distribui o trabalho.
       */
      if (modalidadesDoSolicitante) {
        opcoes = opcoes.filter((m) => modalidadesDoSolicitante.includes(m));
        if (opcoes.length === 0) throw new ForbiddenException('Esse professor é de outra modalidade');
      }
    }

    /**
     * Com qual das modalidades do professor a ficha fica carimbada. Na edição,
     * a que ela já tinha continua valendo se o professor ainda for dela —
     * trocar a Gabriele de uma ficha para o Vinicius, os dois de Musculação e
     * Funcional, não pode transformar treino de musculação em funcional.
     */
    const modalidadeId = await escolherModalidade(this.prisma, opcoes, dto.alunoId, [
      dto.modalidadeId,
      atual?.modalidadeId,
    ]);
    if (!modalidadeId) {
      throw new BadRequestException('Esse professor ainda não tem modalidade. Defina na aba Professores.');
    }
    if (dto.modalidadeId && dto.modalidadeId !== modalidadeId) {
      throw new BadRequestException('Esse professor não dá aula nessa modalidade');
    }
    return { professorId, modalidadeId };
  }

  /** Treino de Musculação usa exercicios[]; Funcional/Pilates usa texto livre. */
  private validarFormato(dto: SalvarTreinoDto) {
    const temExercicios = (dto.exercicios?.length ?? 0) > 0;
    const temConteudo = !!dto.conteudo?.trim();
    if (!temExercicios && !temConteudo) {
      throw new BadRequestException('Informe os exercícios ou o texto do treino');
    }
  }

  async criar(solicitante: Solicitante, dto: SalvarTreinoDto) {
    this.validarFormato(dto);
    const { professorId, modalidadeId } = await this.donoDaFicha(solicitante, dto);
    const aluno = await this.prisma.usuario.findUnique({ where: { id: dto.alunoId } });
    if (!aluno || aluno.tipoUsuario !== 'ALUNO') throw new NotFoundException('Aluno não encontrado');
    return this.prisma.treino.create({
      data: {
        alunoId: dto.alunoId,
        professorId,
        modalidadeId,
        titulo: dto.titulo,
        textoAntes: dto.textoAntes?.trim() || null,
        conteudo: dto.conteudo?.trim() || null,
        observacoes: dto.observacoes,
        ...this.metaDados(dto),
        exercicios: {
          create: (dto.exercicios ?? []).map((e, i) => ({
            ordem: i,
            grupo: e.grupo?.trim() || null,
            nome: e.nome,
            series: e.series ?? 3,
            repeticoes: e.repeticoes ?? '12',
            carga: e.carga,
            observacao: e.observacao,
            // O último não tem com quem fazer bi-set.
            conjugado: !!e.conjugado && i < (dto.exercicios ?? []).length - 1,
          })),
        },
      },
      include: this.incluir,
    });
  }

  /** Garante que o professor só mexe em treinos da própria modalidade. */
  private async buscarComPermissao(id: string, solicitante: Solicitante) {
    const treino = await this.prisma.treino.findUnique({ where: { id } });
    if (!treino || !treino.ativo) throw new NotFoundException('Treino não encontrado');
    const modalidades = await this.modalidadesDe(solicitante);
    if (modalidades && !modalidades.includes(treino.modalidadeId ?? '')) {
      throw new ForbiddenException('Este treino é de outra modalidade');
    }
    return treino;
  }

  /** Atualiza título/observações/conteúdo e SUBSTITUI a lista de exercícios. */
  async atualizar(id: string, dto: SalvarTreinoDto, solicitante: Solicitante) {
    this.validarFormato(dto);
    const atual = await this.buscarComPermissao(id, solicitante);
    /**
     * Trocar o professor na edição também vale. Sem isto, corrigir uma ficha
     * que nasceu com o professor errado exigia apagar e remontar exercício por
     * exercício — e o histórico de carga do aluno ia junto.
     */
    const { professorId, modalidadeId } = await this.donoDaFicha(solicitante, dto, {
      professorId: atual.professorId,
      modalidadeId: atual.modalidadeId,
    });
    return this.prisma.treino.update({
      where: { id },
      data: {
        titulo: dto.titulo,
        professorId,
        modalidadeId,
        // Só mexe no texto de antes quando ele vem: o app que ainda não tem o
        // campo não pode apagar o aquecimento que outro professor escreveu.
        textoAntes: dto.textoAntes !== undefined ? dto.textoAntes.trim() || null : undefined,
        conteudo: dto.conteudo?.trim() || null,
        observacoes: dto.observacoes,
        ...this.metaDados(dto),
        exercicios: {
          deleteMany: {},
          create: (dto.exercicios ?? []).map((e, i) => ({
            ordem: i,
            grupo: e.grupo?.trim() || null,
            nome: e.nome,
            series: e.series ?? 3,
            repeticoes: e.repeticoes ?? '12',
            carga: e.carga,
            observacao: e.observacao,
            // O último não tem com quem fazer bi-set.
            conjugado: !!e.conjugado && i < (dto.exercicios ?? []).length - 1,
          })),
        },
      },
      include: this.incluir,
    });
  }

  /** Marca a ficha como concluída (arquivada) ou reativa. */
  async definirStatus(id: string, concluido: boolean, solicitante: Solicitante) {
    await this.buscarComPermissao(id, solicitante);
    return this.prisma.treino.update({ where: { id }, data: { concluido }, include: this.incluir });
  }

  /**
   * A ordem das fichas do aluno, como o professor arrumou (Treino 1 antes do
   * Treino 2). Recebe os ids na ordem nova; cada um passa pela mesma
   * permissão da edição. Ficha de outro aluno é recusada — a ordem é de um
   * aluno só.
   */
  async ordenar(alunoId: string, ids: string[], solicitante: Solicitante) {
    const unicos = [...new Set(ids)];
    for (const id of unicos) {
      const t = await this.buscarComPermissao(id, solicitante);
      if (t.alunoId !== alunoId) throw new BadRequestException('Essa ficha é de outro aluno');
    }
    await this.prisma.$transaction(
      // Sem tocar em updatedAt: reordenar não é editar a ficha.
      unicos.map((id, i) => this.prisma.$executeRaw`UPDATE treinos SET ordem = ${i} WHERE id = ${id}`),
    );
    return { mensagem: 'Ordem salva' };
  }

  async remover(id: string, solicitante: Solicitante) {
    await this.buscarComPermissao(id, solicitante);
    await this.prisma.treino.update({ where: { id }, data: { ativo: false } });
    return { mensagem: 'Treino removido' };
  }

  // ── Treino do DIA (Funcional): um por modalidade+data ──────────────

  private normalizarData(data: string): Date {
    return dayjs(data).startOf('day').toDate();
  }

  /**
   * De qual modalidade é o treino do dia. A dona diz qual; o professor também
   * pode dizer, desde que seja uma das dele — e, se não disser, vale a que é
   * de treino do dia (Funcional), ou a única que ele tem.
   */
  private async modalidadeDoDia(solicitante: Solicitante, pedida?: string): Promise<string> {
    const minhas = await this.modalidadesDe(solicitante);
    if (!minhas) {
      if (!pedida) throw new BadRequestException('Informe a modalidade');
      return pedida;
    }
    if (pedida) {
      if (!minhas.includes(pedida)) throw new ForbiddenException('Esta modalidade não é sua');
      return pedida;
    }
    if (minhas.length === 1) return minhas[0];
    const nomes = await this.prisma.modalidade.findMany({ where: { id: { in: minhas } }, select: { id: true, nome: true } });
    const funcional = nomes.find((m) =>
      m.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('funcional'),
    );
    return funcional?.id ?? minhas[0];
  }

  /** Treino do dia da modalidade (professor usa a sua; admin passa modalidadeId). */
  async diaVer(solicitante: Solicitante, data: string, modalidadeIdParam?: string) {
    const modalidadeId = await this.modalidadeDoDia(solicitante, modalidadeIdParam);
    return this.prisma.treinoDia.findUnique({
      where: { modalidadeId_data: { modalidadeId, data: this.normalizarData(data) } },
      include: { modalidade: { select: { id: true, nome: true } }, professor: { select: { id: true, nome: true } } },
    });
  }

  /** Cria ou substitui o treino do dia (upsert por modalidade+data). */
  async diaSalvar(solicitante: Solicitante, dto: SalvarTreinoDiaDto) {
    const modalidadeId = await this.modalidadeDoDia(solicitante, dto.modalidadeId);
    const data = this.normalizarData(dto.data);
    return this.prisma.treinoDia.upsert({
      where: { modalidadeId_data: { modalidadeId, data } },
      create: { professorId: solicitante.id, modalidadeId, data, conteudo: dto.conteudo.trim() },
      update: { professorId: solicitante.id, conteudo: dto.conteudo.trim() },
      include: { modalidade: { select: { id: true, nome: true } }, professor: { select: { id: true, nome: true } } },
    });
  }

  async diaRemover(id: string, solicitante: Solicitante) {
    const treino = await this.prisma.treinoDia.findUnique({ where: { id } });
    if (!treino) throw new NotFoundException('Treino do dia não encontrado');
    const modalidades = await this.modalidadesDe(solicitante);
    if (modalidades && !modalidades.includes(treino.modalidadeId)) {
      throw new ForbiddenException('Este treino é de outra modalidade');
    }
    await this.prisma.treinoDia.delete({ where: { id } });
    return { mensagem: 'Treino do dia removido' };
  }

  /** Treinos do dia de HOJE das modalidades em que o aluno tem aula hoje. */
  async diaMeu(alunoId: string) {
    const hoje = dayjs().startOf('day').toDate();
    const aulas = await this.prisma.agendamento.findMany({
      where: { usuarioId: alunoId, status: 'CONFIRMADO', dataAula: hoje },
      select: { horario: { select: { modalidadeId: true } } },
    });
    const modalidades = [...new Set(aulas.map((a) => a.horario.modalidadeId))];
    if (modalidades.length === 0) return [];
    return this.prisma.treinoDia.findMany({
      where: { data: hoje, modalidadeId: { in: modalidades } },
      include: { modalidade: { select: { id: true, nome: true } }, professor: { select: { id: true, nome: true } } },
    });
  }
}
