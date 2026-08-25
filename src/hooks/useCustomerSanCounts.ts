/**
 * Conta quantos sanitários estão atualmente alocados em cada cliente
 * (status = em_cliente), indexado por nome (case-insensitive).
 */
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/services/config';

export function useCustomerSanCounts(triggerKey: unknown): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        // [#16 médio] pageSize alto evita truncar contagem com >200 sanitários em cliente.
        const r = await fetch(
          `${API_BASE_URL}/sanitarios?status=em_cliente&pageSize=2000&page=1`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );

        if (!r.ok) return;
        const data = await r.json();
        const list = Array.isArray(data) ? data : (data.data || []);
        const map: Record<string, number> = {};
        for (const s of list) {
          const k = (s.current_customer_name || '').toLowerCase();
          if (k) map[k] = (map[k] || 0) + 1;
        }
        if (!canceled) setCounts(map);
      } catch {
        /* silencioso — feature opcional */
      }
    })();
    return () => { canceled = true; };
  }, [triggerKey]);

  return counts;
}
