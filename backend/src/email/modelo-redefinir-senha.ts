import { STUDIO_NOME } from '../comum/estudio';

/**
 * O e-mail de redefinir senha.
 *
 * Texto curto e um botão. Quem abre isto está travado fora do app e com
 * pressa; parágrafo de boas-vindas atrapalha.
 *
 * Vai em texto puro TAMBÉM, não só em HTML: cliente de e-mail antigo e alguns
 * filtros mostram só o texto, e um e-mail que chega em branco é pior do que
 * não ter chegado.
 */
export function modeloRedefinirSenha(nome: string, link: string, horas: number) {
  const assunto = `Redefinir sua senha — ${STUDIO_NOME}`;

  const texto =
    `Oi, ${nome}!\n\n` +
    `Você pediu para trocar a senha do app do ${STUDIO_NOME}. ` +
    `Abra o endereço abaixo para criar uma senha nova:\n\n` +
    `${link}\n\n` +
    `O link vale por ${horas} horas e só pode ser usado uma vez.\n\n` +
    `Se não foi você que pediu, ignore este e-mail — sua senha continua a mesma.`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
  <p style="font-size:16px;margin:0 0 16px">Oi, ${escapar(nome)}!</p>
  <p style="font-size:15px;line-height:1.5;margin:0 0 24px">
    Você pediu para trocar a senha do app do ${escapar(STUDIO_NOME)}.
    Toque no botão para criar uma senha nova.
  </p>
  <p style="margin:0 0 24px">
    <a href="${link}" style="display:inline-block;background:#0E9488;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px">
      Criar senha nova
    </a>
  </p>
  <p style="font-size:13px;color:#666;line-height:1.5;margin:0 0 8px">
    O link vale por ${horas} horas e só pode ser usado uma vez.
  </p>
  <p style="font-size:13px;color:#666;line-height:1.5;margin:0 0 24px">
    Se não foi você que pediu, ignore este e-mail — sua senha continua a mesma.
  </p>
  <p style="font-size:12px;color:#999;word-break:break-all;margin:0">
    Se o botão não abrir, copie este endereço:<br>${link}
  </p>
</div>`.trim();

  return { assunto, texto, html };
}

/** O nome vem do cadastro e entra no HTML — nunca confie nele cru. */
function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
