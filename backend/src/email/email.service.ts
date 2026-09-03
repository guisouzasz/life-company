import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Envio de e-mail do estúdio.
 *
 * Só existe para uma coisa hoje: o link de redefinir senha. O estúdio fala
 * com o aluno por WhatsApp, e continuar assim é de propósito — aviso de aula e
 * de mensalidade não viram e-mail. O que o WhatsApp não resolve é justamente
 * este caso: o link de senha precisa chegar num canal que só o dono da conta
 * abre, e o WhatsApp da dona não prova quem está do outro lado.
 *
 * Configuração por variáveis de ambiente:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   SMTP_FROM   (opcional — sem ela, usa o SMTP_USER)
 *
 * SEM essas variáveis o serviço não quebra o boot nem some em silêncio: ele
 * fica desligado e diz isso a quem chamar, para a tela poder oferecer o
 * caminho antigo (pedir o link à dona) em vez de fingir que mandou.
 */
@Injectable()
export class EmailService {
  private readonly log = new Logger('Email');
  private transporte: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      this.log.warn(
        'SMTP não configurado — o "esqueci minha senha" vai pedir o link ao estúdio. ' +
          'Para ligar, defina SMTP_HOST, SMTP_USER e SMTP_PASS.',
      );
      return;
    }
    const port = Number(process.env.SMTP_PORT) || 587;
    this.transporte = nodemailer.createTransport({
      host,
      port,
      // 465 é o SMTP sobre TLS direto; 587 começa em claro e sobe para TLS.
      secure: port === 465,
      auth: { user, pass },
    });
    this.log.log(`SMTP pronto (${host}:${port})`);
  }

  get ligado(): boolean {
    return this.transporte !== null;
  }

  private get remetente(): string {
    return process.env.SMTP_FROM || process.env.SMTP_USER || 'nao-responda@localhost';
  }

  /**
   * Manda o e-mail. Devolve `false` quando não deu — nunca lança.
   *
   * Falha de SMTP não pode derrubar o pedido de quem está tentando recuperar
   * a senha: a resposta ao aluno é a mesma dos outros casos, e o motivo real
   * fica no log do servidor, onde ele serve para consertar.
   */
  async enviar(para: string, assunto: string, texto: string, html: string): Promise<boolean> {
    if (!this.transporte) return false;
    try {
      await this.transporte.sendMail({ from: this.remetente, to: para, subject: assunto, text: texto, html });
      return true;
    } catch (e: any) {
      this.log.error(`falha ao enviar para ${para}: ${e?.message}`);
      return false;
    }
  }
}
