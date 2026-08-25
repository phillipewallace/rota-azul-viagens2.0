import { API_BASE_URL } from './config';
import { appendPageParams, type Paged, type PageParams } from '@/lib/pagination';

const authHeaders = () => {
  const t = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || 'Erro na requisição');
  }
  return res.json();
}

export type Modalidade = 'diaria' | 'mensal';
export type TipoLocacao = 'obra' | 'evento' | 'industria' | 'outro';
export type QuoteStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'convertido';

export interface QuoteItem {
  id?: string;
  produto: string;
  descricao?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal?: number;
  ordem?: number;
  isSanitario?: boolean;
  isGenericService?: boolean;
}

export interface Quote {
  id: string;
  numero: string;
  companyId?: string;
  customerId?: string;
  companyRazaoSocial?: string;
  companyCnpj?: string;
  customerName?: string;
  customerDocument?: string;
  customerSnapshot?: any;
  responsavelNome?: string | null;
  responsavelTelefone?: string | null;
  responsavelEmail?: string | null;
  companySnapshot?: any;
  modalidade: Modalidade;
  tipoLocacao?: TipoLocacao;
  dataEmissao: string;
  validadeDias: number;
  dataEntrega?: string | null;
  dataRecolhimento?: string | null;
  enderecoEntrega?: string | null;
  limpezasSemanais?: number | null;
  observacoes?: string;
  condicoesPagamento?: string;
  formaPagamento?: 'cartao' | 'pix' | 'boleto' | null;
  descontoPct: number;
  frete: number;
  subtotal: number;
  total: number;
  status: QuoteStatus;
  pdfGeradoEm?: string;
  createdAt: string;
  updatedAt: string;
  items?: QuoteItem[];
}

// [#27 baixo] helper — só inclui chaves com valor presente (evita "undefined" como string).
const toQuery = (params?: Record<string, unknown>): string => {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
};

export const quotesService = {
  list: (params?: { status?: string; customerId?: string }) =>
    req<Quote[]>('GET', `/erp/quotes${toQuery(params)}`),
  /** Variante paginada — envelope `{ data, total, page, pageSize }` com filtros server-side. */
  listPaged: (params?: {
    status?: string; customerId?: string;
    modalidade?: 'diaria' | 'mensal';
    companyId?: string;
    search?: string;
  } & PageParams) => {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (k === 'page' || k === 'pageSize') return;
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    appendPageParams(q, params);
    return req<Paged<Quote>>('GET', `/erp/quotes?${q.toString()}`);
  },
  /** KPIs agregados no servidor (evita puxar todos os orçamentos para o front). */
  stats: () => req<{
    rascunhos: number; enviados: number;
    aprovadosMes: number; valorAprovadosMes: number; ticketMedio: number;
  }>('GET', `/erp/quotes/stats/kpis`),
  get: (id: string) => req<Quote>('GET', `/erp/quotes/${id}`),
  create: (data: Partial<Quote>) => req<{ id: string; numero: string }>('POST', '/erp/quotes', data),
  update: (id: string, data: Partial<Quote>) => req<{ ok: true }>('PUT', `/erp/quotes/${id}`, data),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/quotes/${id}`),
  convertToOs: (id: string, body?: { dias?: number }) =>
    req<{ ok: true; osId: string; osNumero: string; sanitariosReservados: number }>(
      'POST', `/erp/quotes/${id}/convert-to-os`, body || {}),
  duplicate: (id: string) =>
    req<{ id: string; numero: string }>('POST', `/erp/quotes/${id}/duplicate`),
  uploadPdf: async (id: string, blob: Blob): Promise<{ ok: true; fileUrl: string; sizeBytes: number }> => {
    const fd = new FormData();
    fd.append('file', blob, `Orcamento-${id}.pdf`);
    const t = localStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE_URL}/erp/quotes/${id}/upload-pdf`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(e.error || 'Falha ao enviar PDF');
    }
    return res.json();
  },
};


export interface ServiceOrder {
  id: string;
  numero: string;
  quoteId?: string;
  companyId?: string;
  customerId?: string;
  customerName?: string;
  customerAddress?: string;
  customerLat?: number;
  customerLng?: number;
  companyRazaoSocial?: string;
  modalidade: Modalidade;
  tipoLocacao?: TipoLocacao;
  dataInicio: string;
  dataFimPrevista?: string;
  dataFechamento?: string;
  dataEntrega?: string | null;
  dataRecolhimento?: string | null;
  limpezasSemanais?: number | null;
  enderecoEntrega?: string | null;
  qtdReservada?: number;
  status: 'aberta' | 'fechada' | 'cancelada' | 'entregue' | 'em_cliente' | 'recolhimento' | 'recolhimento_solicitado' | 'despachada';
  valorTotal: number;
  observacoes?: string;
  formaPagamento?: 'cartao' | 'pix' | 'boleto' | null;
  funcionario_id?: string | null;
  createdAt: string;
  emAtraso?: boolean;
  sanitariosAlocados?: number;
  sanitariosEntregues?: number;
  convertedContractId?: string | null;
  convertedContractNumero?: string | null;
  convertedAt?: string | null;
}

