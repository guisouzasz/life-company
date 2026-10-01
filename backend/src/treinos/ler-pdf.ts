import { BadRequestException } from '@nestjs/common';

/**
 * Tira o TEXTO de uma ficha de treino em PDF, linha por linha, com a posição
 * de cada pedaço.
 *
 * Só isso — quem entende o que é exercício, série e carga é o app, que tem o
 * catálogo de exercícios e mostra o resultado para o professor conferir antes
 * de salvar. Aqui fica a parte que precisa de servidor: abrir o PDF.
 *
 * A posição (x) de cada pedaço vai junto porque ficha feita no Excel é uma
 * tabela: "Supino reto | 4 | 12 | 20" só vira exercício, série, repetição e
 * carga sabendo debaixo de qual cabeçalho cada número está. Célula vazia não
 * gera texto nenhum no PDF, então contar colunas não funciona — a posição sim.
 */

/** Um pedaço de texto da linha. `x` vai de 0 (margem esquerda) a 1. */
export interface CelulaPdf {
  x: number;
  texto: string;
}

export interface LinhaPdf {
  pagina: number;
  celulas: CelulaPdf[];
}

/** Limites contra arquivo errado ou malicioso: ficha de treino é pequena. */
export const LIMITE_PDF_BYTES = 5 * 1024 * 1024;
const LIMITE_PAGINAS = 20;
const LIMITE_LINHAS = 2000;

interface ItemTexto {
  texto: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * O pdf.js só existe como módulo ES, e este projeto compila para CommonJS —
 * o `import()` escrito direto viraria `require()` e quebraria. Assim o Node
 * faz o import de verdade.
 */
const importarModulo = new Function('m', 'return import(m)') as (m: string) => Promise<any>;

/**
 * Junta os pedaços de texto que estão na mesma altura em uma linha, e na
 * linha junta em uma célula os que estão colados (o Word quebra uma frase em
 * vários pedaços; um espaço grande entre eles é troca de coluna).
 */
function montarLinhas(itens: ItemTexto[], larguraPagina: number, pagina: number): LinhaPdf[] {
  const ordenados = [...itens].sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos: ItemTexto[][] = [];
  for (const item of ordenados) {
    const ultimo = grupos[grupos.length - 1];
    const tolerancia = Math.max(2, item.altura * 0.45);
    if (ultimo && Math.abs(ultimo[0].y - item.y) <= tolerancia) ultimo.push(item);
    else grupos.push([item]);
  }

  return grupos.map((grupo) => {
    grupo.sort((a, b) => a.x - b.x);
    const celulas: { x: number; fim: number; texto: string; altura: number }[] = [];
    for (const item of grupo) {
      const atual = celulas[celulas.length - 1];
      const vao = atual ? item.x - atual.fim : Infinity;
      /*
        Um espaço entre palavras mede ~0,28 da altura da letra. Bem mais que
        isso é a folga entre duas células — no Excel, coluna estreita deixa
        só uns 4 pontos entre o "Séries" e o "Reps", e eles não podem virar
        uma célula só.
      */
      if (atual && vao < Math.max(item.altura, atual.altura) * 0.4) {
        const precisaEspaco = vao > Math.max(item.altura, atual.altura) * 0.12 && !/\s$/.test(atual.texto);
        atual.texto += (precisaEspaco ? ' ' : '') + item.texto;
        atual.fim = Math.max(atual.fim, item.x + item.largura);
      } else {
        celulas.push({ x: item.x, fim: item.x + item.largura, texto: item.texto, altura: item.altura });
      }
    }
    return {
      pagina,
      celulas: celulas
        .map((c) => ({
          x: Math.round((c.x / larguraPagina) * 1000) / 1000,
          texto: c.texto.replace(/\s+/g, ' ').trim().slice(0, 300),
        }))
        .filter((c) => c.texto.length > 0),
    };
  }).filter((l) => l.celulas.length > 0);
}

export async function lerLinhasDoPdf(conteudo: Buffer): Promise<{ paginas: number; linhas: LinhaPdf[] }> {
  if (!conteudo?.length || conteudo.subarray(0, 1024).indexOf('%PDF-') === -1) {
    throw new BadRequestException('Esse arquivo não é um PDF.');
  }

  const pdfjs = await importarModulo('pdfjs-dist/legacy/build/pdf.mjs');
  let documento: any;
  try {
    documento = await pdfjs.getDocument({
      data: new Uint8Array(conteudo),
      // Nada de executar código vindo do arquivo (CVE-2024-4367) nem de
      // buscar fonte ou recurso fora dele: só ler o texto.
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      disableAutoFetch: true,
      verbosity: 0,
    }).promise;
  } catch (erro: any) {
    if (erro?.name === 'PasswordException') {
      throw new BadRequestException('Esse PDF tem senha. Salve uma cópia sem senha e tente de novo.');
    }
    throw new BadRequestException('Não consegui abrir esse PDF. Tente exportar de novo pelo Word ou Excel.');
  }

  try {
    const paginas = Math.min(documento.numPages, LIMITE_PAGINAS);
    const linhas: LinhaPdf[] = [];
    for (let n = 1; n <= paginas && linhas.length < LIMITE_LINHAS; n++) {
      const pagina = await documento.getPage(n);
      const largura = pagina.getViewport({ scale: 1 }).width || 1;
      const texto = await pagina.getTextContent();
      const itens: ItemTexto[] = texto.items
        .filter((i: any) => typeof i.str === 'string' && i.str.trim().length > 0)
        .map((i: any) => ({
          texto: i.str,
          x: i.transform[4],
          y: i.transform[5],
          largura: i.width ?? 0,
          altura: Math.abs(i.height || i.transform[3] || 10),
        }));
      linhas.push(...montarLinhas(itens, largura, n));
      pagina.cleanup();
    }

    if (linhas.length === 0) {
      throw new BadRequestException(
        'Esse PDF não tem texto para ler — parece uma foto ou um papel escaneado. ' +
          'Use o PDF salvo direto do Word ou do Excel.',
      );
    }
    return { paginas, linhas: linhas.slice(0, LIMITE_LINHAS) };
  } finally {
    await documento.destroy();
  }
}
