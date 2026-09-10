#!/usr/bin/env node
// Gera os PNGs do app funcionários a partir de public/func-icon.svg
// Uso: node scripts/generate-favicons.mjs   (requer sharp — devDependency)
//
// - 192: ícone "any" com cantos arredondados transparentes (browser/manifest)
// - 512: full-bleed com fundo sólido (Android maskable recorta em círculo)
// - 180: apple-touch-icon full-bleed (iOS não suporta transparência — ficaria preto)
// - 32:  favicon do browser

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'func-icon.svg');
const THEME = '#2563eb';

if (!fs.existsSync(svgPath)) {
  console.error(`✗ SVG não encontrado: ${svgPath}`);
  process.exit(1);
}

const svg = fs.readFileSync(svgPath);

// [arquivo, tamanho, fundoSólido]
const targets = [
  ['func-icon-192.png', 192, false],
  ['func-icon-512.png', 512, true],
  ['func-icon-180.png', 180, true],
  ['func-favicon-32.png', 32, false],
];

// density alta garante rasterização nítida mesmo no 512 (o viewBox é 192)
for (const [name, size, solid] of targets) {
  let img = sharp(svg, { density: 288 }).resize(size, size, { fit: 'contain' });
  if (solid) img = img.flatten({ background: THEME });
  await img.png().toFile(path.join(publicDir, name));
  console.log(`✓ ${name} (${size}x${size}${solid ? ', fundo sólido' : ''})`);
}

console.log('✓ Favicons do app funcionários gerados em public/');