export const serviceOrdersService = {
  list: (params?: { status?: string; overdue?: boolean }) => {
    const q = new URLSearchParams(
      Object.entries(params || {}).reduce((acc: any, [k, v]) => {
        if (v !== undefined && v !== null && v !== '') acc[k] = String(v);
        return acc;
      }, {})
    ).toString();
    return req<ServiceOrder[]>('GET', `/erp/service-orders${q ? '?' + q : ''}`);
  },
  /** Variante paginada — retorna envelope `{ data, total, page, pageSize }`. */
  listPaged: (params?: {
    status?: string; overdue?: boolean;
    tipoLocacao?: string; search?: string;
  } & PageParams) => {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (k === 'page' || k === 'pageSize') return;
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    appendPageParams(q, params);
    return req<Paged<ServiceOrder>>('GET', `/erp/service-orders?${q.toString()}`);
  },
  /** Contagens por aba (respeita filtros tipo/search). */
  counts: (params?: { tipoLocacao?: string; search?: string }) => {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    const s = q.toString();
    return req<{ todas: number; abertas: number; atrasadas: number; fechadas: number }>(
      'GET', `/erp/service-orders/stats/counts${s ? '?' + s : ''}`);
  },

  get: (id: string) => req<ServiceOrder & { sanitarios: any[]; items: any[]; companySnapshot: any; customer_snapshot?: any; quote_id?: string }>('GET', `/erp/service-orders/${id}`),
  create: (data: any) => req<{ id: string; numero: string }>('POST', '/erp/service-orders', data),
  close: (id: string, body?: { descricao?: string }) => req<{ ok: true; recolhidos?: boolean }>('POST', `/erp/service-orders/${id}/close`, body || {}),
  upcoming: () => req<Array<{ id: string; numero: string; dataEntrega: string; tipoLocacao?: string; enderecoEntrega?: string; customerName?: string; hoje: boolean; amanha: boolean }>>('GET', `/erp/service-orders/notifications/upcoming`),
  deliver: (id: string, body: { sanitarioNumeros: string[]; address?: string; notes?: string }) =>
    req<{ ok: true; delivered: string[] }>('POST', `/erp/service-orders/${id}/deliver`, body),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/service-orders/${id}`),
  convertToContract: (id: string, body?: {
    diaVencimento?: number;
    renovacaoAutomatica?: boolean;
    cno?: string;
    dataFim?: string | null;
    observacoes?: string;
    descricao?: string;
    // Overrides preenchidos via modal quando faltarem na OS/orçamento:
    responsavelNome?: string;
    responsavelTelefone?: string;
    responsavelEmail?: string;
    enderecoEntrega?: string;
    dataEntrega?: string;
    valorTotal?: number;
  }) => req<{ ok: true; contractId: string; contractNumero: string }>(
    'POST', `/erp/service-orders/${id}/convert-to-contract`, body || {}),

  overdueCount: () => req<{ overdue: number }>('GET', `/erp/service-orders/overdue/count`),
  financial: (params?: { from?: string; to?: string; status?: string; tipoLocacao?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params || {}).reduce((acc: any, [k, v]) => {
        if (v) acc[k] = String(v); return acc;
      }, {})
    ).toString();
    return req<{ rows: any[]; totals: { total: number; fechadas: number; abertas: number; count: number } }>(
      'GET', `/erp/service-orders/financial/summary${q ? '?' + q : ''}`);
  },
  movements: (params?: { from?: string; to?: string; sanitarioNumero?: string; type?: string; limit?: number }) => {
    const q = new URLSearchParams(
      Object.entries(params || {}).reduce((acc: any, [k, v]) => {
        if (v !== undefined && v !== null && v !== '') acc[k] = String(v); return acc;
      }, {})
    ).toString();
    return req<any[]>('GET', `/erp/service-orders/movements/history${q ? '?' + q : ''}`);
  },
  financialComplete: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params || {}).reduce((acc: any, [k, v]) => { if (v) acc[k] = String(v); return acc; }, {})
    ).toString();
    return req<{
      periodo: { from: string | null; to: string | null };
      os: any[]; items: any[]; sanitarios: any[]; manutencoes: any[];
      breakdowns: { porStatus: any[]; porModalidade: any[]; porTipoLocacao: any[]; porEmpresa: any[] };
      totais: {
        receitaTotal: number; receitaFechadas: number; receitaAbertas: number;
        receitaEmAtraso: number; custoManutencao: number; resultadoLiquido: number;
        qtdOs: number; qtdManutencoes: number;
      };
    }>('GET', `/erp/service-orders/financial/complete${q ? '?' + q : ''}`);
  },
};
