import { API_BASE_URL } from './config';

export interface AppUser {
  id: string;
  username: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handle(res: Response) {
  if (!res.ok) {
    const t = await res.text();
    let msg = t;
    try { msg = JSON.parse(t).error || t; } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}

export const usersService = {
  async list(): Promise<AppUser[]> {
    const r = await fetch(`${API_BASE_URL}/users`, { headers: authHeaders() });
    return handle(r);
  },
  async create(input: { username: string; password: string; name?: string; email?: string; role?: string; active?: boolean }): Promise<AppUser> {
    const r = await fetch(`${API_BASE_URL}/users`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(input) });
    return handle(r);
  },
  async update(id: string, input: Partial<{ password: string; name: string; email: string; role: string; active: boolean }>): Promise<AppUser> {
    const r = await fetch(`${API_BASE_URL}/users/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(input) });
    return handle(r);
  },
  async remove(id: string): Promise<void> {
    const r = await fetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE', headers: authHeaders() });
    await handle(r);
  },
};
