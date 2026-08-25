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

// ===== Doc settings (numeração)
export type DocKey = 'ORC' | 'OS' | 'CTR' | 'REC' | 'REC_SV' | 'MED';
export interface DocSetting {
  doc: DocKey;
  startNumber: number;
  includeYear: boolean;
  padding: number;
  prefix?: string | null;
}
export interface CompanyDocSetting extends DocSetting {
  hasOverride: boolean;
}
export const docSettingsService = {
  list: () => req<DocSetting[]>('GET', '/erp/doc-settings'),
  update: (doc: string, data: Partial<DocSetting>) =>
    req<{ ok: true }>('PUT', `/erp/doc-settings/${doc}`, data),

  // Numeração por empresa (sem contador global)
  listByCompany: (companyId: string) =>
    req<CompanyDocSetting[]>('GET', `/erp/doc-settings/company/${companyId}`),
  updateByCompany: (companyId: string, doc: string, data: Partial<DocSetting>) =>
    req<{ ok: true }>('PUT', `/erp/doc-settings/company/${companyId}/${doc}`, data),
  resetByCompany: (companyId: string, doc: string) =>
    req<{ ok: true }>('DELETE', `/erp/doc-settings/company/${companyId}/${doc}`),

  // Contador atual (por empresa/doc/ano)
  getCountersByCompany: (companyId: string, ano?: number) =>
    req<Array<{ doc: DocKey; ano: number; ultimo: number; includeYear: boolean }>>(
      'GET', `/erp/doc-settings/company/${companyId}/counters${ano ? `?ano=${ano}` : ''}`),
  setCounterByCompany: (companyId: string, doc: string, proximo: number, ano?: number) =>
    req<{ ok: true; ano: number; ultimo: number; proximo: number }>(
      'PUT', `/erp/doc-settings/company/${companyId}/${doc}/counter`, { proximo, ano }),
};

// ===== Contratos
export interface Contract {
  id: string;
  numero: string;
  companyId?: string;
  customerId?: string;
  osId?: string;
  origem: 'manual' | 'sistema';
  descricao?: string;
  tipoContrato?: 'locacao' | 'evento' | 'obra';
  dataInicio: string;
  /** Mês do 1º faturamento (YYYY-MM, opcional). Antes dele não fatura. */
  primeiraCompetencia?: string | null;
  dataFim?: string | null;
  dataEvento?: string | null;
  dataRecolhimento?: string | null;
  localEvento?: string | null;
  enderecoObra?: string | null;
  cno?: string | null;
  horaEntrega?: string | null;
  valorTotalEvento?: number | null;
  diaVencimento: number;
  valorMensal: number;
  frete?: number | null;

