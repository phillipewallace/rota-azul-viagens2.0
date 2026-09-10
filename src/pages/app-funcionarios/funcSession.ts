/**
 * API base do App Funcionários — configurável por domínio.
 *
 * - No sistema principal: usa o mesmo comportamento de sempre
 *   (produção → https://alchemyrotas.com/api; dev → localhost).
 * - No domínio próprio (csll.cloud): define VITE_FUNC_API_URL no build
 *   (ex.: https://alchemyrotas.com/api). Sem a env, cai no padrão seguro.
 */
const FUNC_API = (import.meta as any)?.env?.VITE_FUNC_API_URL as string | undefined;

export const FUNC_API_BASE_URL =
  (typeof FUNC_API === 'string' && FUNC_API.trim()) ||
  (import.meta.env.MODE === 'production'
    ? 'https://alchemyrotas.com/api'
    : 'http://localhost:3002/api');

/** Chave isolada de sessão do app (não conflita com o sistema principal). */
export const FUNC_SESSION_KEY = 'csll_func_user';

/** Lê a sessão salva (ou null). Remove lixo corrompido automaticamente. */
export function readFuncSession<T = any>(): T | null {
  try {
    const raw = localStorage.getItem(FUNC_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    try { localStorage.removeItem(FUNC_SESSION_KEY); } catch { /* noop */ }
    return null;
  }
}

/** Persiste a sessão do funcionário. */
export function writeFuncSession(data: unknown) {
  try { localStorage.setItem(FUNC_SESSION_KEY, JSON.stringify(data)); } catch { /* noop */ }
}

/** Encerra a sessão do app (sem tocar na sessão do sistema principal). */
export function clearFuncSession() {
  try { localStorage.removeItem(FUNC_SESSION_KEY); } catch { /* noop */ }
}

/** CPF: só dígitos, máx 11. */
export function onlyCpfDigits(v: string): string {
  return String(v || '').replace(/\D/g, '').slice(0, 11);
}

/** 12345678901 → 123.456.789-01 (formata enquanto digita). */
export function maskCpfInput(v: string): string {
  const d = onlyCpfDigits(v);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  let out = p1;
  if (p2) out += '.' + p2;
  if (p3) out += '.' + p3;
  if (p4) out += '-' + p4;
  return out;
}

/** Mensagem amigável para falhas de login (sem vazar detalhe interno). */
export async function funcLoginErrorMessage(res: Response): Promise<string> {
  const status = res.status;
  let serverMsg = '';
  try {
    const data = await res.clone().json();
    serverMsg = String((data as any)?.error || '').trim();
  } catch {
    try { serverMsg = (await res.clone().text()).trim().slice(0, 120); } catch { /* noop */ }
  }
  if (status === 400) return serverMsg || 'Verifique o CPF e a senha e tente de novo.';
  if (status === 401) return 'CPF ou senha incorretos. Confira e tente de novo.';
  if (status === 403) return 'Acesso bloqueado. Fale com o responsável.';
  if (status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (status >= 500) return 'Sistema indisponível no momento. Tente de novo em instantes.';
  return serverMsg || 'Não foi possível entrar. Tente de novo.';
}
