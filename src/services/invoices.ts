import { API_BASE_URL } from './config';
import { appendPageParams, type Paged, type PageParams } from '@/lib/pagination';


const authHeader = () => {
  const t = localStorage.getItem('auth_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};
const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...authHeader() });

export type InvoiceStatus = 'ativa' | 'cancelada';
export type InvoiceFormaPagamento =
  'pix' | 'dinheiro' | 'boleto' | 'cartao' | 'transferencia' | 'outro';

export interface Invoice {
  id: string;
  contractId: string;
  competencia: string;          // YYYY-MM
  numero: string;
  serie?: string | null;
  dataEmissao: string;          // YYYY-MM-DD
  valor: number;
  formaPagamento?: InvoiceFormaPagamento | null;
  observacoes?: string | null;
  pdfUrl: string;
  pdfOriginalFilename?: string | null;
  pdfStoredFilename?: string | null;
  pdfSizeBytes?: number | null;
  status: InvoiceStatus;
  canceladoEm?: string | null;
  motivoCancelamento?: string | null;
  createdBy?: string | null;
  createdAt: string;
  contractNumero?: string;
  companyId?: string | null;
  companyRazaoSocial?: string | null;
  companyCnpj?: string | null;
  customerName?: string | null;
  customerDocument?: string | null;
}

export interface InvoiceListParams {
  contractId?: string;
  competencia?: string;
  from?: string;
  to?: string;
  status?: InvoiceStatus;
  formaPagamento?: InvoiceFormaPagamento;
  companyId?: string;
  search?: string;
}

async function reqJson<T>(method: string, path: string, body?: any): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`, {
    method, headers: jsonHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erro na requisição');
  return r.json();
}

async function reqUpload<T>(path: string, fd: FormData, method = 'POST'): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`, {
    method, headers: authHeader(), body: fd,
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Falha no upload');
  return r.json();
}

export const invoicesService = {
  list: (p?: InvoiceListParams) => {
    const q = new URLSearchParams();
    if (p) Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    const s = q.toString();
    return reqJson<Invoice[]>('GET', `/erp/invoices${s ? '?' + s : ''}`);
  },
  /**
   * Variante paginada — retorna `{ data, total, page, pageSize }`.
   * Use `page`/`pageSize` para acionar; o backend faz o COUNT(*).
   */
  listPaged: (p?: InvoiceListParams & PageParams) => {
    const q = new URLSearchParams();
    if (p) Object.entries(p).forEach(([k, v]) => {
      if (k === 'page' || k === 'pageSize') return;
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    appendPageParams(q, p);
    return reqJson<Paged<Invoice>>('GET', `/erp/invoices?${q.toString()}`);
  },
  /**
   * KPIs agregados no servidor (respeitam filtros; independem da página).
   */
  kpis: (p?: InvoiceListParams) => {
    const q = new URLSearchParams();
    if (p) Object.entries(p).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    const s = q.toString();
    return reqJson<{
      total: number; qtdAtivas: number; qtdCanceladas: number;
      totalAtivo: number; ticketMedio: number;
    }>('GET', `/erp/invoices/stats/kpis${s ? '?' + s : ''}`);
  },
  get: (id: string) => reqJson<Invoice>('GET', `/erp/invoices/${id}`),
  create: (data: {
    file: File;
    contractId: string;
    competencia?: string;
    numero: string;
    serie?: string;
    dataEmissao: string;
    valor: number;
    formaPagamento?: InvoiceFormaPagamento;
    observacoes?: string;
  }) => {
    const fd = new FormData();
    fd.append('file', data.file, data.file.name);
    fd.append('contractId', data.contractId);
    if (data.competencia)    fd.append('competencia', data.competencia);
    fd.append('numero', data.numero);
    if (data.serie)          fd.append('serie', data.serie);
    fd.append('dataEmissao', data.dataEmissao);
    fd.append('valor', String(data.valor));
    if (data.formaPagamento) fd.append('formaPagamento', data.formaPagamento);
    if (data.observacoes)    fd.append('observacoes', data.observacoes);
    return reqUpload<{ ok: true; id: string; contractId: string; competencia: string }>('/erp/invoices', fd);
  },
  update: (id: string, data: Partial<{
    numero: string; serie: string; dataEmissao: string;
    competencia: string; valor: number;
    formaPagamento: InvoiceFormaPagamento; observacoes: string;
  }>) => reqJson<{ ok: true }>('PATCH', `/erp/invoices/${id}`, data),
  replacePdf: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return reqUpload<{ ok: true; pdfUrl: string }>(`/erp/invoices/${id}/replace-pdf`, fd);
  },
  cancel: (id: string, motivo: string) =>
    reqJson<{ ok: true }>('POST', `/erp/invoices/${id}/cancel`, { motivo }),
  remove: (id: string) => reqJson<{ ok: true }>('DELETE', `/erp/invoices/${id}`),
};

export const INVOICE_FORMA_LABEL: Record<InvoiceFormaPagamento, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', boleto: 'Boleto',
  cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro',
};
