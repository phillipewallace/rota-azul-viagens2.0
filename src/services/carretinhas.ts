import { API_BASE_URL } from './config';

export interface Carretinha {
  id: string;
  name: string;
  plate: string;
  model: string | null;
  year: number | null;
  status: 'galpao' | 'locada' | 'manutencao';
  currentCustomerName: string | null;
  currentRentalStart: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CarretinhaLocacao {
  id: string;
  customerName: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token') || '';
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE_URL}/carretinhas${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers || {}) },
  });
  if (!r.ok) throw new Error((await r.text()) || 'Erro');
  return r.json();
}

export const carretinhasService = {
  list: () => call<Carretinha[]>(''),
  create: (data: Partial<Carretinha>) =>
    call<Carretinha>('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Carretinha>) =>
    call<Carretinha>(`/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => call<{ ok: true }>(`/${id}`, { method: 'DELETE' }),
  locar: (id: string, data: { customerName: string; startDate: string; notes?: string }) =>
    call<{ ok: true }>(`/${id}/locar`, { method: 'POST', body: JSON.stringify(data) }),
  baixa: (id: string, data: { endDate?: string; notes?: string }) =>
    call<{ ok: true }>(`/${id}/baixa`, { method: 'POST', body: JSON.stringify(data) }),
  historico: (id: string) => call<CarretinhaLocacao[]>(`/${id}/historico`),
};
