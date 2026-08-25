/**
 * Helpers de imagem para PDFs (jsPDF):
 * - Carrega URL/dataURL preservando dimensões naturais
 * - Calcula encaixe "contain" dentro de uma caixa, mantendo proporção
 */
import { toAbsoluteUrl } from '@/utils/absoluteUrl';

export type PdfImage = {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  naturalWidth: number;
  naturalHeight: number;
};

async function fetchDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  const url = toAbsoluteUrl(src);
  const r = await fetch(url, { credentials: 'omit', mode: 'cors' });
  if (!r.ok) throw new Error('image fetch failed');
  const blob = await r.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function detectFormat(dataUrl: string): 'PNG' | 'JPEG' {
  if (/^data:image\/png/i.test(dataUrl)) return 'PNG';
  return 'JPEG';
}

/** Carrega imagem e devolve dataURL + dimensões naturais. */
export async function loadPdfImage(src: string): Promise<PdfImage> {
  const dataUrl = await fetchDataUrl(src);
  const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = reject;
    img.src = dataUrl;
  });
  return {
    dataUrl,
    format: detectFormat(dataUrl),
    naturalWidth: dims.w,
    naturalHeight: dims.h,
  };
}

/**
 * Encaixa proporcionalmente a imagem dentro de uma caixa (boxW × boxH)
 * em mm, centralizando. Retorna posição final (x,y) e tamanho (w,h).
 */
export function fitContain(
  img: PdfImage,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  padding = 0
): { x: number; y: number; w: number; h: number } {
  const availW = Math.max(0.1, boxW - padding * 2);
  const availH = Math.max(0.1, boxH - padding * 2);
  const ratio = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
  const w = img.naturalWidth * ratio;
  const h = img.naturalHeight * ratio;
  return {
    x: boxX + (boxW - w) / 2,
    y: boxY + (boxH - h) / 2,
    w,
    h,
  };
}
