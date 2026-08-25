/**
 * Renderizador simples de HTML → jsPDF, com suporte a:
 *  - <p>, <h1>, <h2>, <h3>
 *  - <strong>/<b>, <em>/<i>, <u>
 *  - <ul>/<ol> + <li>
 *  - <br>
 *
 * É usado pelo gerador de contratos para imprimir o corpo configurável
 * pelo usuário (editor da página de Configurações).
 */
import type jsPDF from 'jspdf';

export interface HtmlRenderContext {
  doc: jsPDF;
  x: number;          // margem esquerda
  y: number;          // posição vertical atual
  maxW: number;       // largura útil
  baseSize?: number;  // tamanho de fonte do corpo (default 10)
  lineGap?: number;   // espaçamento extra por linha (default 1.6)
  onBeforeWrite?: (needed: number) => number; // retorna novo y (após eventual page break)
  onNewPage?: () => number;                   // chamado quando faz quebra de página, retorna novo y
}

interface Run { text: string; bold: boolean; italic: boolean; underline: boolean; }

const isElement = (n: Node): n is HTMLElement => n.nodeType === 1;
const isText    = (n: Node): n is Text        => n.nodeType === 3;

// Sentinela de quebra de linha explícita (<br>). Não usamos '\n' porque
// quebras de linha presentes no CÓDIGO HTML do template são apenas
// espaços em branco (como no HTML real) e não devem quebrar a linha.
const BR = '\u0001';

function collectRuns(node: Node, parent: { b: boolean; i: boolean; u: boolean }): Run[] {
  const runs: Run[] = [];
  if (isText(node)) {
    // Normaliza qualquer whitespace do código-fonte (\n, \t, \r) para espaço.
    const txt = (node.nodeValue ?? '').replace(/[\r\n\t]+/g, ' ');
    if (txt) runs.push({ text: txt, bold: parent.b, italic: parent.i, underline: parent.u });
    return runs;
  }
  if (!isElement(node)) return runs;
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') { runs.push({ text: BR, bold: parent.b, italic: parent.i, underline: parent.u }); return runs; }
  const state = {
    b: parent.b || tag === 'strong' || tag === 'b',
    i: parent.i || tag === 'em'     || tag === 'i',
    u: parent.u || tag === 'u',
  };
  node.childNodes.forEach(child => { runs.push(...collectRuns(child, state)); });
  return runs;
}

function normalizeWhitespace(runs: Run[]): Run[] {
  // Colapsa espaços em runs adjacentes, mas mantém quebra de linha explícita (<br>).
  const out: Run[] = [];
  let pendingSpace = false;
  for (const r of runs) {
    const parts = r.text.split(new RegExp(`(${BR})`));
    for (const p of parts) {
      if (p === BR) {
        out.push({ ...r, text: BR });
        pendingSpace = false;
        continue;
      }
      let t = p.replace(/\s+/g, ' ');
      if (pendingSpace && t.startsWith(' ')) t = t.replace(/^ +/, '');
      if (!t) continue;
      out.push({ ...r, text: t });
      pendingSpace = t.endsWith(' ');
    }
  }
  return out;
}


function setFontFor(doc: jsPDF, run: Run, size: number) {
  const style = run.bold && run.italic ? 'bolditalic' : run.bold ? 'bold' : run.italic ? 'italic' : 'normal';
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
}

