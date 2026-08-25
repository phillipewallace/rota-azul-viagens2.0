// Helper de formatação BRL centralizado.
// [dedupe] Substitui múltiplas cópias locais de `const BRL = ...`.
export const BRL = (n: number): string =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Variante compacta (K/M) — útil em KPIs de dashboards.
export const BRLc = (n: number): string => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 10_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return BRL(v);
};
