import { API_BASE_URL } from './config';

export async function movimentarSanitarios(payload: {
  numeros: string[];
  operationType: 'entrega' | 'recolhimento' | 'manutencao' | 'transferencia';
  routeId?: string;
  routePointId?: string;
  customerName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  driverId?: string;
  driverName?: string;
  truckId?: string;
  notes?: string;
}): Promise<void> {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('auth-token') || '';
  const res = await fetch(`${API_BASE_URL}/sanitarios/movimentar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sanitários: ${res.status} ${t}`);
  }
}