  renovacaoAutomatica: boolean;
  ativo: boolean;
  encerradoEm?: string | null;
  motivoEncerramento?: string | null;
  pdfUrl?: string | null;
  observacoes?: string | null;
  responsavelNome?: string | null;
  responsavelTelefone?: string | null;
  responsavelEmail?: string | null;
  companySnapshot?: any;
  customerSnapshot?: any;
  createdAt: string;
  companyRazaoSocial?: string;
  companyCnpj?: string;
  companyLogoUrl?: string;
  customerName?: string;
  customerDocument?: string;
  osNumero?: string;
}
export const contractsService = {
  list: (params?: { ativo?: boolean; customerId?: string }) => {
    const q = new URLSearchParams();
    if (params?.ativo !== undefined) q.set('ativo', String(params.ativo));
    if (params?.customerId) q.set('customerId', params.customerId);
    const s = q.toString();
    return req<Contract[]>('GET', `/erp/contracts${s ? '?' + s : ''}`);
  },
  /** Variante paginada — envelope `{ data, total, page, pageSize }` com filtros server-side. */
  listPaged: (params?: {
    ativo?: boolean; customerId?: string;
    tipoContrato?: 'locacao' | 'evento' | 'obra';
    companyId?: string;
    search?: string;
    vencendo?: boolean;
  } & PageParams) => {
    const q = new URLSearchParams();
    if (params?.ativo !== undefined) q.set('ativo', String(params.ativo));
    if (params?.customerId) q.set('customerId', params.customerId);
    if (params?.tipoContrato) q.set('tipoContrato', params.tipoContrato);
    if (params?.companyId) q.set('companyId', params.companyId);
    if (params?.search) q.set('search', params.search);
    if (params?.vencendo) q.set('vencendo', 'true');
    appendPageParams(q, params);
    return req<Paged<Contract>>('GET', `/erp/contracts?${q.toString()}`);
  },
  kpis: () => req<{ ativos: number; mrr: number; vencendo: number; encerradosMes: number }>(
    'GET', '/erp/contracts/stats/kpis'),

  get: (id: string) => req<Contract>('GET', `/erp/contracts/${id}`),
  create: (data: Partial<Contract>) => req<{ id: string; numero: string }>('POST', '/erp/contracts', data),
  update: (id: string, data: Partial<Contract>) => req<{ ok: true }>('PUT', `/erp/contracts/${id}`, data),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/contracts/${id}`),
};

// ===== Recibos
export type ReceiptStatus = 'aberto' | 'pago' | 'parcial' | 'cancelado';
export type FormaPagamento = 'pix' | 'dinheiro' | 'boleto' | 'cartao' | 'transferencia' | 'outro';

export interface Receipt {
  id: string;
  numero: string;
  numeroDisplay?: string | null; // quando presente, prevalece na exibição/PDF
  unifiedGroupId?: string | null; // presente somente quando o recibo pertence a um unificado
  semValidade?: boolean;         // recibo sem validade jurídica (controle interno)
  contractId: string;
  competencia: string; // YYYY-MM da cobrança; independente do período exibido
  periodoInicio?: string | null; // YYYY-MM-DD — data inicial exata do período
  periodoFim?: string | null;    // YYYY-MM-DD — data final exata do período
  dataEmissao: string;
  dataVencimento?: string;
  valor: number;
  pago: boolean;
  status: ReceiptStatus;
  formaPagamento?: FormaPagamento | null;
  dataPagamento?: string | null;
  valorPago?: number | null;
  canceladoEm?: string | null;
  motivoCancelamento?: string | null;
  snapshot: any;
  pdfGeradoEm?: string;
  createdAt: string;
  contractNumero?: string;
  diaVencimento?: number;
  valorMensal?: number;
  contractAtivo?: boolean;
  renovacaoAutomatica?: boolean;
  companyRazaoSocial?: string;
  companyCnpj?: string;
  customerName?: string;
  customerDocument?: string;
}
export interface PendingReceipt {
  contractId: string;
  contractNumero: string;
  valorMensal: number;
  diaVencimento: number;
  dataInicio: string;
  renovacaoAutomatica: boolean;
  tipoContrato?: 'locacao' | 'evento' | 'obra';
  companyId?: string;
  customerId?: string;
  companyRazaoSocial?: string;
  companyCnpj?: string;
  customerName?: string;
  customerDocument?: string;
  cno?: string;
  enderecoObra?: string;
  localEvento?: string;
  /** Competência real do item — preenchida no frontend quando meses futuros
   *  são mesclados pela "regra dos 10". Ausente = competência selecionada. */
  competencia?: string;
}
export interface ReceiptsSummaryPoint {
  competencia: string;
  recebido: number;
  aberto: number;
  gasto: number;
  resultado: number;
}
export const receiptsService = {
  list: (params?: {
    contractId?: string;
    competencia?: string;
    pago?: boolean;
    from?: string;
    to?: string;
    semValidade?: boolean;
    unifiedGroupId?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.contractId) q.set('contractId', params.contractId);
    if (params?.competencia) q.set('competencia', params.competencia);
    if (params?.pago !== undefined) q.set('pago', String(params.pago));
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.semValidade !== undefined) q.set('semValidade', String(params.semValidade));
    if (params?.unifiedGroupId) q.set('unifiedGroupId', params.unifiedGroupId);
    const s = q.toString();
    return req<Receipt[]>('GET', `/erp/receipts${s ? '?' + s : ''}`);
  },
  /** Variante paginada — envelope `{ data, total, page, pageSize }` com filtros server-side. */
  listPaged: (params?: {
    contractId?: string; competencia?: string; pago?: boolean;
    from?: string; to?: string;
    status?: ReceiptStatus | 'all';
    companyId?: string;
    search?: string;
    semValidade?: boolean;
    dateBase?: 'emissao' | 'vencimento';
    vencidoAte?: string;   // YYYY-MM-DD — abertos/parciais com venc < esta data
    venceAte?: string;     // YYYY-MM-DD — abertos/parciais com venc <= esta data
  } & PageParams) => {
    const q = new URLSearchParams();
    const p = params || {};
    if (p.contractId) q.set('contractId', p.contractId);
    if (p.competencia) q.set('competencia', p.competencia);
    if (p.pago !== undefined) q.set('pago', String(p.pago));
    if (p.from) q.set('from', p.from);
    if (p.to) q.set('to', p.to);
    if (p.status && p.status !== 'all') q.set('status', p.status);
    if (p.companyId) q.set('companyId', p.companyId);
    if (p.search) q.set('search', p.search);
    if (p.semValidade !== undefined) q.set('semValidade', String(p.semValidade));
    if (p.dateBase) q.set('dateBase', p.dateBase);
    if (p.vencidoAte) q.set('vencidoAte', p.vencidoAte);
    if (p.venceAte) q.set('venceAte', p.venceAte);
    appendPageParams(q, params);
    return req<Paged<Receipt>>('GET', `/erp/receipts?${q.toString()}`);
  },
  /** KPIs agregados server-side (respeita os mesmos filtros da listagem). */
  kpis: (params?: {
    contractId?: string; competencia?: string;
    status?: ReceiptStatus | 'all';
    companyId?: string;
    search?: string;
    semValidade?: boolean;
    dateBase?: 'emissao' | 'vencimento';
    from?: string; to?: string;
  }) => {
    const q = new URLSearchParams();
    const p = params || {};
    if (p.contractId) q.set('contractId', p.contractId);
    if (p.competencia) q.set('competencia', p.competencia);
    if (p.status && p.status !== 'all') q.set('status', p.status);
    if (p.companyId) q.set('companyId', p.companyId);
    if (p.search) q.set('search', p.search);
    if (p.semValidade !== undefined) q.set('semValidade', String(p.semValidade));
    if (p.dateBase) q.set('dateBase', p.dateBase);
    if (p.from) q.set('from', p.from);
    if (p.to) q.set('to', p.to);
    const s = q.toString();
    return req<{
      total: number;
      qtdPagos: number; qtdAbertos: number; qtdParciais: number; qtdCancelados: number;
      qtdVencidos: number;
      recebido: number; aberto: number; vencido: number; totalAtivos: number;
    }>('GET', `/erp/receipts/stats/kpis${s ? '?' + s : ''}`);
  },


  pending: (competencia?: string) =>
    req<{ competencia: string; pendentes: PendingReceipt[] }>(
      'GET', `/erp/receipts/pending${competencia ? '?competencia=' + encodeURIComponent(competencia) : ''}`),
  generate: (body: {
    contractId: string;
    competencia?: string;
    periodoInicio?: string; // YYYY-MM-DD
    periodoFim?: string;    // YYYY-MM-DD
    valor?: number;
    pago?: boolean;
    regerar?: boolean;
    semValidade?: boolean;  // se true, usa contador REC_SV (0001) e não aparece na aba Recibos
    dataVencimento?: string; // YYYY-MM-DD — override manual do vencimento
    cno?: string;
    enderecoObra?: string;
    /** Recibo unificado: reutiliza a MESMA numeração do grupo (não consome novo número). */
    numeroGrupo?: string;
    /** Identidade persistente do grupo; não deve ser enviada em geração individual. */
    unifiedGroupId?: string;
  }) =>
    req<{ ok: true; id: string; numero: string; numeroDisplay?: string | null; unifiedGroupId?: string | null; regerado?: boolean }>('POST', '/erp/receipts/generate', body),
  /** Ajusta manualmente o vencimento de um recibo já emitido. */
  setVencimento: (id: string, dataVencimento: string | null) =>
    req<{ ok: true }>('PATCH', `/erp/receipts/${id}/vencimento`, { dataVencimento }),
  /** Edição ampla de um recibo já emitido (correções manuais). */
  update: (id: string, patch: {
    dataEmissao?: string;
    dataVencimento?: string | null;
    periodoInicio?: string | null;
    periodoFim?: string | null;
    valor?: number;
    numeroDisplay?: string | null;
    competencia?: string;
    cno?: string | null;
    enderecoObra?: string | null;
    descricao?: string | null;
    contratoNumero?: string | null;
    valorLocacao?: number;
    freteIncluso?: number;
    customer?: Record<string, string>;
    company?: Record<string, string>;
  }) =>
    req<{ ok: true }>('PATCH', `/erp/receipts/${id}`, patch),
  remove: (id: string, force = false) =>
    req<{ ok: true }>('DELETE', `/erp/receipts/${id}${force ? '?force=1' : ''}`),
  cancel: (id: string, motivo: string) =>
    req<{ ok: true; affected: number; unified: boolean }>('POST', `/erp/receipts/${id}/cancel`, { motivo }),
  reopen: (id: string) =>
    req<{ ok: true; affected: number; unified: boolean }>('POST', `/erp/receipts/${id}/reopen`),
  summary: (months = 12) =>
    req<{ series: ReceiptsSummaryPoint[] }>('GET', `/erp/receipts/summary?months=${months}`),
};

// ===== Gastos
export interface Expense {
  id: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  fornecedor?: string;
  notaFiscal?: string;
  anexoUrl?: string;
  observacoes?: string;
  origem?: 'manual' | 'manutencao';
  createdAt?: string;
}
export interface ExpenseListParams {
  from?: string; to?: string; categoria?: string;
  origem?: 'manual' | 'manutencao' | 'all';
  search?: string; fornecedor?: string;
}
function buildExpenseQuery(params?: ExpenseListParams) {
  const q = new URLSearchParams();
  if (params?.from)       q.set('from', params.from);
  if (params?.to)         q.set('to', params.to);
  if (params?.categoria)  q.set('categoria', params.categoria);
  if (params?.origem && params.origem !== 'all') q.set('origem', params.origem);
  if (params?.search)     q.set('search', params.search);
  if (params?.fornecedor) q.set('fornecedor', params.fornecedor);
  return q;
}
export const expensesService = {
  list: (params?: ExpenseListParams) => {
    const s = buildExpenseQuery(params).toString();
    return req<Expense[]>('GET', `/erp/expenses${s ? '?' + s : ''}`);
  },
  /** Variante paginada — passa `page`/`pageSize` para receber { data, total, page, pageSize }. */
  listPaged: (params?: ExpenseListParams & PageParams) => {
    const q = buildExpenseQuery(params);
    appendPageParams(q, params);
    return req<Paged<Expense>>('GET', `/erp/expenses?${q.toString()}`);
  },
  /** KPIs agregados server-side (respeitam os filtros). */
  kpis: (params?: ExpenseListParams) => {
    const s = buildExpenseQuery(params).toString();
    return req<{
      total: number; totalValor: number;
      qtdManual: number; qtdManutencao: number;
      totalManual: number; totalManutencao: number;
    }>('GET', `/erp/expenses/stats/kpis${s ? '?' + s : ''}`);
  },
  create: (data: Partial<Expense>) => req<Expense>('POST', '/erp/expenses', data),
  update: (id: string, data: Partial<Expense>) => req<{ ok: true }>('PUT', `/erp/expenses/${id}`, data),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/expenses/${id}`),
};

