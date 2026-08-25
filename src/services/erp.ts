import { API_BASE_URL } from './config';
import { appendPageParams, type PageParams, type Paged } from '@/lib/pagination';


const authHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/erp${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erro na requisição');
  }
  return res.json();
}

export interface ErpCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tracksExpiry: boolean;
  requiresSignedTerm: boolean;
}
export interface ErpItem {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  tracksExpiry: boolean;
  requiresSignedTerm: boolean;
  name: string;
  sku?: string;
  unit: string;
  currentQty: number;
  minQty: number;
  expiryDate?: string;
  expiryAlertDays: number;
  notes?: string;
  active: boolean;
}
export interface ErpEmployee {
  id: string;
  name: string;
  role?: string;
  cpf?: string;
  phone?: string;
  active: boolean;
}
export interface ErpMovement {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  type: 'in' | 'out' | 'adjust' | 'discard';
  qty: number;
  employeeId?: string;
  employeeName?: string;
  performedBy?: string;
  notes?: string;
  signedPdfUrl?: string;
  createdAt: string;
}
export interface ErpDashboard {
  lowStock: any[];
  expiring: any[];
  totals: { totalItems: number; totalCategories: number; totalEmployees: number };
  alertCount: number;
}

export const erpService = {
  // categories
  listCategories: () => req<ErpCategory[]>('GET', '/categories'),
  createCategory: (data: Partial<ErpCategory>) => req<ErpCategory>('POST', '/categories', data),
  updateCategory: (id: string, data: Partial<ErpCategory>) => req<ErpCategory>('PUT', `/categories/${id}`, data),
  deleteCategory: (id: string) => req<{ ok: true }>('DELETE', `/categories/${id}`),
  // items
  listItems: () => req<ErpItem[]>('GET', '/items'),
  createItem: (data: Partial<ErpItem>) => req<ErpItem>('POST', '/items', data),
  updateItem: (id: string, data: Partial<ErpItem>) => req<ErpItem>('PUT', `/items/${id}`, data),
  deleteItem: (id: string) => req<{ ok: true }>('DELETE', `/items/${id}`),
  // employees
  listEmployees: () => req<ErpEmployee[]>('GET', '/employees'),
  createEmployee: (data: Partial<ErpEmployee>) => req<ErpEmployee>('POST', '/employees', data),
  updateEmployee: (id: string, data: Partial<ErpEmployee>) => req<ErpEmployee>('PUT', `/employees/${id}`, data),
  deleteEmployee: (id: string) => req<{ ok: true }>('DELETE', `/employees/${id}`),
  // movements
  listMovements: (itemId?: string) =>
    req<ErpMovement[]>('GET', `/movements${itemId ? `?itemId=${itemId}` : ''}`),
  createMovement: (data: Partial<ErpMovement>) => req<ErpMovement>('POST', '/movements', data),
  // dashboard
  dashboard: () => req<ErpDashboard>('GET', '/dashboard'),
  // vehicles
  listVehicles: () => req<ErpVehicle[]>('GET', '/vehicles'),
  createVehicle: (data: Partial<ErpVehicle>) => req<ErpVehicle>('POST', '/vehicles', data),
  updateVehicle: (id: string, data: Partial<ErpVehicle>) => req<ErpVehicle>('PUT', `/vehicles/${id}`, data),
  deleteVehicle: (id: string) => req<{ ok: true }>('DELETE', `/vehicles/${id}`),
  listVehicleComments: (id: string) => req<ErpVehicleComment[]>('GET', `/vehicles/${id}/comments`),
  createVehicleComment: (id: string, data: Partial<ErpVehicleComment>) =>
    req<ErpVehicleComment>('POST', `/vehicles/${id}/comments`, data),
  updateVehicleComment: (vid: string, cid: string, data: Partial<ErpVehicleComment>) =>
    req<ErpVehicleComment>('PUT', `/vehicles/${vid}/comments/${cid}`, data),
  deleteVehicleComment: (vid: string, cid: string) =>
    req<{ ok: true }>('DELETE', `/vehicles/${vid}/comments/${cid}`),
  // companies (CNPJs emissores — máx 3)
  listCompanies: () => req<ErpCompany[]>('GET', '/companies'),
  createCompany: (data: Partial<ErpCompany>) => req<ErpCompany>('POST', '/companies', data),
  updateCompany: (id: string, data: Partial<ErpCompany>) => req<ErpCompany>('PUT', `/companies/${id}`, data),
  deleteCompany: (id: string) => req<{ ok: true }>('DELETE', `/companies/${id}`),
  // signed PDFs (histórico da aba Assinatura)
  listSignedPdfs: (companyId?: string) =>
    req<SignedPdf[]>('GET', `/signed-pdfs${companyId ? `?companyId=${companyId}` : ''}`),
  listSignedPdfsPaged: (opts: { companyId?: string; search?: string } & PageParams = {}) => {
    const q = new URLSearchParams();
    if (opts.companyId) q.set('companyId', opts.companyId);
    if (opts.search) q.set('search', opts.search);
    appendPageParams(q, opts);
    const s = q.toString();
    return req<Paged<SignedPdf>>('GET', `/signed-pdfs${s ? '?' + s : ''}`);
  },
  signedPdfsKpis: (opts: { companyId?: string; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.companyId) q.set('companyId', opts.companyId);
    if (opts.search) q.set('search', opts.search);
    const s = q.toString();
    return req<{ total: number; totalBytes: number; totalPages: number; empresasDistintas: number }>(
      'GET', `/signed-pdfs/stats/kpis${s ? '?' + s : ''}`,
    );
  },
  deleteSignedPdf: (id: string) => req<{ ok: true }>('DELETE', `/signed-pdfs/${id}`),
};

