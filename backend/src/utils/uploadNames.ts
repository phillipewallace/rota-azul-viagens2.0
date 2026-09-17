/** Corrige nomes UTF-8 interpretados como latin1, preservando Unicode válido. */
export function fixUploadName(name: unknown): string {
  const original = String(name ?? '');
  let current = original;
  // Limita as tentativas para também reparar nomes duplamente codificados.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!/[\u00c2\u00c3\u00e2\u00f0]/.test(current)) break;
    // Buffer.from(..., 'latin1') truncaria caracteres fora desse intervalo.
    if (Array.from(current).some((char) => char.codePointAt(0)! > 255)) break;
    const bytes = Buffer.from(current, 'latin1');
    const fixed = bytes.toString('utf8');
    if (fixed.includes('\uFFFD') || !Buffer.from(fixed, 'utf8').equals(bytes) || fixed === current) break;
    current = fixed;
  }
  return current;
}

