import { API_BASE_URL } from '@/services/config';

/** Converte URL relativa (ex: /uploads/x.png) para absoluta usando o host do backend. */
export function toAbsoluteUrl(u?: string | null): string {
  if (!u) return '';
  if (/^(https?:|data:|blob:)/i.test(u)) return u;
  const base = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`;
}

/**
 * Igual a toAbsoluteUrl, mas anexa `?token=<jwt>` para endpoints protegidos que
 * são abertos via <a href> ou window.open (sem possibilidade de setar header).
 * O backend aceita `?token=` como fallback em `/uploads/{invoices,signed,receipts}/`.
 */
export function toAuthedUrl(u?: string | null): string {
  const abs = toAbsoluteUrl(u);
  if (!abs) return '';
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (!token) return abs;
  return abs + (abs.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
}