// ===== Categorias de gastos (dinâmicas)
export interface ExpenseCategory {
  id: string;
  key: string;
  label: string;
  color?: string | null;
  ativo: boolean;
  ordem: number;
}
export const expenseCategoriesService = {
  list: () => req<ExpenseCategory[]>('GET', '/erp/expense-categories'),
  create: (data: { key?: string; label: string; color?: string; ordem?: number }) =>
    req<ExpenseCategory>('POST', '/erp/expense-categories', data),
  update: (id: string, data: Partial<ExpenseCategory>) =>
    req<{ ok: true }>('PUT', `/erp/expense-categories/${id}`, data),
  remove: (id: string) => req<{ ok: true; inactivated?: boolean }>('DELETE', `/erp/expense-categories/${id}`),
};

// ===== Gastos recorrentes
export interface RecurringExpense {
  id: string;
  categoria: string;
  descricao: string;
  valor: number;
  diaMes: number;
  fornecedor?: string | null;
  observacoes?: string | null;
  ativo: boolean;
  lastGeneratedCompetencia?: string | null;
  createdAt?: string;
}
export const recurringExpensesService = {
  list: () => req<RecurringExpense[]>('GET', '/erp/recurring-expenses'),
  create: (data: Partial<RecurringExpense>) =>
    req<RecurringExpense>('POST', '/erp/recurring-expenses', data),
  update: (id: string, data: Partial<RecurringExpense>) =>
    req<{ ok: true }>('PUT', `/erp/recurring-expenses/${id}`, data),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/recurring-expenses/${id}`),
  run: (competencia?: string) =>
    req<{ ok: true; competencia: string; geradas: number; totalAtivas: number }>(
      'POST', `/erp/recurring-expenses/run${competencia ? '?competencia=' + competencia : ''}`),
};

// ===== Mark receipt paid / unpaid (with rich payment info)
export const receiptsExtraService = {
  markPaid: async (contractId: string, competencia: string, valor?: number) =>
    receiptsService.generate({ contractId, competencia, valor, pago: true }),
  togglePaid: async (
    receiptId: string,
    pago: boolean,
    extra?: { formaPagamento?: FormaPagamento; dataPagamento?: string; valorPago?: number }
  ) => {
    const r = await fetch(`${API_BASE_URL}/erp/receipts/${receiptId}/pago`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ pago, ...(extra || {}) }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erro');
    return r.json();
  },
};
