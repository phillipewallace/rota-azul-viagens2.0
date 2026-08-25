// Format date strings safely without UTC timezone shifts.
// Backend returns ISO ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ssZ").
// For pure dates (no time), parse as LOCAL to avoid -1 day shifts in BR timezone.

/**
 * Parse a date-only string ("YYYY-MM-DD") as LOCAL date.
 * For strings with time, defers to `new Date()`. Returns null on invalid.
 */
export function parseLocalDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}
export function formatDateBR(value?: string | Date | null): string {
  if (!value) return '—';
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  const s = String(value);
  // Pure date: YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR');
}

// Formata período do recibo: "DD/MM/YYYY - DD/MM/YYYY" quando informado,
// senão devolve o fallback (ex.: competência mensal "Jan/2026").
export function formatPeriodo(
  inicio?: string | null,
  fim?: string | null,
  fallback = '—',
): string {
  if (!inicio && !fim) return fallback;
  const a = inicio ? formatDateBR(inicio) : '—';
  const b = fim ? formatDateBR(fim) : '—';
  return `${a} - ${b}`;
}

// [dedupe] Último dia do mês da data informada — evita a repetição de
// `new Date(y, m + 1, 0)` espalhada pelo ERP.
export function lastDayOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

// Intervalo YYYY-MM-DD do mês (útil para filtros "from/to").
export function monthRangeISO(d: Date = new Date()): { from: string; to: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const from = `${y}-${pad(m + 1)}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${pad(m + 1)}-${pad(last)}`;
  return { from, to };
}
