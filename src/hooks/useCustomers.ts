import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '@/services/config';
import { usePolling } from './usePolling';

export interface Customer {
  id: string;
  customerName: string;
  address: string;
  cep: string;
  restroomsQty?: number;
  cleaningsQty?: number;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  // Novos campos cadastrais
  personType?: 'PF' | 'PJ';
  document?: string;          // CPF ou CNPJ
  ie?: string;
  im?: string;
  email?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  responsavelNome?: string;
  responsavelCpf?: string;
  tipoCliente?: string;       // eventos | obra | industria | outro
  createdAt?: string;
  updatedAt?: string;
}

export interface UseCustomersOptions {
  /** Quando false, pausa o polling automático (ex.: durante cadastro/edição) */
  pollEnabled?: boolean;
}

export const useCustomers = (options: UseCustomersOptions = {}) => {
  const { pollEnabled = true } = options;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  // [concurrency] Timestamp do último fetch — backend usa pra não apagar
  // clientes criados por outros usuários enquanto este editava.
  const loadedAtRef = useRef<string | null>(null);

  const authHeaders = useCallback((): HeadersInit => {
    const t = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    };
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      if (!hasLoadedRef.current) setLoading(true);
      const response = await fetch(`${API_BASE_URL}/customers`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Erro ao carregar clientes');
      const data = await response.json();
      setCustomers(data || []);
      loadedAtRef.current = new Date().toISOString();
      hasLoadedRef.current = true;
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      if (!hasLoadedRef.current) setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  usePolling(fetchCustomers, 15000, pollEnabled);

  const addCustomer = useCallback((customer: Customer) => {
    setCustomers(prev => [...prev, customer]);
  }, []);
  const updateCustomer = useCallback(<K extends keyof Customer>(id: string, field: K, value: Customer[K]) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }, []);
  const deleteCustomer = useCallback((id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  }, []);

  const saveCustomers = useCallback(async (override?: Customer[]) => {
    const payload = override ?? customers;
    const response = await fetch(`${API_BASE_URL}/customers`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        customers: payload,
        clientLoadedAt: loadedAtRef.current,
      }),
    });
    if (response.status === 409) {
      const err = await response.json().catch(() => ({}));
      await fetchCustomers();
      const e = new Error(err.error || 'Outro usuário modificou estes registros. Lista recarregada.');
      (e as any).code = 'CONFLICT';
      (e as any).conflicts = err.conflicts;
      throw e;
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao salvar clientes');
    }
    const result = await response.json();
    setCustomers(result.customers || payload);
    loadedAtRef.current = new Date().toISOString();
    return result;
  }, [customers, authHeaders, fetchCustomers]);


  return { customers, loading, error, addCustomer, updateCustomer, deleteCustomer, saveCustomers, refetch: fetchCustomers };
};
