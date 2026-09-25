/** Data curta pt-BR com fallback "—" (usada nas views do Explorer). */
export const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
