import { API_BASE_URL } from './config';
import type { ChecklistStatus } from '@/data/checklistTemplate';

export interface ChecklistItem {
  category: string;
  itemKey: string;
  itemLabel: string;
  status: ChecklistStatus;
  notes?: string | null;
}

export interface ChecklistSummary {
  id: string;
  truckId: string | null;
  truckPlate: string;
  truckName: string | null;
  truckModel: string | null;
  signerName: string;
  signerDocument: string;
  odometerKm: number | null;
  fuelLevel: string | null;
  summaryStatus: ChecklistStatus;
  criticalCount: number;
  attentionCount: number;
  vehicleKind?: 'truck' | 'carretinha' | null;
  vehicleType?: string | null;
  carretinhaId?: string | null;
  signatureMode?: 'none' | 'cliente' | 'conferente';
  secondSignerName?: string | null;
  secondSignerDocument?: string | null;
  secondSignedAt?: string | null;
  createdAt: string;
}

export interface ChecklistDetail extends ChecklistSummary {
  signatureDataUrl: string | null;
  generalNotes: string | null;
  secondSignatureDataUrl?: string | null;
  items: ChecklistItem[];
}

export interface PendingChecklist {
  id: string;
  truckPlate: string;
  truckName: string | null;
  truckModel: string | null;
  vehicleKind: 'truck' | 'carretinha';
  signerName: string;
  signatureMode: 'cliente' | 'conferente';
  createdAt: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const checklistsService = {
  async lookupTruck(plate: string) {
    const r = await fetch(`${API_BASE_URL}/checklists/lookup/truck/${encodeURIComponent(plate)}`);
    if (!r.ok) throw new Error('Veículo não encontrado');
    return r.json() as Promise<{ id: string; name: string; plate: string; model: string; year: number; kind: 'truck' | 'carretinha' }>;
  },
  async submit(payload: any) {
    const r = await fetch(`${API_BASE_URL}/checklists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error((await r.text()) || 'Erro ao enviar checklist');
    return r.json();
  },
  async list(params: Record<string, string | undefined>) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][]
    ).toString();
    const r = await fetch(`${API_BASE_URL}/checklists${qs ? '?' + qs : ''}`, {
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error('Erro ao listar checklists');
    return r.json() as Promise<ChecklistSummary[]>;
  },
  async get(id: string) {
    const r = await fetch(`${API_BASE_URL}/checklists/${id}`, { headers: authHeaders() });
    if (!r.ok) throw new Error('Erro ao buscar checklist');
    return r.json() as Promise<ChecklistDetail>;
  },
  async remove(id: string) {
    const r = await fetch(`${API_BASE_URL}/checklists/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error('Erro ao excluir');
    return r.json();
  },
  async listPending(plate: string) {
    const r = await fetch(`${API_BASE_URL}/checklists/lookup/pending/${encodeURIComponent(plate)}`);
    if (!r.ok) throw new Error('Erro ao buscar pendências');
    return r.json() as Promise<PendingChecklist[]>;
  },
  async sendSecondSignature(id: string, body: { signerName: string; signerDocument: string; signatureDataUrl: string }) {
    const r = await fetch(`${API_BASE_URL}/checklists/${id}/second-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.text()) || 'Erro ao salvar assinatura');
    return r.json();
  },
};
