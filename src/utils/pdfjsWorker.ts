/**
 * Configuração única do worker do pdfjs-dist.
 *
 * O worker é copiado de `node_modules/pdfjs-dist/build/pdf.worker.min.mjs`
 * para `public/pdf.worker.min.js` pelo script `copy:pdf-worker` (executado
 * automaticamente nos hooks `predev` e `prebuild` do package.json).
 *
 * Servimos com extensão `.js` porque o nginx da produção não conhece `.mjs`
 * e devolveria `application/octet-stream`, o que faz o navegador rejeitar
 * o módulo por MIME type incorreto.
 */
import * as pdfjsLib from 'pdfjs-dist';

if (!(pdfjsLib.GlobalWorkerOptions as any).workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export { pdfjsLib };
