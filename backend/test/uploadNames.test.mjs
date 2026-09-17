/**
 * Testes do utilitário fixUploadName (executar: node --test).
 * Verifica nomes válidos, mojibake simples e duplo, travessão em UTF-8,
 * Unicode fora do latin1 e entradas nulas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixUploadName } from '../src/utils/uploadNames';

test('mantém nomes válidos', () => {
  assert.equal(fixUploadName('LOCAÇÃO.docx'), 'LOCAÇÃO.docx');
  assert.equal(fixUploadName('contrato.pdf'), 'contrato.pdf');
  assert.equal(fixUploadName('Alvará nº 12 – 2026.pdf'), 'Alvará nº 12 – 2026.pdf');
  assert.equal(fixUploadName('ola.png'), 'ola.png');
});

test('corrige mojibake latin1→utf8', () => {
  assert.equal(fixUploadName('LOCAÃ‡ÃƒO.docx'), 'LOCAÇÃO.docx');
  assert.equal(fixUploadName('Ãrea tÃ©cnica.pdf'), 'Área técnica.pdf');
  assert.equal(fixUploadName('Boleto â€\" v2.pdf'), 'Boleto – v2.pdf');
});

test('corrige mojibake duplo', () => {
  assert.equal(fixUploadName('LOCAÃƒâ€¡ÃƒÆ’O.docx'), 'LOCAÇÃO.docx');
});

test('não altera quando a conversão não é confiável', () => {
  assert.equal(fixUploadName('Ãd'), 'Ãd');
  assert.equal(fixUploadName(''), '');
  assert.equal(fixUploadName(null), 'null');
});
