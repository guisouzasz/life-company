import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { conferirHorariosFixos, type ResultadoDaConferencia } from './conferir-horarios-fixos';

/** Hora da conferência, no relógio do estúdio. */
const HORA_DA_CONFERENCIA = 8;
const ENDERECO_DO_PAINEL = 'https://www.academialifecompany.com.br/admin/dashboard';

const meiaNoite = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/**
 * A conferência diária dos horários fixos e o alerta da dona.
 *
 * Às 08:00 o sistema confere os próximos 7 dias (conferir-horarios-fixos.ts)
 * e guarda o resultado do dia. O Início da dona mostra o alerta enquanto houver
 * o que revisar e ela não marcar como revisado; com o e-mail do sistema
 * ligado, ela também recebe a lista por e-mail — só quando há o que revisar,
 * para o e-mail não virar rotina que ninguém abre.
 */
@Injectable()
export class ConferenciaService {
  private readonly log = new Logger('Conferência');

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  /** Todo dia às 08:00, no fuso do estúdio. */
  @Cron(`0 ${HORA_DA_CONFERENCIA} * * *`, { name: 'conferencia-diaria', timeZone: 'America/Sao_Paulo' })
  async rodarAgendada() {
    try {
      const conferencia = await this.rodar();
      this.log.log(`conferência das 08:00: ${conferencia.pendencias} para revisar`);
      if (conferencia.pendencias > 0) {
        await this.avisarPorEmail(conferencia.resultado as unknown as ResultadoDaConferencia);
      }
    } catch (e: any) {
      this.log.error(`a conferência das 08:00 falhou: ${e?.message ?? e}`);
    }
  }

  /**
   * Confere agora e grava como a conferência de hoje (uma por dia; rodar de
   * novo substitui). Um resultado novo precisa ser revisado de novo.
   */
  async rodar() {
    const agora = new Date();
    const resultado = await conferirHorariosFixos(this.prisma, agora);
    const data = meiaNoite(agora);
    const dados = {
      rodadaEm: agora,
      pendencias: resultado.pendencias,
      resultado: resultado as unknown as Prisma.InputJsonValue,
      revisadaEm: null,
      revisadaPor: null,
    };
    try {
      return await this.prisma.conferenciaDiaria.upsert({
        where: { data },
        create: { data, ...dados },
        update: dados,
      });
    } catch (e: any) {
      // A da tela e a das 08:00 no mesmo instante: a segunda grava por cima.
      if (e?.code === 'P2002') return this.prisma.conferenciaDiaria.update({ where: { data }, data: dados });
      throw e;
    }
  }

  /**
   * A conferência de hoje. Depois das 08:00, se não houver (o servidor estava
   * fora do ar na hora, ou acabou de subir uma versão nova), confere na hora:
   * o alerta não pode depender de o servidor estar de pé exatamente às 08:00.
   */
  async hoje() {
    const agora = new Date();
    const existente = await this.prisma.conferenciaDiaria.findUnique({ where: { data: meiaNoite(agora) } });
    if (existente) return existente;
    if (agora.getHours() < HORA_DA_CONFERENCIA) return null;
    return this.rodar();
  }

  async marcarRevisada(id: string, quem: string) {
    const conferencia = await this.prisma.conferenciaDiaria.findUnique({ where: { id } });
    if (!conferencia) throw new NotFoundException('Conferência não encontrada');
    return this.prisma.conferenciaDiaria.update({
      where: { id },
      data: { revisadaEm: new Date(), revisadaPor: quem.slice(0, 120) },
    });
  }

  /**
   * O e-mail das 08:00, para quem administra o estúdio (não para a conta de
   * dono do sistema). Sem SMTP configurado, não faz nada — o alerta continua
   * no Início.
   */
  private async avisarPorEmail(r: ResultadoDaConferencia) {
    if (!this.email.ligado) return;
    const para = await this.prisma.usuario.findMany({
      where: { tipoUsuario: 'ADMIN', ativo: true, dono: false, email: { not: null } },
      select: { email: true },
    });
    if (para.length === 0) return;

    const revisar = r.pontos.filter((p) => p.nivel === 'revisar');
    const assunto =
      r.pendencias === 1
        ? 'Horários fixos: 1 ponto para revisar hoje'
        : `Horários fixos: ${r.pendencias} pontos para revisar hoje`;
    const texto = [
      'Bom dia! A conferência das 08:00 encontrou estes pontos nos horários fixos dos próximos 7 dias:',
      '',
      ...revisar.flatMap((p) => [p.titulo.toUpperCase(), ...p.itens.slice(0, 30).map((i) => `- ${i.texto}`), `O que fazer: ${p.oQueFazer}`, '']),
      `Revise pelo painel: ${ENDERECO_DO_PAINEL}`,
    ].join('\n');
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html =
      `<p>Bom dia! A conferência das 08:00 encontrou estes pontos nos horários fixos dos próximos 7 dias:</p>` +
      revisar
        .map(
          (p) =>
            `<h3 style="margin:16px 0 6px">${esc(p.titulo)}</h3><ul>` +
            p.itens.slice(0, 30).map((i) => `<li>${esc(i.texto)}</li>`).join('') +
            `</ul><p style="color:#555"><b>O que fazer:</b> ${esc(p.oQueFazer)}</p>`,
        )
        .join('') +
      `<p><a href="${ENDERECO_DO_PAINEL}">Abrir o painel</a></p>`;

    for (const { email } of para) {
      if (email) await this.email.enviar(email, assunto, texto, html);
    }
  }
}
