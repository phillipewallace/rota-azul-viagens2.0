/**
 * Carimba uma imagem de assinatura em posições especificadas de um PDF.
 * Coordenadas de entrada em percentuais (0–1) relativos ao tamanho da página
 * (origem no canto superior esquerdo, mais intuitivo pra UI).
 * Convertidas internamente para o sistema bottom-up do pdf-lib.
 */
import { PDFDocument } from 'pdf-lib';

export interface SignaturePlacement {
  pageIndex: number; // 0-based
  xPct: number;      // 0..1 (left edge)
  yPct: number;      // 0..1 (top edge, y crescendo pra baixo)
  wPct: number;      // 0..1 (largura relativa à página)
  hPct: number;      // 0..1 (altura relativa à página)
}

async function fetchAsBytes(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao baixar assinatura (${r.status})`);
  const blob = await r.blob();
  const buf = await blob.arrayBuffer();
  return { bytes: new Uint8Array(buf), mime: blob.type || '' };
}

/** Detecta o formato real da imagem pelos magic bytes (não confia no mime). */
function sniffImageFormat(bytes: Uint8Array): 'png' | 'jpeg' | 'unknown' {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  return 'unknown';
}

/** Converte qualquer imagem suportada pelo navegador (WebP, GIF, BMP, etc.) para PNG. */
async function convertToPng(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const blob = new Blob([ab as ArrayBuffer], { type: mime || 'image/*' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Não foi possível decodificar a imagem da assinatura.'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível.');
    ctx.drawImage(img, 0, 0);
    const pngBlob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao converter para PNG.')), 'image/png')
    );
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function stampSignatureOnPdf(
  pdfBytes: ArrayBuffer | Uint8Array,
  signatureUrl: string,
  placements: SignaturePlacement[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const { bytes: sigBytes, mime } = await fetchAsBytes(signatureUrl);
  const format = sniffImageFormat(sigBytes);
  let img;
  if (format === 'jpeg') {
    img = await pdf.embedJpg(sigBytes);
  } else if (format === 'png') {
    img = await pdf.embedPng(sigBytes);
  } else {
    // Formato não suportado nativamente pelo pdf-lib (WebP, GIF, BMP, etc.): converte para PNG.
    const pngBytes = await convertToPng(sigBytes, mime);
    img = await pdf.embedPng(pngBytes);
  }

  const imgW = img.width;
  const imgH = img.height;
  const imgRatio = imgW / imgH;

  const pages = pdf.getPages();
  for (const p of placements) {
    const page = pages[p.pageIndex];
    if (!page) continue;
    const { width, height } = page.getSize();
    const boxW = p.wPct * width;
    const boxH = p.hPct * height;
    const boxX = p.xPct * width;
    const boxYTop = p.yPct * height; // origem topo (UI)

    // Fit "contain" preservando proporção original da assinatura.
    let drawW = boxW;
    let drawH = boxW / imgRatio;
    if (drawH > boxH) {
      drawH = boxH;
      drawW = boxH * imgRatio;
    }
    // Centraliza dentro da caixa.
    const x = boxX + (boxW - drawW) / 2;
    const yTop = boxYTop + (boxH - drawH) / 2;
    // pdf-lib usa origem inferior-esquerda.
    const y = height - yTop - drawH;
    page.drawImage(img, { x, y, width: drawW, height: drawH });
  }


  return pdf.save();
}
