/**
 * Tipos e helpers de paginação do lado do cliente.
 *
 * O backend expõe endpoints com paginação **opt-in**: quando a query
 * inclui `page` e/ou `pageSize`, a resposta muda de `T[]` para
 * `{ data: T[]; total: number; page: number; pageSize: number }` e
 * também traz o header `X-Total-Count`.
 *
 * Este módulo padroniza:
 *   - O tipo `Paged<T>` da resposta.
 *   - O tipo `PageParams` que todo serviço aceita.
 *   - O `buildPageQuery` que serializa `page` / `pageSize` para URLSearchParams.
 */

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageParams {
  page?: number;
  /** Máx. 200 (limite do backend). Default no servidor é 50. */
  pageSize?: number;
}

/** Serializa page/pageSize em URLSearchParams (mutação in-place). */
export function appendPageParams(q: URLSearchParams, p?: PageParams): void {
  if (!p) return;
  if (p.page != null)     q.set('page', String(Math.max(1, Number(p.page) || 1)));
  if (p.pageSize != null) q.set('pageSize', String(Math.min(200, Math.max(1, Number(p.pageSize) || 50))));
}

/** Calcula o total de páginas com base em `total` e `pageSize`. */
export const totalPages = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil((total || 0) / Math.max(1, pageSize)));

/** Rótulo "1–25 de 137" para exibir o intervalo da página atual. */
export function pageRangeLabel(p: Paged<unknown>): string {
  if (!p.total) return '0 de 0';
  const from = (p.page - 1) * p.pageSize + 1;
  const to = Math.min(p.total, p.page * p.pageSize);
  return `${from}–${to} de ${p.total}`;
}
