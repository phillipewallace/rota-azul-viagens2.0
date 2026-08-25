/**
 * Paginação opt-in retrocompatível para endpoints de listagem.
 *
 * Uso no handler:
 *
 *   const pg = parsePagination(req);
 *   const where = ...;
 *   const rowsQ = pool.query(`SELECT ... ${where} ORDER BY ... ${pg.sql}`, [...params, ...pg.params]);
 *   if (pg.paginated) {
 *     const total = await pool.query(`SELECT COUNT(*)::int AS c FROM ... ${where}`, params);
 *     return sendPaginated(res, (await rowsQ).rows, total.rows[0].c, pg);
 *   }
 *   res.json((await rowsQ).rows);
 *
 * Contrato:
 * - Se `?page=` ou `?pageSize=` presente → resposta { data, total, page, pageSize }
 *   + header X-Total-Count.
 * - Caso contrário → array direto (comportamento atual).
 */
import type { Request, Response } from 'express';

export interface Pagination {
  paginated: boolean;
  page: number;
  pageSize: number;
  offset: number;
  /** SQL a concatenar após ORDER BY (`LIMIT $n OFFSET $m` ou `LIMIT <max>`). */
  sql: string;
  /** Parâmetros posicionais adicionais para a query paginada. */
  params: number[];
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const SAFETY_CAP = 5000;

export function parsePagination(req: Request, paramOffset = 0): Pagination {
  const q = req.query as Record<string, unknown>;
  const hasPage = q.page !== undefined || q.pageSize !== undefined;
  if (!hasPage) {
    return {
      paginated: false, page: 1, pageSize: SAFETY_CAP, offset: 0,
      sql: `LIMIT ${SAFETY_CAP}`, params: [],
    };
  }
  const page = Math.max(1, Number(q.page) || 1);
  const rawSize = Number(q.pageSize) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  const offset = (page - 1) * pageSize;
  return {
    paginated: true, page, pageSize, offset,
    sql: `LIMIT $${paramOffset + 1} OFFSET $${paramOffset + 2}`,
    params: [pageSize, offset],
  };
}

export function sendPaginated<T>(res: Response, data: T[], total: number, pg: Pagination) {
  res.setHeader('X-Total-Count', String(total));
  res.json({ data, total, page: pg.page, pageSize: pg.pageSize });
}
