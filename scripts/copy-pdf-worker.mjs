// Copia o worker do pdfjs para public/ com extensão .js (evita MIME .mjs).
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('public', { recursive: true });
copyFileSync(
  'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
  'public/pdf.worker.min.js',
);
console.log('[copy:pdf-worker] public/pdf.worker.min.js atualizado');