function renderInline(
  ctx: HtmlRenderContext,
  runs: Run[],
  size: number,
  opts?: { firstLineIndent?: number },
): void {
  const { doc, x, maxW } = ctx;
  const lineH = size * 0.45 + (ctx.lineGap ?? 1.6);
  let cursorX = x + (opts?.firstLineIndent ?? 0);
  let lineMaxRight = x + maxW;
  let y = ctx.y;
  const ensureLine = () => {
    const needed = lineH + 2;
    if (ctx.onBeforeWrite) {
      // Sincroniza ctx.y com o y local para que o callback decida com base
      // na posição REAL atual (e não na posição inicial do parágrafo).
      const before = y;
      ctx.y = y;
      const newY = ctx.onBeforeWrite(needed);
      // Só considera "page break" se o callback realmente mudou a posição.
      if (newY !== before) {
        y = newY;
        cursorX = x;
      }
    }
  };
  ensureLine();

  type Token = { text: string; run: Run; space: boolean };
  const tokens: Token[] = [];
  for (const r of runs) {
    if (r.text === BR) { tokens.push({ text: BR, run: r, space: false }); continue; }
    const parts = r.text.split(/(\s+)/);
    for (const p of parts) {
      if (!p) continue;
      tokens.push({ text: p, run: r, space: /^\s+$/.test(p) });
    }
  }

  const wordWidth = (txt: string, run: Run) => {
    setFontFor(doc, run, size);
    return doc.getTextWidth(txt);
  };

  let lineStart = true;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.text === BR) {
      y += lineH;
      cursorX = x;
      lineStart = true;
      ensureLine();
      continue;
    }
    if (tok.space) {
      if (lineStart) continue; // sem espaço no início de linha
      const w = wordWidth(tok.text, tok.run);
      cursorX += w;
      continue;
    }
    const w = wordWidth(tok.text, tok.run);
    if (!lineStart && cursorX + w > lineMaxRight) {
      // quebra
      y += lineH;
      cursorX = x;
      lineStart = true;
      ensureLine();
      // remove espaço pendente antes da palavra
    }
    setFontFor(doc, tok.run, size);
    doc.text(tok.text, cursorX, y);
    if (tok.run.underline) {
      const yy = y + 0.6;
      doc.setDrawColor(0);
      doc.line(cursorX, yy, cursorX + w, yy);
    }
    cursorX += w;
    lineStart = false;
  }
  // Fecha a linha atual
  y += lineH;
  ctx.y = y;
}

/**
 * Renderiza o HTML fornecido a partir da posição atual do contexto.
 * Atualiza `ctx.y` ao final. Chama `onBeforeWrite` antes de cada linha
 * para permitir quebras de página.
 */
export function renderHtmlToPdf(ctx: HtmlRenderContext, html: string): void {
  const baseSize = ctx.baseSize ?? 10;
  const parser = new DOMParser();
  // Envolve em div para garantir um root
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild as HTMLElement | null;
  if (!root) return;

  const blockSpacingAfter = (tag: string) => {
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') return 1.2;
    if (tag === 'ul' || tag === 'ol') return 1.5;
    return 1.5;
  };

  const renderBlock = (el: HTMLElement) => {
    const tag = el.tagName.toLowerCase();

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      // Pequeno espaçamento antes do título
      ctx.y += 2;
      const size = tag === 'h1' ? 13 : tag === 'h2' ? 11.5 : 10.5;
      const runs = normalizeWhitespace(collectRuns(el, { b: true, i: false, u: false }));
      renderInline(ctx, runs, size);
      ctx.y += blockSpacingAfter(tag);
      return;
    }

    if (tag === 'p' || tag === 'div') {
      const runs = normalizeWhitespace(collectRuns(el, { b: false, i: false, u: false }));
      if (runs.length === 0) { ctx.y += baseSize * 0.45; return; }
      renderInline(ctx, runs, baseSize);
      ctx.y += blockSpacingAfter(tag);
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.children).filter(c => c.tagName.toLowerCase() === 'li') as HTMLElement[];
      const isOrdered = tag === 'ol';
      const bulletIndent = 4;       // mm
      const textIndent   = 6;       // mm — onde começa o texto
      items.forEach((li, idx) => {
        const marker = isOrdered ? `${idx + 1}.` : '•';
        // Desenha o marcador
        const needed = baseSize * 0.45 + (ctx.lineGap ?? 1.6) + 2;
        if (ctx.onBeforeWrite) ctx.y = ctx.onBeforeWrite(needed);
        ctx.doc.setFont('helvetica', 'normal');
        ctx.doc.setFontSize(baseSize);
        ctx.doc.text(marker, ctx.x + bulletIndent, ctx.y);
        // Renderiza o texto da <li> com recuo
        const subCtx: HtmlRenderContext = {
          ...ctx,
          x: ctx.x + textIndent,
          maxW: ctx.maxW - textIndent,
        };
        subCtx.y = ctx.y;
        const runs = normalizeWhitespace(collectRuns(li, { b: false, i: false, u: false }));
        renderInline(subCtx, runs, baseSize);
        ctx.y = subCtx.y;
      });
      ctx.y += blockSpacingAfter(tag);
      return;
    }

    // Fallback: trata como parágrafo
    const runs = normalizeWhitespace(collectRuns(el, { b: false, i: false, u: false }));
    if (runs.length > 0) {
      renderInline(ctx, runs, baseSize);
      ctx.y += 1.5;
    }
  };

  Array.from(root.children).forEach(child => {
    if (isElement(child)) renderBlock(child);
  });
}