export interface SignedPdf {
  id: string;
  companyId?: string;
  companyName?: string;
  originalFilename: string;
  storedFilename: string;
  fileUrl: string;
  pages?: number;
  placementsCount?: number;
  sizeBytes?: number;
  createdBy?: string;
  createdAt: string;
}

export async function uploadSignedPdfBlob(
  blob: Blob,
  meta: { companyId?: string; originalFilename: string; pages?: number; placementsCount?: number },
): Promise<SignedPdf> {
  const fd = new FormData();
  fd.append('file', blob, meta.originalFilename);
  if (meta.companyId) fd.append('companyId', meta.companyId);
  fd.append('originalFilename', meta.originalFilename);
  if (meta.pages != null) fd.append('pages', String(meta.pages));
  if (meta.placementsCount != null) fd.append('placementsCount', String(meta.placementsCount));
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/erp/signed-pdfs`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Falha ao salvar PDF assinado');
  }
  return res.json();
}

export interface ErpCompany {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  inscricaoEstadual?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  logoUrl?: string;
  assinaturaUrl?: string;
  financeiroContato?: string;
  sigla?: string;
  ativo: boolean;
  createdAt?: string;
}

export type SanitarioCategoria = 'comum' | 'pne' | 'pia' | 'luxo' | 'cabine_banho';
export const SANITARIO_CATEGORIAS: { value: SanitarioCategoria; label: string; color: string }[] = [
  { value: 'comum',        label: 'Comum',            color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'pne',          label: 'PNE',              color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'pia',          label: 'Com Pia',          color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'luxo',         label: 'Luxo',             color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'cabine_banho', label: 'Cabine de Banho',  color: 'bg-violet-100 text-violet-700 border-violet-200' },
];
export const sanitarioCategoriaLabel = (v?: string) =>
  SANITARIO_CATEGORIAS.find(c => c.value === v)?.label || 'Comum';

export interface SanitarioCategoriaSummary {
  totalFisico: number;
  numerados: number;
  disponivel: number;
  em_cliente: number;
  manutencao: number;
  inativo: number;
  semNumeracao: number;
  livres: number;
}

export interface SanitarioStockSummary {
  disponivel: number;
  em_cliente: number;
  manutencao: number;
  inativo: number;
  em_os: number;
  reservadosEmOs: number;
  atrasados: number;
  total: number;
  totalFisico?: number;
  porCategoria?: Record<SanitarioCategoria, SanitarioCategoriaSummary>;
}

export async function fetchSanitarioStockSummary(): Promise<SanitarioStockSummary> {
  const tk = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/sanitarios/stock-summary`, {
    headers: tk ? { Authorization: `Bearer ${tk}` } : {},
  });
  if (!res.ok) throw new Error('erro');
  return res.json();
}

export async function updateSanitarioTotalFisico(totalFisico: number): Promise<void> {
  const tk = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/sanitarios/total-fisico`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
    body: JSON.stringify({ totalFisico }),
  });
  if (!res.ok) throw new Error('erro ao salvar total físico');
}

export async function updateSanitarioCategoriaTotalFisico(
  categoria: SanitarioCategoria,
  totalFisico: number,
): Promise<void> {
  const tk = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/sanitarios/total-fisico`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
    body: JSON.stringify({ categoria, totalFisico }),
  });
  if (!res.ok) throw new Error('erro ao salvar total físico');
}

export async function updateSanitarioCategoria(
  numero: string,
  categoria: SanitarioCategoria,
): Promise<void> {
  const tk = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/sanitarios/${encodeURIComponent(numero)}/categoria`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
    body: JSON.stringify({ categoria }),
  });
  if (!res.ok) throw new Error('erro ao salvar categoria');
}


export interface ErpVehicle {
  id: string;
  name: string;
  vehicleType: string; // caminhao, carro, carretinha, moto, van, outro
  brand?: string;
  model?: string;
  year?: number;
  plate?: string;
  renavam?: string;
  chassis?: string;
  color?: string;
  fuel?: string;
  acquisitionDate?: string;
  notes?: string;
  active: boolean;
  commentsCount?: number;
  openCount?: number;
}

export interface ErpVehicleComment {
  id: string;
  vehicleId: string;
  comment: string;
  category?: string; // multa, manutencao, abastecimento, observacao
  referenceDate?: string;
  amount?: number;
  status: 'open' | 'closed';
  attachmentUrl?: string;
  author?: string;
  createdAt: string;
}

// File upload (re-uses existing /upload endpoint)
export async function uploadSignedPdf(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  if (!res.ok) throw new Error('Falha ao enviar PDF');
  const data = await res.json();
  return data.url as string;
}

export const sanitarioNewService = {
  listAvailable: () => req<any[]>('GET', '/sanitarios/available'),
  listTipos: () => req<any[]>('GET', '/sanitarios/tipos'),
  saveManual: (data: any) => req<any>('POST', '/erp/sanitarios-new/estoque-manual', data),
  remove: (numero: string) => req<any>('DELETE', `/sanitarios/${encodeURIComponent(numero)}`),
};

