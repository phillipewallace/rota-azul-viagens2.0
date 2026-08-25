/**
 * Hook de listagem de clientes com paginação SERVER-SIDE.
 * Separado de useCustomers (que ainda serve autocomplete/dashboards).
 *
 * - GET /customers?search=&filter=&onlyDuplicates=1&page=&pageSize=
 * - GET /customers/stats/kpis (mesmos filtros, sem page)
 * - POST /customers            (criar)
 * - PATCH /customers/:id       (atualizar)
 * - DELETE /customers/:id      (remover)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/services/config';
import type { Customer } from './useCustomers';

export type CustomerFilter = 'all' | 'pf' | 'pj' | 'withSan' | 'noCoords';

export interface CustomersKpis {
  total: number;
  pf: number;
  pj: number;
  semCoord: number;
  duplicados: number;
}

interface Params {
  search: string;
  filter: CustomerFilter;
  onlyDuplicates: boolean;
  page: number;
  pageSize: number;
}

export function useCustomersPaged(params: Params) {
  const [items, setItems] = useState<(Customer & { isDuplicate?: boolean })[]>([]);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<CustomersKpis>({ total: 0, pf: 0, pj: 0, semCoord: 0, duplicados: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqSeq = useRef(0);

  const authHeaders = useCallback((): HeadersInit => {
    const t = localStorage.getItem('auth_token');
    return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
  }, []);

  const buildQS = useCallback((withPage: boolean) => {
    const qs = new URLSearchParams();
    if (params.search.trim()) qs.set('search', params.search.trim());
    if (params.filter !== 'all') qs.set('filter', params.filter);
    if (params.onlyDuplicates) qs.set('onlyDuplicates', '1');
    if (withPage) {
      qs.set('page', String(params.page));
      qs.set('pageSize', String(params.pageSize));
    }
    return qs.toString();
  }, [params.search, params.filter, params.onlyDuplicates, params.page, params.pageSize]);

  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const [listR, kpisR] = await Promise.all([
        fetch(`${API_BASE_URL}/customers?${buildQS(true)}`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/customers/stats/kpis?${buildQS(false)}`, { headers: authHeaders() }),
      ]);
      if (!listR.ok) throw new Error(`Lista: ${listR.status}`);
      if (!kpisR.ok) throw new Error(`KPIs: ${kpisR.status}`);
      const listJ = await listR.json();
      const kpisJ = await kpisR.json();
      if (seq !== reqSeq.current) return; // resposta obsoleta
      setItems(listJ.data || []);
      setTotal(listJ.total || 0);
      setKpis({
        total: kpisJ.total || 0,
        pf: kpisJ.pf || 0,
        pj: kpisJ.pj || 0,
        semCoord: kpisJ.semCoord || 0,
        duplicados: kpisJ.duplicados || 0,
      });
      setError(null);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [buildQS, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const createCustomer = useCallback(async (c: Customer) => {
    const r = await fetch(`${API_BASE_URL}/customers`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(c),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao criar cliente');
    }
    return r.json();
  }, [authHeaders]);

  const patchCustomer = useCallback(async (c: Customer) => {
    const r = await fetch(`${API_BASE_URL}/customers/${c.id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(c),
    });
    if (r.status === 409) {
      const err = await r.json().catch(() => ({}));
      const e = new Error(err.error || 'Conflito de edição concorrente.');
      (e as any).code = 'CONFLICT';
      throw e;
    }
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao atualizar cliente');
    }
    return r.json();
  }, [authHeaders]);

  const removeCustomer = useCallback(async (id: string) => {
    const r = await fetch(`${API_BASE_URL}/customers/${id}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao remover cliente');
    }
  }, [authHeaders]);

  return {
    items, total, kpis, loading, error,
    refetch: load,
    createCustomer, patchCustomer, removeCustomer,
  };
}
