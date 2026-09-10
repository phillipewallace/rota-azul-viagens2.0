#!/usr/bin/env node
/**
 * Copia o worker do pdfjs para o diretório de publicação do frontend.
 *
 * Uso:
 *   node scripts/copy-pdf-worker.mjs                    # → public/ (build principal)
 *   node scripts/copy-pdf-worker.mjs --target dist-func # → dist-func/ (app funcionários standalone)
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { argv } from 'node:process';

const SRC = 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
const TARGET_FLAG = argv.includes('--target');
const target = TARGET_FLAG
  ? argv[argv.indexOf('--target') + 1] ?? 'dist-func'
  : 'public';

mkdirSync(target, { recursive: true });
const dest = target === 'public'
  ? `${target}/pdf.worker.min.js`
  : `${target}/pdf.worker.min.js`;

copyFileSync(SRC, dest);
console.log(`[copy:pdf-worker] ${dest} atualizado (target=${target})`);
