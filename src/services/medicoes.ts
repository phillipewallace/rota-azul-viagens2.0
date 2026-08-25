import { API_BASE_URL } from './config';
import { appendPageParams, type Paged, type PageParams } from '@/lib/pagination';

const headers = () => {
  const t = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};
async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(e.error || 'Erro na requisição');
  }
  return r.json();
}

export interface MedicaoItem {
  id?: string;
  contractId?: string | null;
  contractNumero?: string | null;
  descricao: string;
  quantidade: number;
  unidade?: string;
  valorUnit: number;
  descontoItem: number;
  valorTotal: number;
  periodoInicio?: string | null;
  periodoFim?: string | null;
  ordem?: number;
}

export interface Medicao {
  id: string;
  numero: string;
  clienteDocumento?: string | null;
  clienteNome?: string | null;
  customerId?: string | null;
  companyId?: string | null;
  competencia?: string | null;
  periodoInicio?: string | null;
  periodoFim?: string | null;
  subtotal: number;
  desconto: number;
  total: number;
  observacoes?: string | null;
  snapshot?: any;
  pdfGeradoEm?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string;
  companyRazaoSocial?: string | null;
  companyCnpj?: string | null;
  customerName?: string | null;
  customerDocument?: string | null;
  itensCount?: number;
  items?: MedicaoItem[];
}

export interface MedicaoPreviewContract {
  id: string;
  numero: string;
  descricao?: string | null;
  valorMensal: number;
  dataInicio?: string;
  customerId?: string;
  companyId?: string;
  enderecoObra?: string | null;
  localEvento?: string | null;
  customerName?: string | null;
  customerDocument?: string | null;
}

export interface MedicaoListParams {
  competencia?: string;
  clienteDoc?: string;
  customerId?: string;
  companyId?: string;
  from?: string;
  to?: string;
  search?: string;
}
function buildMedicoesQuery(p?: MedicaoListParams) {
  const q = new URLSearchParams();
  if (p?.competencia) q.set('competencia', p.competencia);
  if (p?.clienteDoc)  q.set('clienteDoc', p.clienteDoc);
  if (p?.customerId)  q.set('customerId', p.customerId);
  if (p?.companyId)   q.set('companyId', p.companyId);
  if (p?.from)        q.set('from', p.from);
  if (p?.to)          q.set('to', p.to);
  if (p?.search)      q.set('search', p.search);
  return q;
}
export const medicoesService = {
  list: (params?: MedicaoListParams) => {
    const s = buildMedicoesQuery(params).toString();
    return req<Medicao[]>('GET', `/erp/medicoes${s ? '?' + s : ''}`);
  },
  /** Variante paginada — envelope `{ data, total, page, pageSize }`. */
  listPaged: (params?: MedicaoListParams & PageParams) => {
    const q = buildMedicoesQuery(params);
    appendPageParams(q, params);
    return req<Paged<Medicao>>('GET', `/erp/medicoes?${q.toString()}`);
  },
  /** KPIs agregados server-side (respeitam os filtros). */
  kpis: (params?: MedicaoListParams) => {
    const s = buildMedicoesQuery(params).toString();
    return req<{
      total: number; totalValor: number; ticketMedio: number; clientesDistintos: number;
    }>('GET', `/erp/medicoes/stats/kpis${s ? '?' + s : ''}`);
  },
  get: (id: string) => req<Medicao>('GET', `/erp/medicoes/${id}`),
  preview: (contractIds: string[], competencia?: string) =>
    req<{ competencia?: string; contracts: MedicaoPreviewContract[] }>('POST', '/erp/medicoes/preview', { contractIds, competencia }),
  create: (data: Omit<Partial<Medicao>, 'items'> & { items: Partial<MedicaoItem>[] }) =>
    req<{ ok: true; id: string; numero: string }>('POST', '/erp/medicoes', data),
  update: (id: string, data: Omit<Partial<Medicao>, 'items'> & { items: Partial<MedicaoItem>[] }) =>
    req<{ ok: true }>('PUT', `/erp/medicoes/${id}`, data),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/medicoes/${id}`),
};
