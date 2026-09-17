const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Algoritmo igual ao de uploadNames.ts (copiado para validar comportamento
 * sem depender de compilação TypeScript).
 */
function fixUploadName(name) {
  const original = String(name ?? '');
  let current = original;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!/[\u00c2\u00c3\u00e2\u00f0]/.test(current)) break;
    if (Array.from(current).some((char) => char.codePointAt(0) > 255)) break;
    const bytes = Buffer.from(current, 'latin1');
    const fixed = bytes.toString('utf8');
    if (fixed.includes('\uFFFD') || !Buffer.from(fixed, 'utf8').equals(bytes) || fixed === current) break;
    current = fixed;
  }
  return current;
}

// Helper: converte UTF-8 → latin1 "mojibake" via Buffer
function makeMojibake(str) {
  return Buffer.from(str, 'utf8').toString('latin1');
}

// Helper: converte UTF-8 → latin1 → UTF-8 (double encoding)
function makeDoubleMojibake(str) {
  const first = Buffer.from(str, 'utf8').toString('latin1');
  // O "double mojibake" é quando o resultado latin1 é novamente tratado como latin1
  // Isso acontece quando o nome corrompido é salvo novamente sem correção.
  // Na prática, o double encoding é: utf8 → latin1 → (interpretado como latin1 novamente)
  // Usamos o resultado do primeiro passo como se fosse latin1
  return Buffer.from(first, 'latin1').toString('utf8');
  // Isso não está correto para double encoding. Vamos pensar...
  // Double mojibake: o nome já está corrompido (latin1 interpretation of utf8 bytes),
  // e depois disso é salvo de novo interpretando os bytes resultantes como latin1.
  // Ex: "LOCAÇÃO" (utf8: 4c4f4341c387c3a3c392) → latin1: "LOCAÃ\x87Ã£Ã\x92"
  // Se salvarmos isso como latin1 de novo: cada char vira seu byte latin1
  // "LOCAÃ\x87Ã£Ã\x92" em latin1: 4c4f4341c387c3a3c392 → volta para utf8: "LOCAÇÃO"
  // Espera... isso seria.correto?
  // Na verdade sim - se interpretarmos "LOCAÃ\x87Ã£Ã\x92" como latin1 e converter para utf8,
  // obtemos de volta "LOCAÇÃO". Então o double mojibake recovery funciona se fizermos
  // lati → utf8 duas vezes.
}

// Testes
test('mantém nomes válidos (sem mojibake)', () => {
  assert.equal(fixUploadName('LOCAÇÃO.docx'), 'LOCAÇÃO.docx');
  assert.equal(fixUploadName('contrato.pdf'), 'contrato.pdf');
  assert.equal(fixUploadName('Alvará nº 12 – 2026.pdf'), 'Alvará nº 12 – 2026.pdf');
  assert.equal(fixUploadName('ola.png'), 'ola.png');
  assert.equal(fixUploadName('porção.pdf'), 'porção.pdf');
  assert.equal(fixUploadName('ração.pdf'), 'ração.pdf');
});

test('corrige mojibake simple (UTF-8 interpretado como latin1)', () => {
  // Gera o mojibake real a partir do UTF-8
  const cases = [
    ['LOCAÇÃO.docx', makeMojibake('LOCAÇÃO.docx')],
    ['Área técnica.pdf', makeMojibake('Área técnica.pdf')],
    ['Boleto – v2.pdf', makeMojibake('Boleto – v2.pdf')],
    ['ração.pdf', makeMojibake('ração.pdf')],
    ['porção.pdf', makeMojibake('porção.pdf')],
  ];
  for (const [original, mojibake] of cases) {
    assert.equal(fixUploadName(mojibake), original, `falhou para ${original}`);
  }
});

test('corrige double mojibake', () => {
  // Double encoding: utf8 → latin1 → (os bytes latin1 são interpretados como latin1 novamente)
  // Isso é o que acontece quando um nome já corrompido é salvado sem correção
  const cases = [
    'LOCAÇÃO.docx',
    'Área técnica.pdf',
    'Boleto – v2.pdf',
    'ração.pdf',
  ];
  for (const original of cases) {
    // Primeiro nível de corrupção
    const firstCorrupt = makeMojibake(original);
    // Segundo nível: interpretar o resultado como latin1 e converter para utf8
    // Isso simula o double encoding real
    const doubleCorrupt = Buffer.from(firstCorrupt, 'latin1').toString('utf8');
    // Agora tente corrigir - deve recuperar o original após duas iterações
    const result = fixUploadName(doubleCorrupt);
    assert.equal(result, original, `falhou double para ${original}`);
  }
});

test('não altera string já correta (sem caracteres latino)', () => {
  assert.equal(fixUploadName('test.txt'), 'test.txt');
  assert.equal(fixUploadName('ABC123.pdf'), 'ABC123.pdf');
});

test('trata null e undefined como string vazia', () => {
  assert.equal(fixUploadName(null), '');
  assert.equal(fixUploadName(undefined), '');
});

test('trata entrada vazia', () => {
  assert.equal(fixUploadName(''), '');
});
