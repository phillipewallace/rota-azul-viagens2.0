/**
 * ERP · Financeiro — Pendentes / Recibos / Gastos / Recorrências.
 * - Recibos: forma de pagamento, baixa parcial, cancelamento auditável, atalhos.
 * - Gastos: categorias dinâmicas + recorrências mensais materializáveis.
 * - Visão gerencial: KPIs + gráfico 12 meses (receita × gasto × resultado).
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { VirtualRows } from '@/components/erp/VirtualRows';
import {
  DollarSign, Loader2, Download, RefreshCw, Receipt as ReceiptIcon,
  CalendarDays, CheckCircle2, AlertCircle, Filter, Plus, Trash2, Wrench,
  TrendingDown, TrendingUp, Search, AlertTriangle, Pencil, MoreVertical,
  XCircle, Repeat, Tag, PlayCircle, BarChart3, FileSpreadsheet, Users2, TimerOff, X, Eye, Copy,
  FileText, ExternalLink,
} from 'lucide-react';
import { ContractViewDialog } from '@/components/erp/ContractViewDialog';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  receiptsService, type Receipt, type PendingReceipt, type FormaPagamento, type ReceiptsSummaryPoint,
  receiptsExtraService,
  expensesService, type Expense,
  expenseCategoriesService, type ExpenseCategory,
  recurringExpensesService, type RecurringExpense,
  contractsService,
} from '@/services/contracts';
import { erpService, type ErpCompany } from '@/services/erp';
import { uploadSignedPdf } from '@/services/erp';
import {
  invoicesService, INVOICE_FORMA_LABEL,
  type Invoice, type InvoiceFormaPagamento, type InvoiceStatus,
} from '@/services/invoices';
import { VincularNfDialog } from '@/components/erp/VincularNfDialog';
import { medicoesService, type Medicao } from '@/services/medicoes';
import { MedicaoDialog } from '@/components/erp/MedicaoDialog';
import { MedicaoViewDialog } from '@/components/erp/MedicaoViewDialog';
import { toAbsoluteUrl, toAuthedUrl } from '@/utils/absoluteUrl';
import { 
  generateReceiptPdf, 
  generateUnifiedReceiptPdf,
  type UnifiedReceiptInput 
} from '@/utils/receiptPdf';
import { generateMedicaoPdf } from '@/utils/medicaoPdf';
import { formatDateBR, formatPeriodo } from '@/utils/dateFormat';
import { pendingReceiptKey, removeGeneratedPending } from '@/utils/pendingReceiptState';

import { confirmDialog } from '@/lib/confirm';
// ========================= helpers =========================
import { BRL } from '@/utils/currency';
import PaginationBar from '@/components/PaginationBar';
import { downloadCsv } from '@/utils/exporters';

const D = (s?: string) => s ? formatDateBR(s) : '—';

// PDF não deve exibir carimbo/selo de pagamento. Para evitar que qualquer
// lógica visual antiga baseada em `pago/status` volte a desenhar o círculo
// verde "PAGO", o recibo é sanitizado apenas na hora de gerar o PDF.
const receiptForPdf = (r: Receipt): Receipt => ({
  ...r,
  pago: false,
  status: r.status === 'cancelado' ? 'cancelado' : 'aberto',
  valorPago: null,
});

const compAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const formatComp = (c: string) => {
  const [a, m] = (c || '').split('-');
  const meses = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return m ? `${meses[Number(m)]}/${a}` : c;
};
// Enumera competências YYYY-MM entre `from` e `to` inclusive. Retorna [] se inválido.
const enumerateComps = (from: string, to: string): string[] => {
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) return [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const start = fy * 12 + (fm - 1);
  const end = ty * 12 + (tm - 1);
  if (end < start) return [];
  if (end - start > 60) return []; // guarda: no máx 5 anos
  const out: string[] = [];
  for (let i = start; i <= end; i++) {
    const y = Math.floor(i / 12);
    const m = (i % 12) + 1;
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
};
const diffDays = (a: string, b: string) => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
};

// Próximo vencimento: dia X do MÊS SEGUINTE à competência (clamp para o último dia do mês).
const nextDueDate = (competencia: string, diaVencimento: number): string => {
  const [y, m] = (competencia || '').split('-').map(Number);
  if (!y || !m) return '';
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const ult = new Date(nextY, nextM, 0).getDate();
  const dia = Math.min(Math.max(1, Number(diaVencimento || 10)), ult);
  return `${nextY}-${String(nextM).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

// Vencimento efetivo DENTRO da própria competência (dia X do mês da comp,
// clamp para o último dia do mês). Usado pelos filtros da aba Pendentes.
const dueDateInComp = (competencia: string, diaVencimento: number): string => {
  const [y, m] = (competencia || '').split('-').map(Number);
  if (!y || !m) return '';
  const ult = new Date(y, m, 0).getDate();
  const dia = Math.min(Math.max(1, Number(diaVencimento || 10)), ult);
  return `${y}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

// Calcula o período (30 dias) do recibo baseado no dia do contrato e na
// competência mensal escolhida no topo do Financeiro. Se o dia do contrato
// não existir no mês (ex.: 31 em fev.), usa o último dia válido daquele mês.
const computeCompetenciaPeriodo = (
  dataInicioContrato?: string | null,
  competencia?: string,
): { inicio: string; fim: string } => {
  const comp = competencia || '';
  const [y, m] = comp.split('-').map(Number);
  if (!y || !m) {
    const t = todayISO();
    return { inicio: t, fim: addDaysISO(t, 30) };
  }
  const baseDay = dataInicioContrato
    ? Number(String(dataInicioContrato).slice(8, 10)) || 1
    : 1;
  const ultDia = new Date(y, m, 0).getDate();
  const dia = Math.min(Math.max(1, baseDay), ultDia);
  const inicio = `${y}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return { inicio, fim: addDaysISO(inicio, 30) };
};

const FORMA_LABEL: Record<FormaPagamento, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', boleto: 'Boleto',
  cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro',
};

type DateBase = 'emissao' | 'vencimento';
type QuickFilter = 'none' | 'vencidos' | 'em7';

// ========================= main =========================
const ErpFinanceiro: React.FC = () => {
  const [competencia, setCompetencia] = useState(compAtual());
  const [pendentes, setPendentes] = useState<PendingReceipt[]>([]);
  const [recibos, setRecibos] = useState<Receipt[]>([]);
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [summary, setSummary] = useState<ReceiptsSummaryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendentesLoading, setPendentesLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  // Paginação server-side dos recibos
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRecibos, setTotalRecibos] = useState(0);
  // KPIs agregados no servidor (respeitam filtros; independe da página)
  const [kpisRecibos, setKpisRecibos] = useState<{
    total: number; qtdPagos: number; qtdAbertos: number; qtdParciais: number;
    qtdCancelados: number; qtdVencidos: number;
    recebido: number; aberto: number; vencido: number; totalAtivos: number;
  } | null>(null);

  // filtros
  const [filterStatus, setFilterStatus] = useState<'all' | 'pago' | 'aberto' | 'parcial' | 'cancelado'>('all');
  const [filterCompanyId, setFilterCompanyId] = useState<string>('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [dateBase, setDateBase] = useState<DateBase>('emissao');
  const [quick, setQuick] = useState<QuickFilter>('none');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce da busca (350ms) — usado no filtro server-side E no client-side.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // seleção lote (pendentes) e (recibos)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedRecibos, setSelectedRecibos] = useState<Set<string>>(new Set());
  const [batchWorking, setBatchWorking] = useState(false);
  const [activeTab, setActiveTab] = useState<'pendentes' | 'pagos' | 'emitidos' | 'sem-validade' | 'notas' | 'medicoes' | 'clientes' | 'gastos'>('pendentes');

  useEffect(() => {
    logger.info(`Navegou para aba financeira: ${activeTab.toUpperCase()}`);
  }, [activeTab]);


  // Notas Fiscais (vinculação de NF do portal do governo)
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [nfDialogTarget, setNfDialogTarget] = useState<PendingReceipt | null>(null);
  const [nfSearch, setNfSearch] = useState('');
  const [debouncedNfSearch, setDebouncedNfSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedNfSearch(nfSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [nfSearch]);
  const [nfStatus, setNfStatus] = useState<'all' | InvoiceStatus>('all');
  const [nfForma, setNfForma] = useState<'all' | InvoiceFormaPagamento>('all');
  const [nfCompanyId, setNfCompanyId] = useState<string>('all');
  const [nfFrom, setNfFrom] = useState('');
  const [nfTo, setNfTo] = useState('');
  const [nfPage, setNfPage] = useState(1);
  const [nfPageSize, setNfPageSize] = useState(50);
  const [nfTotal, setNfTotal] = useState(0);
  const [nfKpis, setNfKpis] = useState<{
    total: number; qtdAtivas: number; qtdCanceladas: number;
    totalAtivo: number; ticketMedio: number;
  } | null>(null);
  const [nfExportBusy, setNfExportBusy] = useState(false);
  const [nfCancelTarget, setNfCancelTarget] = useState<Invoice | null>(null);
  const [nfCancelMotivo, setNfCancelMotivo] = useState('');

  // Medições (aba nova) — proposta de faturamento (pré-recibo)
  const [medicoes, setMedicoes] = useState<import('@/services/medicoes').Medicao[]>([]);
  const [medicoesLoading, setMedicoesLoading] = useState(false);
  const [medicaoDialogOpen, setMedicaoDialogOpen] = useState(false);
  const [medicaoEditing, setMedicaoEditing] = useState<import('@/services/medicoes').Medicao | null>(null);
  const [medicaoViewId, setMedicaoViewId] = useState<string | null>(null);
  const [medicaoViewOpen, setMedicaoViewOpen] = useState(false);
  const [medicoesSearch, setMedicoesSearch] = useState('');
  const [debouncedMedSearch, setDebouncedMedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMedSearch(medicoesSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [medicoesSearch]);
  const [medPage, setMedPage] = useState(1);
  const [medPageSize, setMedPageSize] = useState(50);
  const [medTotal, setMedTotal] = useState(0);
  const [medKpis, setMedKpis] = useState<{
    total: number; totalValor: number; ticketMedio: number; clientesDistintos: number;
  } | null>(null);
  const [medExportBusy, setMedExportBusy] = useState(false);
  const [medicoesPrevMonthTotal, setMedicoesPrevMonthTotal] = useState<number | null>(null);
  // popover do recibo unificado
  const [unifOpen, setUnifOpen] = useState(false);
  const [unifIni, setUnifIni] = useState('');
  const [unifFim, setUnifFim] = useState('');
  const [batchCancelOpen, setBatchCancelOpen] = useState(false);
  const [batchCancelMotivo, setBatchCancelMotivo] = useState('');

  // refs para scroll-parents das tabelas virtualizadas
  const pendentesScrollRef = useRef<HTMLDivElement>(null);
  const recibosScrollRef = useRef<HTMLDivElement>(null);

  // diálogos
  const [payDialog, setPayDialog] = useState<Receipt | null>(null);
  const [cancelDialog, setCancelDialog] = useState<Receipt | null>(null);
  const [reabrirDialog, setReabrirDialog] = useState<Receipt | null>(null);
  const [editVencDialog, setEditVencDialog] = useState<Receipt | null>(null);

  // visualização de contrato (somente leitura) — acessível de qualquer linha
  const [viewContractId, setViewContractId] = useState<string | null>(null);

  // exportação em ZIP por período
  const [zipOpen, setZipOpen] = useState(false);
  const [zipFrom, setZipFrom] = useState('');
  const [zipTo, setZipTo] = useState('');
  const [zipIncludeSV, setZipIncludeSV] = useState(true);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

  // filtros da aba Pendentes (client-side, 100% local)
  const [pendSearch, setPendSearch] = useState('');
  const [pendCompanyId, setPendCompanyId] = useState<string>('all');
  const [pendVencFrom, setPendVencFrom] = useState('');
  const [pendVencTo, setPendVencTo] = useState('');
  const [pendQuick, setPendQuick] = useState<'none' | 'vencidos' | 'em7'>('none');



  

  // gastos do mês para resultado
  const [gastosMes, setGastosMes] = useState(0);

  // Guarda contra setState após unmount / troca de competência
  const mountedRef = useRef(true);
  const pendentesRequestRef = useRef(0);
  const previousActiveTabRef = useRef(activeTab);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Loads separados: pendentes NÃO dependem dos filtros da aba Recibos.
  // Isso evita que mexer em filtro de Recibos re-baixe (e às vezes zere) a lista
  // de Pendentes ao voltar para essa sub-aba.
  const [mergedComps, setMergedComps] = useState<string[]>([]);

  /** Competência do mês seguinte (YYYY-MM). */
  const nextComp = (c: string) => {
    const [y, m] = c.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  /** Competência real do pendente (regra dos 10 pode mesclar meses futuros). */
  const compOf = (p: PendingReceipt) => p.competencia || competencia;
  /** Identidade do pendente: um contrato recorrente pode aparecer em mais de um mês. */
  const pendingKey = (p: PendingReceipt) => pendingReceiptKey(p, competencia);

  /** Confirmação otimista: o item emitido desaparece sem esperar a recarga. */
  const acknowledgeGenerated = useCallback((contractId: string, comp: string) => {
    const key = `${contractId}:${comp}`;
    setPendentes(prev => removeGeneratedPending(prev, contractId, comp, competencia));
    setSelected(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, [competencia]);

  const loadPendentes = useCallback(async () => {
    const requestId = ++pendentesRequestRef.current;
    setPendentesLoading(true);
    try {
      // REGRA DOS 10: quando restam 10 ou menos cobranças pendentes na
      // competência selecionada, o mês seguinte é liberado automaticamente.
      // Em cadeia: se o mês seguinte também ficar com ≤10, libera o próximo
      // (trava de segurança: no máximo 3 meses à frente).
      const merged: PendingReceipt[] = [];
      const extras: string[] = [];
      let comp = competencia;
      for (let depth = 0; depth < 3; depth++) {
        const resp = await receiptsService.pending(comp);
        if (!mountedRef.current || requestId !== pendentesRequestRef.current) return;

        // REGRA DE EVENTO: Se for tipo 'evento', não permite mesclar meses futuros.
        // O faturamento de eventos deve ocorrer exatamente no mês em questão.
        const validPendentes = depth === 0 
          ? resp.pendentes 
          : resp.pendentes.filter(p => p.tipoContrato !== 'evento');

        merged.push(...validPendentes.map(x => ({ ...x, competencia: comp })));
        
        // Se após filtrar sobraram itens de evento que foram barrados, ou se a lista
        // original já era grande, paramos a recursão.
        if (resp.pendentes.length > 10 || depth === 2) break;
        
        comp = nextComp(comp);
        extras.push(comp);
      }
      setPendentes(merged);
      setMergedComps(extras);
      setSelected(prev => {
        if (prev.size === 0) return prev;
        const valid = new Set(merged.map(item => `${item.contractId}:${item.competencia || competencia}`));
        const next = new Set(Array.from(prev).filter(id => valid.has(id)));
        return next.size === prev.size ? prev : next;
      });
    } catch (e: any) {
      if (mountedRef.current && requestId === pendentesRequestRef.current) toast.error(e.message);
    } finally {
      if (mountedRef.current && requestId === pendentesRequestRef.current) setPendentesLoading(false);
    }
  }, [competencia]);

  /**
   * Filtros server-side aplicados atualmente à listagem de recibos.
   * Reaproveitado por `loadRecibos`, `kpis` e pelas exportações
   * "de todo o dataset filtrado" (CSV/ZIP).
   */
  const recibosBaseFilters = useMemo(() => {
    const usaRange = !!(filterFrom || filterTo);
    const semValidadeParam: boolean | undefined =
      activeTab === 'sem-validade' ? true
      : (activeTab === 'emitidos' || activeTab === 'pagos') ? false
      : undefined;
    const statusParam = activeTab === 'pagos'
      ? undefined
      : (filterStatus !== 'all' ? filterStatus : undefined);
    // Na aba "Sem validade" NÃO limitamos pela competência do topo: recibos SV
    // emitidos com período de outro mês ficavam invisíveis (mas bloqueavam a
    // reemissão). Só filtra por data quando o usuário define um range explícito.
    const escopoData = usaRange
      ? { from: filterFrom || undefined, to: filterTo || undefined }
      : (activeTab === 'sem-validade' ? {} : { competencia });
    return {
      ...escopoData,
      status: statusParam,
      companyId: filterCompanyId !== 'all' ? filterCompanyId : undefined,
      semValidade: semValidadeParam,
      dateBase,
      search: debouncedSearch || undefined,
    } as const;
  }, [competencia, filterFrom, filterTo, filterStatus, filterCompanyId,
      dateBase, debouncedSearch, activeTab]);


  const loadRecibos = useCallback(async () => {
    setLoading(true);
    try {
      const [pg, k] = await Promise.all([
        receiptsService.listPaged({ ...recibosBaseFilters, page, pageSize }),
        receiptsService.kpis(recibosBaseFilters),
      ]);
      if (!mountedRef.current) return;
      setRecibos(pg.data);
      setTotalRecibos(pg.total);
      setKpisRecibos(k);
    } catch (e: any) { if (mountedRef.current) toast.error(e.message); }
    finally { if (mountedRef.current) setLoading(false); }
  }, [recibosBaseFilters, page, pageSize]);

  /**
   * Busca TODOS os recibos que casam com os filtros server-side atuais,
   * paginando em blocos de 200. Usado pelos botões "Exportar CSV/ZIP (filtro)".
   * Aborta e devolve `null` se o total exceder `hardLimit` (proteção).
   */
  const fetchAllFilteredRecibos = useCallback(async (
    hardLimit = 5000,
  ): Promise<Receipt[] | null> => {
    const PAGE = 200;
    const first = await receiptsService.listPaged({ ...recibosBaseFilters, page: 1, pageSize: PAGE });
    if (first.total > hardLimit) {
      toast.error(`Muitos recibos (${first.total}). Refine os filtros — limite ${hardLimit}.`);
      return null;
    }
    const all: Receipt[] = [...first.data];
    const totalPages = Math.max(1, Math.ceil(first.total / PAGE));
    for (let p = 2; p <= totalPages; p++) {
      const pg = await receiptsService.listPaged({ ...recibosBaseFilters, page: p, pageSize: PAGE });
      all.push(...pg.data);
    }
    return all;
  }, [recibosBaseFilters]);

  // Reset da página quando qualquer filtro muda
  useEffect(() => {
    setPage(1);
  }, [competencia, filterFrom, filterTo, filterStatus, filterCompanyId, dateBase,
      debouncedSearch, pageSize, activeTab]);

  // Conveniência: recarrega tudo (usada pelo botão Atualizar e após ações).
  const load = useCallback(async () => {
    // loadInvoices tem seu próprio useEffect; recarrega automaticamente
    // quando a competência muda ou quando chamado via onSuccess do dialog.
    await Promise.all([loadPendentes(), loadRecibos()]);
  }, [loadPendentes, loadRecibos]);

  useEffect(() => { loadPendentes(); }, [loadPendentes]);
  useEffect(() => { loadRecibos(); }, [loadRecibos]);
  useEffect(() => {
    const previous = previousActiveTabRef.current;
    previousActiveTabRef.current = activeTab;
    if (activeTab === 'pendentes' && previous !== 'pendentes') void loadPendentes();
  }, [activeTab, loadPendentes]);


  // Filtros server-side das Medições.
  const medBaseFilters = useMemo(() => ({
    competencia,
    search: debouncedMedSearch || undefined,
  }), [competencia, debouncedMedSearch]);

  const loadMedicoes = useCallback(async () => {
    setMedicoesLoading(true);
    try {
      const [pg, k] = await Promise.all([
        medicoesService.listPaged({ ...medBaseFilters, page: medPage, pageSize: medPageSize }),
        medicoesService.kpis(medBaseFilters),
      ]);
      if (!mountedRef.current) return;
      setMedicoes(pg.data);
      setMedTotal(pg.total);
      setMedKpis(k);
    } catch (e: any) { if (mountedRef.current) toast.error(e.message); }
    finally { if (mountedRef.current) setMedicoesLoading(false); }
  }, [medBaseFilters, medPage, medPageSize]);
  useEffect(() => { loadMedicoes(); }, [loadMedicoes]);
  useEffect(() => { setMedPage(1); }, [medBaseFilters, medPageSize]);

  /** Baixa TODAS as medições do filtro atual (paginando em blocos de 200). */
  const fetchAllFilteredMedicoes = useCallback(async (hardLimit = 5000) => {
    const PAGE = 200;
    const first = await medicoesService.listPaged({ ...medBaseFilters, page: 1, pageSize: PAGE });
    if (first.total > hardLimit) {
      toast.error(`Muitas medições (${first.total}). Refine os filtros — limite ${hardLimit}.`);
      return null;
    }
    const all = [...first.data];
    const totalPages = Math.max(1, Math.ceil(first.total / PAGE));
    for (let p = 2; p <= totalPages; p++) {
      const pg = await medicoesService.listPaged({ ...medBaseFilters, page: p, pageSize: PAGE });
      all.push(...pg.data);
    }
    return all;
  }, [medBaseFilters]);

  const exportAllFilteredMedicoesCsv = useCallback(async () => {
    setMedExportBusy(true);
    try {
      const all = await fetchAllFilteredMedicoes();
      if (!all) return;
      const headers = ['Número','Cliente','Documento','Empresa','Competência','Período início','Período fim','Itens','Total'];
      const rows = all.map(m => [
        m.numero, m.customerName || m.clienteNome || '',
        m.customerDocument || m.clienteDocumento || '',
        m.companyRazaoSocial || '', m.competencia || '',
        m.periodoInicio || '', m.periodoFim || '',
        String(m.itensCount ?? ''),
        Number(m.total || 0).toFixed(2).replace('.', ','),
      ]);
      downloadCsv(`medicoes-${competencia}`, headers, rows);
      toast.success(`CSV exportado (${all.length} medições).`);
    } catch (e: any) { toast.error(e.message || 'Falha ao exportar CSV.'); }
    finally { setMedExportBusy(false); }
  }, [fetchAllFilteredMedicoes, competencia]);

  // Filtros server-side das Notas Fiscais (sem paginação).
  const nfBaseFilters = useMemo(() => {
    const usaRange = !!(nfFrom || nfTo);
    return {
      ...(usaRange ? { from: nfFrom || undefined, to: nfTo || undefined }
                   : { competencia }),
      status:         nfStatus !== 'all' ? nfStatus : undefined,
      formaPagamento: nfForma !== 'all' ? nfForma : undefined,
      companyId:      nfCompanyId !== 'all' ? nfCompanyId : undefined,
      search:         debouncedNfSearch || undefined,
    } as const;
  }, [competencia, nfFrom, nfTo, nfStatus, nfForma, nfCompanyId, debouncedNfSearch]);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const [pg, k] = await Promise.all([
        invoicesService.listPaged({ ...nfBaseFilters, page: nfPage, pageSize: nfPageSize }),
        invoicesService.kpis(nfBaseFilters),
      ]);
      if (!mountedRef.current) return;
      setInvoices(pg.data);
      setNfTotal(pg.total);
      setNfKpis(k);
    } catch (e: any) { if (mountedRef.current) toast.error(e.message); }
    finally { if (mountedRef.current) setInvoicesLoading(false); }
  }, [nfBaseFilters, nfPage, nfPageSize]);
  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // Reset da página das NFs quando qualquer filtro muda.
  useEffect(() => { setNfPage(1); }, [nfBaseFilters, nfPageSize]);

  /** Baixa TODAS as NFs do filtro atual (paginando em blocos de 200). */
  const fetchAllFilteredInvoices = useCallback(async (hardLimit = 5000): Promise<Invoice[] | null> => {
    const PAGE = 200;
    const first = await invoicesService.listPaged({ ...nfBaseFilters, page: 1, pageSize: PAGE });
    if (first.total > hardLimit) {
      toast.error(`Muitas notas fiscais (${first.total}). Refine os filtros — limite ${hardLimit}.`);
      return null;
    }
    const all: Invoice[] = [...first.data];
    const totalPages = Math.max(1, Math.ceil(first.total / PAGE));
    for (let p = 2; p <= totalPages; p++) {
      const pg = await invoicesService.listPaged({ ...nfBaseFilters, page: p, pageSize: PAGE });
      all.push(...pg.data);
    }
    return all;
  }, [nfBaseFilters]);

  const exportAllFilteredNfCsv = useCallback(async () => {
    setNfExportBusy(true);
    try {
      const all = await fetchAllFilteredInvoices();
      if (!all) return;
      const headers = ['Número','Série','Cliente','Contrato','Empresa','Emissão','Competência','Forma pgto.','Valor','Status'];
      const rows = all.map(i => [
        i.numero, i.serie || '', i.customerName || '', i.contractNumero || '',
        i.companyRazaoSocial || '', i.dataEmissao, i.competencia,
        i.formaPagamento ? INVOICE_FORMA_LABEL[i.formaPagamento] : '',
        Number(i.valor).toFixed(2).replace('.', ','), i.status,
      ]);
      downloadCsv(`notas-fiscais-${competencia}`, headers, rows);
      toast.success(`CSV exportado (${all.length} NFs).`);
    } catch (e: any) { toast.error(e.message || 'Falha ao exportar CSV.'); }
    finally { setNfExportBusy(false); }
  }, [fetchAllFilteredInvoices, competencia]);




  // Total do mês anterior (para delta no KPI)
  useEffect(() => {
    const [y, m] = (competencia || '').split('-').map(Number);
    if (!y || !m) { setMedicoesPrevMonthTotal(null); return; }
    const prevY = m === 1 ? y - 1 : y;
    const prevM = m === 1 ? 12 : m - 1;
    const prevComp = `${prevY}-${String(prevM).padStart(2, '0')}`;
    medicoesService.list({ competencia: prevComp })
      .then((r) => setMedicoesPrevMonthTotal(r.reduce((s, x) => s + Number(x.total || 0), 0)))
      .catch(() => setMedicoesPrevMonthTotal(null));
  }, [competencia]);


  useEffect(() => {
    let cancelled = false;
    erpService.listCompanies()
      .then(c => { if (!cancelled) setCompanies(c); })
      .catch(() => {});
    receiptsService.summary(12)
      .then(r => { if (!cancelled) setSummary(r.series); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const [y, m] = competencia.split('-').map(Number);
    if (!y || !m) return;
    const ult = new Date(y, m, 0).getDate();
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const to   = `${y}-${String(m).padStart(2, '0')}-${String(ult).padStart(2, '0')}`;
    expensesService.list({ from, to, origem: 'all' })
      .then(list => { if (!cancelled) setGastosMes(list.reduce((a, e) => a + Number(e.valor || 0), 0)); })
      .catch(() => { if (!cancelled) setGastosMes(0); });
    return () => { cancelled = true; };
  }, [competencia, recibos]);

  const today = todayISO();

  const recibosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const venceAte = quick === 'em7' ? addDaysISO(today, 7) : null;
    return recibos.filter(r => {
      if (r.semValidade) return false; // aba própria "Sem validade"
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterCompanyId !== 'all') {
        const target = companies.find(c => c.id === filterCompanyId)?.razaoSocial?.toLowerCase() || '';
        if (!(r.companyRazaoSocial || '').toLowerCase().includes(target)) return false;
      }
      const dataRef = (dateBase === 'vencimento' ? r.dataVencimento : r.dataEmissao) || '';
      if (filterFrom && dataRef < filterFrom) return false;
      if (filterTo   && dataRef > filterTo)   return false;
      if (quick === 'vencidos') {
        if (r.status !== 'aberto' && r.status !== 'parcial') return false;
        if (!r.dataVencimento || r.dataVencimento >= today) return false;
      }
      if (quick === 'em7') {
        if (r.status !== 'aberto' && r.status !== 'parcial') return false;
        if (!r.dataVencimento) return false;
        if (r.dataVencimento < today || r.dataVencimento > venceAte!) return false;
      }
      if (term) {
        const hay = `${r.numero} ${r.contractNumero || ''} ${r.customerName || ''} ${r.companyRazaoSocial || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [recibos, filterStatus, filterCompanyId, filterFrom, filterTo, quick, search, dateBase, companies, today]);

  const totals = useMemo(() => {
    // Prefere KPIs agregados no servidor (corretos sobre TODO o dataset filtrado,
    // não apenas a página atual). Se ainda não carregou, cai para 0.
    const recebido = kpisRecibos?.recebido ?? 0;
    const aberto   = kpisRecibos?.aberto ?? 0;
    const vencidos = kpisRecibos?.vencido ?? 0;
    const vencidosCount = kpisRecibos?.qtdVencidos ?? 0;
    const pendente = pendentes.filter(p => compOf(p) === competencia).reduce((a, p) => a + Number(p.valorMensal || 0), 0);
    const previsto = recebido + aberto + pendente;
    const inadimp  = previsto > 0 ? (aberto + pendente) / previsto * 100 : 0;
    const ativosCount = kpisRecibos ? Math.max(0, kpisRecibos.total - kpisRecibos.qtdCancelados) : 0;
    const ticket = ativosCount > 0 ? (kpisRecibos!.totalAtivos / ativosCount) : 0;
    return {
      recebido, aberto, pendente, total: previsto, inadimp, ticket,
      vencidos, vencidosCount,
      resultado: recebido - gastosMes,
    };
  }, [kpisRecibos, pendentes, gastosMes]);


  // Ranking por cliente (usa recibos filtrados; ignora cancelados)
  const perCustomer = useMemo(() => {
    const map = new Map<string, {
      name: string; recebido: number; aberto: number; vencido: number; total: number; count: number;
    }>();
    recibosFiltrados.forEach(r => {
      if (r.status === 'cancelado') return;
      const key = r.customerName || '— sem cliente —';
      const cur = map.get(key) || { name: key, recebido: 0, aberto: 0, vencido: 0, total: 0, count: 0 };
      cur.count++;
      cur.total += Number(r.valor || 0);
      if (r.status === 'pago' || r.status === 'parcial') {
        cur.recebido += Number(r.valorPago ?? (r.status === 'pago' ? r.valor : 0) ?? 0);
      }
      if (r.status === 'aberto' || r.status === 'parcial') {
        const rest = Math.max(0, Number(r.valor || 0) - Number(r.valorPago || 0));
        cur.aberto += rest;
        if (r.dataVencimento && r.dataVencimento < today) cur.vencido += rest;
      }
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [recibosFiltrados, today]);

  // Pagos do mês: apenas competência atual selecionada, status pago/parcial.
  // Dedup por contrato mantendo o mais recente (por dataPagamento/emissao).
  const pagosDoMes = useMemo(() => {
    const dentro = recibos.filter(r =>
      !r.semValidade &&
      r.competencia === competencia &&
      (r.status === 'pago' || r.status === 'parcial'),
    );
    const byContract = new Map<string, Receipt>();
    for (const r of dentro) {
      const cur = byContract.get(r.contractId);
      const rk = r.dataPagamento || r.dataEmissao || '';
      const ck = cur ? (cur.dataPagamento || cur.dataEmissao || '') : '';
      if (!cur || rk > ck) byContract.set(r.contractId, r);
    }
    return Array.from(byContract.values()).sort((a, b) => {
      const av = nextDueDate(competencia, Number(a.diaVencimento || 10));
      const bv = nextDueDate(competencia, Number(b.diaVencimento || 10));
      return av.localeCompare(bv);
    });
  }, [recibos, competencia]);

  const pagosKpis = useMemo(() => {
    const totalRecebido = pagosDoMes.reduce(
      (s, r) => s + Number(r.valorPago ?? (r.status === 'pago' ? r.valor : 0) ?? 0), 0);
    const ticket = pagosDoMes.length ? totalRecebido / pagosDoMes.length : 0;
    const em7 = pagosDoMes.filter(r => {
      const nd = nextDueDate(competencia, Number(r.diaVencimento || 10));
      if (!nd) return false;
      const d = diffDays(nd, today);
      return d >= 0 && d <= 7;
    }).length;
    return { totalRecebido, ticket, em7, count: pagosDoMes.length };
  }, [pagosDoMes, competencia, today]);

  // Recibos "sem validade jurídica" — controle interno, numeração própria (0001…).
  // Segue o fluxo normal (removem contrato de Pendentes; retornam no próximo mês).
  const recibosSemValidade = useMemo(() => {
    const term = search.trim().toLowerCase();
    return recibos
      .filter(r => r.semValidade)
      .filter(r => {
        if (filterStatus !== 'all' && r.status !== filterStatus) return false;
        if (!term) return true;
        const hay = `${r.numeroDisplay || r.numero} ${r.contractNumero || ''} ${r.customerName || ''} ${r.companyRazaoSocial || ''}`.toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => (b.dataEmissao || '').localeCompare(a.dataEmissao || ''));
  }, [recibos, filterStatus, search]);




  // ===== ações =====
  const generateOne = async (
    contractId: string, valor: number, opts?: { semPdf?: boolean; silent?: boolean; comp?: string }
  ) => {
    const comp = opts?.comp || competencia;
    const out = await receiptsService.generate({ contractId, competencia: comp, valor, pago: true });
    acknowledgeGenerated(contractId, comp);
    if (!opts?.semPdf) {
      try {
        const list = await receiptsService.list({ competencia: comp, contractId });
        const r = list.find(x => x.id === out.id);
        if (r) await generateReceiptPdf(receiptForPdf(r));
      } catch { /* PDF best-effort */ }
    }
    if (!opts?.silent) toast.success(`Recibo ${out.numero} gerado`);
    return out;
  };

  const gerar = async (p: PendingReceipt, opts?: { semPdf?: boolean; periodo?: { inicio: string; fim: string }; dataVencimento?: string; semValidade?: boolean; cno?: string; enderecoObra?: string }) => {
    setWorking(p.contractId);
    try {
      if (opts?.periodo) {
        await gerarPeriodo(p, opts.periodo.inicio, opts.periodo.fim, { 
          baixarPdf: !opts.semPdf, 
          dataVencimento: opts.dataVencimento, 
          semValidade: opts.semValidade,
          cno: opts.cno,
          enderecoObra: opts.enderecoObra
        });
      } else {
        await generateOne(p.contractId, Number(p.valorMensal), { ...opts, comp: compOf(p) });
        await load();
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setWorking(null); }
  };

  // Gera UM recibo com período exato (2 datas). A "competência" do recibo
  // passa a ser exibida como "DD/MM/YYYY - DD/MM/YYYY".
  const gerarPeriodo = async (
    p: PendingReceipt, periodoInicio: string, periodoFim: string,
    opts?: { marcarPago?: boolean; baixarPdf?: boolean; semValidade?: boolean; dataVencimento?: string; cno?: string; enderecoObra?: string }
  ) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodoInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(periodoFim)) {
      toast.error('Datas inválidas'); return;
    }
    if (periodoFim < periodoInicio) {
      toast.error('A data final deve ser igual ou posterior à inicial'); return;
    }
    if (opts?.dataVencimento && !/^\d{4}-\d{2}-\d{2}$/.test(opts.dataVencimento)) {
      toast.error('Data de vencimento inválida'); return;
    }
    setWorking(p.contractId);
    try {
      const out = await receiptsService.generate({
        contractId: p.contractId,
        competencia: compOf(p),
        periodoInicio,

        periodoFim,
        valor: Number(p.valorMensal),
        pago: opts?.marcarPago ?? true,
        semValidade: !!opts?.semValidade,
        dataVencimento: opts?.dataVencimento,
        cno: opts?.cno,
        enderecoObra: opts?.enderecoObra,
      });
      acknowledgeGenerated(p.contractId, compOf(p));
      if (opts?.baixarPdf !== false) {
        try {
          const list = await receiptsService.list({
            competencia: compOf(p),
            contractId: p.contractId,
          });
          const r = list.find(x => x.id === out.id);
          if (r) await generateReceiptPdf(receiptForPdf(r));
        } catch { /* PDF best-effort */ }
      }
      await load();
      if (opts?.semValidade) {
        toast.success(`Recibo sem validade gerado · ${formatPeriodo(periodoInicio, periodoFim)}`);
        setActiveTab('sem-validade');
      } else {
        toast.success(`Recibo gerado · ${formatPeriodo(periodoInicio, periodoFim)}`);
      }
    } catch (e: any) {
      const msg = String(e.message || '');
      if (msg.toLowerCase().includes('já existe')) {
        toast.warning(msg);
      } else toast.error(msg || 'Falha ao gerar recibo');

    } finally { setWorking(null); }
  };

  const gerarLote = async () => {
    if (selected.size === 0) return;
    const alvos = pendentes.filter(p => selected.has(pendingKey(p)));
    setWorking('__batch__');
    let ok = 0, fail = 0;
    for (const p of alvos) {
      try { await generateOne(p.contractId, Number(p.valorMensal), { semPdf: true, silent: true, comp: compOf(p) }); ok++; }
      catch { fail++; }
    }
    setSelected(new Set());
    setWorking(null);
    await load();
    if (fail === 0) toast.success(`${ok} recibo(s) gerados como pagos`);
    else toast.warning(`${ok} ok, ${fail} falharam`);
  };

  // Lista de pendentes após aplicar os filtros da própria aba.
  const pendentesFiltrados = useMemo(() => {
    const q = pendSearch.trim().toLowerCase();
    const t = todayISO();
    return pendentes.filter((p) => {
      if (pendCompanyId !== 'all' && String(p.companyId || '') !== pendCompanyId) return false;
      if (q) {
        const hay = [
          p.contractNumero, p.customerName, p.customerDocument,
          p.companyRazaoSocial, p.companyCnpj,
        ].map(v => String(v || '').toLowerCase()).join(' | ');
        if (!hay.includes(q)) return false;
      }
      if (pendVencFrom || pendVencTo || pendQuick !== 'none') {
        const venc = dueDateInComp(compOf(p), Number(p.diaVencimento || 10));
        if (pendVencFrom && venc < pendVencFrom) return false;
        if (pendVencTo && venc > pendVencTo) return false;
        if (pendQuick === 'vencidos' && !(venc < t)) return false;
        if (pendQuick === 'em7') {
          const d = diffDays(venc, t);
          if (!(d >= 0 && d <= 7)) return false;
        }
      }
      return true;
    });
  }, [pendentes, pendSearch, pendCompanyId, pendVencFrom, pendVencTo, pendQuick, competencia]);

  const pendFiltroAtivo =
    !!pendSearch || pendCompanyId !== 'all' || !!pendVencFrom || !!pendVencTo || pendQuick !== 'none';

  const clearPendFilters = () => {
    setPendSearch(''); setPendCompanyId('all');
    setPendVencFrom(''); setPendVencTo(''); setPendQuick('none');
  };

  // Exporta CSV dos pendentes conforme filtros aplicados na aba.
  const exportPendentesCsv = useCallback(() => {
    try {
      const headers = [
        'Nº contrato', 'Cliente', 'Documento', 'Empresa', 'CNPJ empresa',
        'Competência', 'Dia venc.', 'Vencimento', 'Valor mensal',
      ];
      const rows = pendentesFiltrados.map(p => {
        const pComp = compOf(p);
        const venc = dueDateInComp(pComp, Number(p.diaVencimento || 10)) || '';
        return [
          p.contractNumero || '',
          p.customerName || '',
          p.customerDocument || '',
          p.companyRazaoSocial || '',
          p.companyCnpj || '',
          pComp,
          String(p.diaVencimento ?? ''),
          venc,
          Number(p.valorMensal || 0).toFixed(2).replace('.', ','),
        ];
      });
      downloadCsv(`pendentes-${competencia}`, headers, rows);
      toast.success(`CSV exportado (${rows.length} pendentes).`);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao exportar CSV.');
    }
  }, [pendentesFiltrados, competencia]);

  // Habilita "recibo unificado" quando 2+ pendentes selecionados são
  // da MESMA empresa emissora E do MESMO cliente.

  const unifiedGroup = useMemo(() => {
    if (selected.size < 2) return null;
    const arr = pendentes.filter(p => selected.has(pendingKey(p)));
    if (arr.length < 2) return null;
    const cId = arr[0].companyId, kId = arr[0].customerId, cComp = compOf(arr[0]);
    if (!cId || !kId) return null;
    // Unificado exige mesma empresa, mesmo cliente E mesma competência
    // (a regra dos 10 pode mesclar meses diferentes na lista).
    if (!arr.every(p => p.companyId === cId && p.customerId === kId && compOf(p) === cComp)) return null;
    return { arr, companyId: cId };
  }, [selected, pendentes, competencia]);

  const gerarUnificado = async () => {
    if (!unifiedGroup) return;
    setWorking('__unified__');
    try {
      const { arr, companyId } = unifiedGroup;
      const [companies, ...contracts] = await Promise.all([
        erpService.listCompanies(),
        ...arr.map(p => contractsService.get(p.contractId)),
      ]);
      const company = companies.find(c => c.id === companyId);
      if (!company) throw new Error('Empresa emissora não encontrada');
      const first = contracts[0];
      const customer = first.customerSnapshot || {
        name: first.customerName, document: first.customerDocument,
      };

      // Período por contrato (30 dias) baseado no dataInicio de cada contrato
      // e na competência REAL de cada pendente (regra dos 10 pode mesclar meses).
      const periodos = contracts.map((c, i) => computeCompetenciaPeriodo(c.dataInicio, compOf(arr[i])));

      // Persiste um recibo por contrato — cada um com SEU período de 30 dias.
      // Coletamos os ids para aplicar a MESMA numeração a todo o grupo.
      const gerados: { id: string; numero: string; numeroDisplay?: string | null }[] = [];
      const numeros: (string | null)[] = [];
      let okCount = 0, failCount = 0;
      const unifiedGroupId = crypto.randomUUID();
      // Número do grupo: só o PRIMEIRO recibo consome o contador; os demais
      // reutilizam a mesma numeração (não gastam 613, 614…).
      let numeroGrupo: string | null = null;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        const per = periodos[i];
        try {
          const out = await receiptsService.generate({
            contractId: p.contractId,
            competencia: compOf(p),
            periodoInicio: per.inicio,

            periodoFim: per.fim,
            valor: Number(p.valorMensal),
            pago: true,
            unifiedGroupId,
            ...(numeroGrupo ? { numeroGrupo } : {}),
          });
          gerados.push({ id: out.id, numero: out.numero, numeroDisplay: out.numeroDisplay });
          acknowledgeGenerated(p.contractId, compOf(p));
          if (!numeroGrupo) numeroGrupo = out.numeroDisplay || out.numero;
          numeros.push(numeroGrupo);
          okCount++;
        } catch {
          numeros.push(null);
          failCount++;
        }
      }

      // Numeração única do grupo: todos os recibos exibem o número do primeiro.
      const numero = numeroGrupo || `UNIF-${todayISO()}`;
      if (gerados.length) {
        await Promise.all(
          gerados.map(g =>
            receiptsService.update(g.id, { numeroDisplay: numero }).catch(() => null),
          ),
        );
      }

      const items = contracts.map((c, i) => ({
        contractNumero: c.numero,
        descricao: c.descricao || `Locação mensal — Contrato ${c.numero}`,
        enderecoObra: c.enderecoObra || c.localEvento || '',
        cno: c.cno || '',
        valor: Number(arr[i].valorMensal),
        numeroRecibo: numeros[i] ? numero : null,
        periodoInicio: periodos[i].inicio,
        periodoFim: periodos[i].fim,
      }));
      const total = items.reduce((s, it) => s + it.valor, 0);

      // Período consolidado do PDF (min início / max fim).
      const iniCons = periodos.map(p => p.inicio).sort()[0];
      const fimCons = periodos.map(p => p.fim).sort().slice(-1)[0];

      // Gera UM PDF unificado
      await generateUnifiedReceiptPdf({
        numero,
        competencia: compOf(arr[0]),
        periodoInicio: iniCons,
        periodoFim: fimCons,
        dataEmissao: todayISO(),
        dataVencimento: null,
        company,
        customer,
        items,
        total,
      });

      setSelected(new Set());
      setUnifOpen(false);
      await load();
      setActiveTab('emitidos');
      if (failCount === 0) toast.success(`Recibo unificado gerado · ${okCount} contratos · ${formatComp(compOf(arr[0]))}`);
      else toast.warning(`PDF gerado. ${okCount} recibos ok, ${failCount} falharam`);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao gerar recibo unificado');
    } finally {
      setWorking(null);
    }
  };

  const regerar = async (r: Receipt) => {
    setWorking(r.id);
    try {
      await receiptsService.generate({ contractId: r.contractId, competencia: r.competencia, regerar: true, valor: Number(r.valor) });
      toast.success('Recibo re-gerado');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setWorking(null); }
  };

  const baixar = async (r: Receipt) => {
    try {
      // Um recibo só é tratado como parte de um grupo UNIFICADO quando
      // compartilha explicitamente o mesmo `numeroDisplay` (numeração de grupo
      // gravada no momento da geração unificada) com outros recibos. Nunca
      // inferimos grupo por cliente/empresa/período — isso fazia recibos
      // gerados individualmente saírem como unificados.
      const group = r.unifiedGroupId
        ? recibos.filter(x =>
            x.unifiedGroupId === r.unifiedGroupId &&
            !!x.semValidade === !!r.semValidade &&
            x.status !== 'cancelado',
          )
        : [];

      if (group.length > 1) {
        const first = group[0].snapshot || {};
        const items = group.map(g => {
          const snap = g.snapshot || {};
          const ct = snap.contract || {};
          return {
            contractNumero: g.contractNumero || ct.numero || '',
            descricao: ct.descricaoCompleta || ct.descricao || `Locação — Contrato ${g.contractNumero || ''}`,
            enderecoObra: ct.enderecoObra || ct.localEvento || '',
            cno: ct.cno || '',
            valor: Number(g.valor) || 0,
            periodoInicio: g.periodoInicio || null,
            periodoFim: g.periodoFim || null,
          };
        });
        const total = items.reduce((s, it) => s + it.valor, 0);
        await generateUnifiedReceiptPdf({
          // Numeração do grupo (todos os recibos unificados compartilham o
          // mesmo número exibido) — nunca o número interno "SV-...".
          numero: group[0].numeroDisplay || r.numeroDisplay || r.numero,
          competencia: r.competencia,
          periodoInicio: null,
          periodoFim: null,
          dataEmissao: r.dataEmissao,
          dataVencimento: r.dataVencimento || null,
          company: first.company || {},
          customer: first.customer || { 
            name: r.customerName,
            document: first.customer?.document,
            address: first.customer?.address,
            numero: first.customer?.numero,
            bairro: first.customer?.bairro,
            cidade: first.customer?.cidade,
            estado: first.customer?.estado,
            cep: first.customer?.cep,
            telefone: first.customer?.telefone,
            email: first.customer?.email
          },
          items,
          total,
          semValidade: !!r.semValidade,
        });
        return;
      }
      await generateReceiptPdf(receiptForPdf(r));
    } catch (e: any) { toast.error(e.message); }
  };

  const handleReabrir = async () => {
    if (!reabrirDialog) return;
    setWorking(reabrirDialog.id);
    try {
      await receiptsExtraService.togglePaid(reabrirDialog.id, false, { valorPago: 0 });
      toast.success('Recibo reaberto');
      setReabrirDialog(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setWorking(null); }
  };

  // Reverte um recibo CANCELADO ao estado "não faturado" (volta à lista de pendentes).
  const voltarParaPendentes = async (r: Receipt) => {
    const ok = await confirmDialog({
      title: 'Voltar recibo para pendentes?',
      description: `O recibo ${r.numero} será removido e a competência voltará à lista de pendentes, como se ainda não tivesse sido faturado. Essa ação apaga o registro do cancelamento.`,
      confirmLabel: 'Voltar para pendentes',
    });
    if (!ok) return;
    setWorking(r.id);
    try {
      const result = await receiptsService.reopen(r.id);
      toast.success(result.unified
        ? `${result.affected} recibos do grupo removidos — competências disponíveis novamente`
        : 'Recibo removido — competência disponível para faturar novamente');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setWorking(null); }
  };

  const toggleSel = (key: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };
  const toggleSelAll = () => {
    const ids = pendentesFiltrados.map(pendingKey);
    const allSelected = ids.length > 0 && ids.every(key => selected.has(key));
    if (allSelected) {
      setSelected(prev => {
        const n = new Set(prev);
        ids.forEach(id => n.delete(id));
        return n;
      });
    } else {
      setSelected(prev => {
        const n = new Set(prev);
        ids.forEach(id => n.add(id));
        return n;
      });
    }
  };


  const clearFilters = () => {
    setFilterStatus('all'); setFilterCompanyId('all'); setSearch('');
    setFilterFrom(''); setFilterTo(''); setQuick('none'); setDateBase('emissao');
  };

  // ===== recibos: seleção em lote =====
  const toggleSelRec = (id: string) => {
    setSelectedRecibos(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleSelAllRec = () => {
    if (selectedRecibos.size === recibosFiltrados.length) setSelectedRecibos(new Set());
    else setSelectedRecibos(new Set(recibosFiltrados.map(r => r.id)));
  };

  const batchMarkPaid = async () => {
    const alvos = recibosFiltrados.filter(r =>
      selectedRecibos.has(r.id) && r.status !== 'cancelado' && r.status !== 'pago');
    if (alvos.length === 0) { toast.info('Nenhum recibo elegível na seleção.'); return; }
    setBatchWorking(true);
    let ok = 0, fail = 0;
    for (const r of alvos) {
      try {
        await receiptsExtraService.togglePaid(r.id, true, {
          formaPagamento: (r.formaPagamento as FormaPagamento) || 'pix',
          dataPagamento: todayISO(),
          valorPago: Number(r.valor || 0),
        });
        ok++;
      } catch { fail++; }
    }
    setSelectedRecibos(new Set());
    setBatchWorking(false);
    await load();
    fail === 0
      ? toast.success(`${ok} recibo(s) marcados como pagos`)
      : toast.warning(`${ok} ok, ${fail} falharam`);
  };

  const batchReopen = async () => {
    const ids = Array.from(selectedRecibos).filter(id => {
      const r = recibos.find(x => x.id === id);
      return r && (r.status === 'pago' || r.status === 'parcial');
    });
    if (ids.length === 0) { toast.info('Nenhum recibo pago/parcial na seleção.'); return; }
    setBatchWorking(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try { await receiptsExtraService.togglePaid(id, false, { valorPago: 0 }); ok++; }
      catch { fail++; }
    }
    setSelectedRecibos(new Set());
    setBatchWorking(false);
    await load();
    fail === 0 ? toast.success(`${ok} recibo(s) reabertos`) : toast.warning(`${ok} ok, ${fail} falharam`);
  };

  const batchCancelSubmit = async () => {
    const motivo = batchCancelMotivo.trim();
    if (!motivo) { toast.error('Informe o motivo do cancelamento.'); return; }
    const ids = Array.from(selectedRecibos).filter(id => {
      const r = recibos.find(x => x.id === id);
      return r && r.status !== 'cancelado';
    });
    if (ids.length === 0) { toast.info('Nenhum recibo elegível.'); return; }
    setBatchWorking(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try { await receiptsService.cancel(id, motivo); ok++; }
      catch { fail++; }
    }
    setSelectedRecibos(new Set());
    setBatchWorking(false);
    setBatchCancelOpen(false);
    setBatchCancelMotivo('');
    await load();
    fail === 0 ? toast.success(`${ok} recibo(s) cancelados`) : toast.warning(`${ok} ok, ${fail} falharam`);
  };

  const [unifPreview, setUnifPreview] = useState<UnifiedReceiptInput | null>(null);

  const handleUnifiedAction = async (semValidade: boolean) => {
    const alvos = pendentes.filter(p => selected.has(pendingKey(p)));
    if (alvos.length === 0) return;
    const first = alvos[0];
    
    // Competência padrão do grupo (regra dos 10 pode mesclar meses futuros)
    const comp = compOf(first);

    // Período unificado padrão: do menor início ao maior fim dos itens
    const dates = alvos.map(a => computeCompetenciaPeriodo(a.dataInicio, compOf(a)));
    const minIni = dates.reduce((m, d) => (!m || d.inicio < m) ? d.inicio : m, '');
    const maxFim = dates.reduce((m, d) => (!m || d.fim > m) ? d.fim : m, '');

    // Busca os contratos completos para que o unificado (com ou sem validade)
    // exiba descrição real, endereço da obra/evento e CNO — igual ao recibo
    // unificado normal, que carrega os dados via contractsService.get.
    const fulls = await Promise.all(
      alvos.map(a => contractsService.get(a.contractId).catch(() => null)),
    );
    const custFull = fulls.find(Boolean)?.customerSnapshot || null;

    const input: UnifiedReceiptInput = {
      numero: 'AGUARDANDO',
      competencia: comp,
      periodoInicio: minIni,
      periodoFim: maxFim,
      dataEmissao: todayISO(),
      dataVencimento: nextDueDate(comp, first.diaVencimento || 10),
      company: companies.find(c => c.id === first.companyId) || { id: first.companyId },
      customer: custFull || {
        id: first.customerId,
        name: first.customerName,
        document: (first as any).customerDocument,
        address: (first as any).customerAddress,
        numero: (first as any).customerNumero,
        bairro: (first as any).customerBairro,
        cidade: (first as any).customerCidade,
        estado: (first as any).customerEstado,
        cep: (first as any).customerCep,
        telefone: (first as any).customerTelefone,
        email: (first as any).customerEmail,
      },
      items: alvos.map((a, i) => {
        const c: any = fulls[i] || {};
        return {
          contractId: a.contractId,
          contractNumero: c.numero || a.contractNumero || '',
          descricao: c.descricaoCompleta || c.descricao
            || `Locação mensal — Contrato ${c.numero || a.contractNumero || ''}`.trim(),
          enderecoObra: c.enderecoObra || c.localEvento
            || (a as any).enderecoObra || (a as any).localEvento || '',
          cno: c.cno || (a as any).cno || '',
          valor: Number(a.valorMensal) || 0,
          periodoInicio: dates[i].inicio,
          periodoFim: dates[i].fim,
        };
      }),
      total: alvos.reduce((s, a) => s + (Number(a.valorMensal) || 0), 0),
      semValidade,
    };
    setUnifPreview(input);
  };

  const confirmUnified = async (input: UnifiedReceiptInput) => {
    setBatchWorking(true);
    try {
      const results = [];
      const unifiedGroupId = crypto.randomUUID();
      // Apenas o primeiro recibo consome numeração; os demais reutilizam.
      let numeroGrupo: string | null = null;
      for (const it of input.items) {
        const r = await receiptsService.generate({
          contractId: (it as any).contractId,
          competencia: input.competencia,
          valor: it.valor,
          dataVencimento: input.dataVencimento || undefined,
          periodoInicio: (it as any).periodoInicio || undefined,
          periodoFim: (it as any).periodoFim || undefined,
          semValidade: !!input.semValidade,
          cno: it.cno || undefined,
          enderecoObra: it.enderecoObra || undefined,
          unifiedGroupId,
          ...(numeroGrupo ? { numeroGrupo } : {}),
        });
        acknowledgeGenerated((it as any).contractId, input.competencia);
        if (!numeroGrupo) numeroGrupo = r.numeroDisplay || r.numero;
        results.push(r);
      }

      // Numeração unificada: TODOS os recibos do grupo exibem o MESMO número.
      const numeroUnificado = numeroGrupo || results[0]?.numero || '';
      await Promise.all(
        results.map(r =>
          receiptsService.update(r.id, { numeroDisplay: numeroUnificado }).catch(() => null),
        ),
      );

      await generateUnifiedReceiptPdf({
        ...input,
        numero: numeroUnificado,
      });

      toast.success(`${results.length} recibos gerados e PDF unificado baixado`);
      setSelected(new Set());
      setUnifPreview(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBatchWorking(false);
    }
  };
  const exportRecibosCsv = (lista: Receipt[]) => {
    if (lista.length === 0) { toast.info('Nada para exportar.'); return; }
    const header = [
      'Numero', 'Contrato', 'Cliente', 'Empresa', 'Emissao', 'Vencimento',
      'Valor', 'ValorPago', 'Status', 'FormaPagamento', 'DataPagamento',
    ];
    const rows = lista.map(r => [
      r.numero, r.contractNumero || '', r.customerName || '', r.companyRazaoSocial || '',
      r.dataEmissao || '', r.dataVencimento || '',
      Number(r.valor || 0).toFixed(2).replace('.', ','),
      Number(r.valorPago || 0).toFixed(2).replace('.', ','),
      r.status || '', r.formaPagamento || '', r.dataPagamento || '',
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(cell => {
        const s = String(cell ?? '');
        return /[";\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(';'))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recibos-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${lista.length} recibo(s) exportados`);
  };

  // ===== Exportação em ZIP (recibos por período) =====
  const exportRecibosZip = async () => {
    if (!zipFrom || !zipTo) { toast.error('Informe as datas inicial e final.'); return; }
    if (zipFrom > zipTo)   { toast.error('Data inicial deve ser anterior à final.'); return; }
    setZipBusy(true);
    setZipProgress(null);
    try {
      const lista = await receiptsService.list({ from: zipFrom, to: zipTo });
      // Aplica filtros locais: ignora cancelados e (opcionalmente) sem validade jurídica.
      const filtrados = lista.filter(r =>
        r.status !== 'cancelado' &&
        (zipIncludeSV || !r.semValidade)
      );
      if (filtrados.length === 0) {
        toast.info('Nenhum recibo encontrado nesse período.');
        setZipBusy(false);
        return;
      }
      // Import dinâmico (não bloqueia bundle inicial)
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const comValidade = zip.folder('com-validade');
      const semValidade = zip.folder('sem-validade');
      setZipProgress({ done: 0, total: filtrados.length });
      for (let i = 0; i < filtrados.length; i++) {
        const r = filtrados[i];
        try {
          const res = await generateReceiptPdf(receiptForPdf(r), { returnBlob: true });
          if (res && 'blob' in res) {
            const folder = r.semValidade ? semValidade : comValidade;
            (folder || zip).file(res.filename, res.blob);
          }
        } catch (err) {
          console.error('Falha ao gerar PDF do recibo', r.numero, err);
        }
        setZipProgress({ done: i + 1, total: filtrados.length });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recibos_${zipFrom}_a_${zipTo}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${filtrados.length} recibo(s) exportados em ZIP`);
      setZipOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Falha ao gerar ZIP');
    } finally {
      setZipBusy(false);
      setZipProgress(null);
    }
  };

  /** Exporta CSV com **todos** os recibos que casam com os filtros atuais (não só a página). */
  const [exportBusy, setExportBusy] = useState<null | 'csv' | 'zip'>(null);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);

  const exportAllFilteredCsv = async () => {
    if (exportBusy) return;
    setExportBusy('csv');
    try {
      const tid = toast.loading('Buscando todos os recibos do filtro…');
      const all = await fetchAllFilteredRecibos();
      toast.dismiss(tid);
      if (!all) return;
      if (all.length === 0) { toast.info('Nada para exportar.'); return; }
      exportRecibosCsv(all);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao exportar CSV');
    } finally {
      setExportBusy(null);
    }
  };

  /** Exporta ZIP de PDFs com **todos** os recibos que casam com os filtros atuais. */
  const exportAllFilteredZip = async () => {
    if (exportBusy) return;
    setExportBusy('zip');
    setExportProgress(null);
    try {
      const tid = toast.loading('Buscando todos os recibos do filtro…');
      const all = await fetchAllFilteredRecibos(2000);
      toast.dismiss(tid);
      if (!all) return;
      const filtrados = all.filter(r => r.status !== 'cancelado');
      if (filtrados.length === 0) { toast.info('Nenhum recibo para exportar.'); return; }
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const comValidade = zip.folder('com-validade');
      const semValidade = zip.folder('sem-validade');
      setExportProgress({ done: 0, total: filtrados.length });
      for (let i = 0; i < filtrados.length; i++) {
        const r = filtrados[i];
        try {
          const res = await generateReceiptPdf(receiptForPdf(r), { returnBlob: true });
          if (res && 'blob' in res) {
            const folder = r.semValidade ? semValidade : comValidade;
            (folder || zip).file(res.filename, res.blob);
          }
        } catch (err) {
          console.error('Falha ao gerar PDF do recibo', r.numero, err);
        }
        setExportProgress({ done: i + 1, total: filtrados.length });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recibos-filtro-${todayISO()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${filtrados.length} recibo(s) exportados em ZIP`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Falha ao gerar ZIP');
    } finally {
      setExportBusy(null);
      setExportProgress(null);
    }
  };




  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-[1400px] mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-600 font-semibold mb-1">
            <DollarSign className="h-3.5 w-3.5" /> Financeiro
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Recibos, Contratos & Gastos</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Contratos ativos geram recibos mensais. Gastos puxam manutenções automaticamente.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Competência</Label>
            <Input type="month" value={competencia}
              onChange={(e) => setCompetencia(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <Button onClick={load} variant="outline" size="sm" disabled={loading} aria-label="Recarregar">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPI label="Recebido" value={BRL(totals.recebido)} icon={CheckCircle2} accent="from-emerald-500 to-teal-600" />
        <KPI label="Em aberto" value={BRL(totals.aberto)} icon={AlertCircle} accent="from-amber-500 to-orange-600" />
        <KPI label="Pendente do mês" value={BRL(totals.pendente)} icon={AlertCircle} accent="from-rose-500 to-red-600" />
        <KPI label="Total previsto" value={BRL(totals.total)} icon={DollarSign} accent="from-indigo-500 to-purple-600" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <button
          type="button"
          onClick={() => { setQuick(quick === 'vencidos' ? 'none' : 'vencidos'); setFilterStatus('all'); }}
          className="text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 transition-transform duration-200 hover:-translate-y-0.5"
          title="Filtrar apenas recibos vencidos"
        >
          <KPI label="Vencidos" value={BRL(totals.vencidos)}
            sub={totals.vencidosCount > 0
              ? `${totals.vencidosCount} recibo(s) em atraso`
              : 'Nenhum em atraso 🎉'}
            icon={TimerOff}
            accent="from-rose-600 to-red-700" />
        </button>
        <KPI label="Inadimplência" value={`${totals.inadimp.toFixed(1)}%`}
          sub={`${BRL(totals.aberto + totals.pendente)} a receber`} icon={AlertTriangle}
          accent="from-rose-500 to-orange-500" />
        <KPI label="Ticket médio" value={BRL(totals.ticket)}
          sub={`${totalRecibos} recibos no filtro`} icon={ReceiptIcon}
          accent="from-sky-500 to-indigo-600" />
        <KPI label="Resultado do mês" value={BRL(totals.resultado)}
          sub={`recebido − ${BRL(gastosMes)} de gastos`}
          icon={totals.resultado >= 0 ? TrendingUp : TrendingDown}
          accent={totals.resultado >= 0 ? 'from-emerald-500 to-green-600' : 'from-rose-500 to-red-600'} />
      </div>

      <ChartCard series={summary} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes <Badge variant="outline" className="ml-2">
              {pendFiltroAtivo ? `${pendentesFiltrados.length}/${pendentes.length}` : pendentes.length}
            </Badge>

          </TabsTrigger>
          <TabsTrigger value="pagos">
            Pagos do mês <Badge variant="outline" className="ml-2">{pagosDoMes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="emitidos">
            Recibos <Badge variant="outline" className="ml-2">{activeTab === 'emitidos' ? totalRecibos : recibosFiltrados.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sem-validade">
            Sem validade <Badge variant="outline" className="ml-2">{activeTab === 'sem-validade' ? totalRecibos : recibosSemValidade.length}</Badge>
          </TabsTrigger>

          <TabsTrigger value="notas">
            Notas Fiscais <Badge variant="outline" className="ml-2">{nfTotal}</Badge>
          </TabsTrigger>
          <TabsTrigger value="medicoes">
            Medições <Badge variant="outline" className="ml-2">{medTotal}</Badge>
          </TabsTrigger>
          <TabsTrigger value="clientes">
            Por cliente <Badge variant="outline" className="ml-2">{perCustomer.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <Card>
            <CardContent className="p-4 space-y-3 border-b">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Buscar</Label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={pendSearch}
                      onChange={e => setPendSearch(e.target.value)}
                      className="h-9 pl-7"
                      placeholder="nº contrato, cliente, empresa, CNPJ/CPF…"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Empresa</Label>
                  <SearchableSelect
                    value={pendCompanyId}
                    onValueChange={setPendCompanyId}
                    triggerClassName="h-9 w-[200px]"
                    placeholder="Empresa"
                    searchPlaceholder="Buscar empresa..."
                    options={[
                      { value: 'all', label: 'Todas' },
                      ...companies.map(c => ({ value: c.id, label: c.razaoSocial })),
                    ]}
                  />
                </div>
                <div>
                  <Label className="text-xs">Vencimento de</Label>
                  <Input type="date" value={pendVencFrom} onChange={e => setPendVencFrom(e.target.value)} className="h-9 w-[150px]" />
                </div>
                <div>
                  <Label className="text-xs">Vencimento até</Label>
                  <Input type="date" value={pendVencTo} onChange={e => setPendVencTo(e.target.value)} className="h-9 w-[150px]" />
                </div>
                {pendFiltroAtivo && (
                  <Button variant="ghost" size="sm" onClick={clearPendFilters}>Limpar</Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportPendentesCsv}
                  disabled={pendentesFiltrados.length === 0}
                  title="Exportar CSV dos pendentes exibidos (respeitando os filtros)"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Exportar CSV (filtro)
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <QuickChip active={pendQuick === 'none'} onClick={() => setPendQuick('none')}>Todos</QuickChip>
                <QuickChip active={pendQuick === 'vencidos'} onClick={() => setPendQuick('vencidos')} tone="rose">Vencidos</QuickChip>
                <QuickChip active={pendQuick === 'em7'} onClick={() => setPendQuick('em7')} tone="amber">Vence em 7 dias</QuickChip>
                {pendFiltroAtivo && (
                  <span className="ml-auto text-xs text-muted-foreground self-center">
                    {pendentesLoading ? 'Atualizando pendentes…' : `Exibindo ${pendentesFiltrados.length} de ${pendentes.length}`}
                  </span>
                )}
              </div>
            </CardContent>

            <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2 border-b">
              <div className="text-xs text-slate-500">
                {selected.size > 0
                  ? <span className="font-medium text-slate-700">{selected.size} selecionado(s)</span>
                  : 'Selecione contratos para gerar recibos em lote (marca como pagos, sem PDF).'}
                {mergedComps.length > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    Regra dos 10: {mergedComps.map(formatComp).join(', ')} liberado(s) antecipadamente
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
                )}
                {unifiedGroup && (
                  <ReceiptUnifiedActions 
                    selected={selected} 
                    pendentes={pendentes} 
                    competencia={competencia} 
                    companies={companies} 
                    batchWorking={batchWorking} 
                    handleUnifiedAction={handleUnifiedAction} 
                  />
                )}
                <Button size="sm" disabled={selected.size === 0 || working === '__batch__'} onClick={gerarLote}
                  className="bg-emerald-600 hover:bg-emerald-700">
                  {working === '__batch__'
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                  Gerar selecionados
                </Button>
              </div>
            </CardContent>
            <CardContent className="p-0">
              <div
                ref={pendentesScrollRef}
                className={`overflow-auto ${pendentesFiltrados.length > 50 ? 'max-h-[70vh]' : ''}`}
              >
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox aria-label="Selecionar todos"
                          checked={
                            pendentesFiltrados.length > 0 &&
                            pendentesFiltrados.every(p => selected.has(pendingKey(p)))
                          }
                          onCheckedChange={toggleSelAll} />
                      </TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentesFiltrados.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {pendentesLoading
                          ? 'Carregando pendentes…'
                          : pendFiltroAtivo
                          ? 'Nenhum pendente para os filtros selecionados.'
                          : `Nenhuma cobrança pendente para ${formatComp(competencia)}.`}
                      </TableCell></TableRow>
                    )}
                    <VirtualRows
                      scrollRef={pendentesScrollRef}
                      items={pendentesFiltrados}
                      colSpan={7}
                      estimateSize={56}
                      getKey={pendingKey}
                      renderRow={(p) => (
                        <TableRow key={pendingKey(p)} data-state={selected.has(pendingKey(p)) ? 'selected' : undefined}>
                          <TableCell>
                            <Checkbox aria-label={`Selecionar ${p.contractNumero}`}
                              checked={selected.has(pendingKey(p))}
                              onCheckedChange={() => toggleSel(pendingKey(p))} />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.contractNumero}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{p.customerName || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{p.companyRazaoSocial || '—'}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col leading-tight">
                              <span className="tabular-nums">{D(dueDateInComp(compOf(p), Number(p.diaVencimento || 10)))}</span>
                              <span className="text-[10px] text-muted-foreground">dia {p.diaVencimento}</span>
                              {compOf(p) !== competencia && (
                                <Badge variant="outline" className="mt-1 w-fit text-[10px] font-semibold">
                                  Próxima competência: {formatComp(compOf(p))}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right font-semibold">{BRL(Number(p.valorMensal))}</TableCell>
                          <TableCell className="text-right whitespace-nowrap space-x-1">
                            <Button size="sm" variant="ghost" onClick={() => setViewContractId(p.contractId)}
                              title="Ver contrato" aria-label="Ver contrato">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setNfDialogTarget(p)}
                              disabled={working === p.contractId}
                              title="Vincular Nota Fiscal emitida no portal do governo"
                              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" /> Vincular NF
                            </Button>
                            <GerarReciboPopover
                              pending={p}
                              working={working === p.contractId}
                                onConfirm={(semValidade, dataVencimento, periodoOverride, cno, enderecoObra) => {
                                  void gerar(p, {
                                    semValidade,
                                    dataVencimento,
                                    periodo: periodoOverride || computeCompetenciaPeriodo(p.dataInicio, compOf(p)),
                                    cno,
                                    enderecoObra
                                  });
                                }}
                               competencia={compOf(p)}
                            >
                              <Button
                                size="sm"
                                disabled={working === p.contractId}
                                className="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500 transition-colors duration-200"
                              >
                                {working === p.contractId
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                  : <ReceiptIcon className="h-3.5 w-3.5 mr-1" />}
                                Gerar recibo
                              </Button>
                            </GerarReciboPopover>
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagos">
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Contratos pagos', value: String(pagosKpis.count), icon: CheckCircle2 },
                  { label: 'Total recebido', value: BRL(pagosKpis.totalRecebido), icon: DollarSign },
                  { label: 'Ticket médio', value: BRL(pagosKpis.ticket), icon: ReceiptIcon },
                  { label: 'Vencem em 7 dias', value: String(pagosKpis.em7), icon: CalendarDays },
                ].map((k) => {
                  const Icon = k.icon;
                  return (
                    <div
                      key={k.label}
                      className="rounded-lg border border-border bg-card p-3 transition-colors duration-200 hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {k.label}
                      </div>
                      <div className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                        {k.value}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Empty state */}
              {pagosDoMes.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 py-10 text-center">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" aria-hidden />
                  <div className="text-sm text-muted-foreground">
                    Nenhum contrato quitado em <span className="font-medium text-foreground">{formatComp(competencia)}</span> ainda.
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('pendentes')}
                    className="transition-colors duration-200"
                  >
                    Ir para Pendentes
                  </Button>
                </div>
              )}

              {/* Desktop table */}
              {pagosDoMes.length > 0 && (
                <div className="hidden md:block rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Contrato</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Forma</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead>Próximo vencimento</TableHead>
                        <TableHead className="w-[140px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagosDoMes.map((r) => {
                        const parcial = r.status === 'parcial';
                        const pago = Number(r.valorPago ?? (r.status === 'pago' ? r.valor : 0) ?? 0);
                        const nd = nextDueDate(competencia, Number(r.diaVencimento || 10));
                        const dd = nd ? diffDays(nd, today) : null;
                        const dueTone =
                          dd == null ? 'bg-muted text-muted-foreground'
                          : dd < 0 ? 'bg-destructive/10 text-destructive'
                          : dd <= 7 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
                        return (
                          <TableRow
                            key={r.id}
                            className="transition-colors duration-150 hover:bg-muted/40"
                          >
                            <TableCell className="font-medium">
                              <div className="text-foreground">{r.contractNumero || '—'}</div>
                              <div className="text-xs text-muted-foreground">Recibo {r.numero}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-foreground">{r.customerName || '—'}</div>
                              {r.customerDocument && (
                                <div className="text-xs text-muted-foreground">{r.customerDocument}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="font-medium text-foreground">{BRL(pago)}</div>
                              {parcial && (
                                <div className="text-xs text-muted-foreground">de {BRL(Number(r.valor || 0))}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {r.formaPagamento ? (
                                <Badge variant="secondary" className="font-normal">
                                  {FORMA_LABEL[r.formaPagamento]}
                                </Badge>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {D(r.dataPagamento || r.dataEmissao)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="text-sm text-foreground">{D(nd)}</span>
                                {dd != null && (
                                  <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${dueTone}`}>
                                    {dd < 0 ? `vencido há ${Math.abs(dd)}d` : dd === 0 ? 'hoje' : `em ${dd}d`}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-8 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/50"
                                  onClick={() => setViewContractId(r.contractId)}
                                  aria-label="Ver contrato" title="Ver contrato"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-8 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/50"
                                  onClick={() => generateReceiptPdf(receiptForPdf(r))}
                                  aria-label="Baixar PDF do recibo"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-8 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/50"
                                  onClick={() => setCancelDialog(r)}
                                  aria-label="Cancelar recibo"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Mobile cards */}
              {pagosDoMes.length > 0 && (
                <div className="md:hidden space-y-2">
                  {pagosDoMes.map((r) => {
                    const parcial = r.status === 'parcial';
                    const pago = Number(r.valorPago ?? (r.status === 'pago' ? r.valor : 0) ?? 0);
                    const nd = nextDueDate(competencia, Number(r.diaVencimento || 10));
                    const dd = nd ? diffDays(nd, today) : null;
                    const dueTone =
                      dd == null ? 'bg-muted text-muted-foreground'
                      : dd < 0 ? 'bg-destructive/10 text-destructive'
                      : dd <= 7 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
                    return (
                      <div
                        key={r.id}
                        className="rounded-lg border border-border bg-card p-3 transition-colors duration-200 hover:bg-muted/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {r.contractNumero || '—'}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {r.customerName || '—'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-foreground">{BRL(pago)}</div>
                            {parcial && (
                              <div className="text-[11px] text-muted-foreground">parcial</div>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            Próx.: <span className="text-foreground">{D(nd)}</span>
                          </span>
                          {dd != null && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${dueTone}`}>
                              {dd < 0 ? `vencido há ${Math.abs(dd)}d` : dd === 0 ? 'hoje' : `em ${dd}d`}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {r.formaPagamento ? (
                            <Badge variant="secondary" className="font-normal">
                              {FORMA_LABEL[r.formaPagamento]}
                            </Badge>
                          ) : <span className="text-xs text-muted-foreground">sem forma</span>}
                          <div className="flex gap-1">
                            <Button
                              size="sm" variant="ghost"
                              className="h-8 transition-colors duration-200"
                              onClick={() => generateReceiptPdf(receiptForPdf(r))}
                              aria-label="Baixar PDF do recibo"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="h-8 transition-colors duration-200"
                              onClick={() => setCancelDialog(r)}
                              aria-label="Cancelar recibo"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emitidos">
          <Card>
            <CardContent className="p-4 space-y-3 border-b">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Buscar</Label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input value={search} onChange={e => setSearch(e.target.value)}
                      className="h-9 pl-7" placeholder="nº recibo, contrato, cliente, empresa…" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Base</Label>
                  <SearchableSelect
                    value={dateBase}
                    onValueChange={(v: any) => setDateBase(v)}
                    triggerClassName="h-9 w-[140px]"
                    placeholder="Base"
                    options={[
                      { value: 'emissao', label: 'Emissão' },
                      { value: 'vencimento', label: 'Vencimento' },
                    ]}
                  />
                </div>
                <div>
                  <Label className="text-xs">De</Label>
                  <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="h-9 w-[150px]" />
                </div>
                <div>
                  <Label className="text-xs">Até</Label>
                  <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="h-9 w-[150px]" />
                </div>
                <div>
                  <Label className="text-xs">Empresa</Label>
                  <SearchableSelect
                    value={filterCompanyId}
                    onValueChange={setFilterCompanyId}
                    triggerClassName="h-9 w-[200px]"
                    placeholder="Empresa"
                    searchPlaceholder="Buscar empresa..."
                    options={[
                      { value: 'all', label: 'Todas' },
                      ...companies.map(c => ({ value: c.id, label: c.razaoSocial })),
                    ]}
                  />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <SearchableSelect
                    value={filterStatus}
                    onValueChange={(v: any) => setFilterStatus(v)}
                    triggerClassName="h-9 w-[140px]"
                    placeholder="Status"
                    options={[
                      { value: 'all', label: 'Todos' },
                      { value: 'pago', label: 'Pagos' },
                      { value: 'parcial', label: 'Parciais' },
                      { value: 'aberto', label: 'Em aberto' },
                      { value: 'cancelado', label: 'Cancelados' },
                    ]}
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
                <Button
                  variant="outline" size="sm"
                  onClick={exportAllFilteredCsv}
                  disabled={exportBusy !== null}
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800/60 dark:text-emerald-400 dark:hover:bg-emerald-950/40 transition-colors duration-200"
                  title="Exportar CSV de TODOS os recibos que casam com os filtros atuais (dataset completo, não só a página)"
                >
                  {exportBusy === 'csv'
                    ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    : <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />}
                  Exportar CSV (filtro)
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={exportAllFilteredZip}
                  disabled={exportBusy !== null}
                  className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary dark:border-primary/40 transition-colors duration-200"
                  title="Baixar ZIP com PDFs de TODOS os recibos do filtro atual (não só a página). Pode demorar para volumes grandes."
                >
                  {exportBusy === 'zip'
                    ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    : <Download className="h-3.5 w-3.5 mr-1" />}
                  Exportar ZIP (filtro)
                  {exportBusy === 'zip' && exportProgress && (
                    <span className="ml-1 tabular-nums text-[11px] opacity-80">
                      {exportProgress.done}/{exportProgress.total}
                    </span>
                  )}
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => {
                    // pré-preenche com o mês corrente da competência selecionada
                    if (!zipFrom && !zipTo && /^\d{4}-\d{2}$/.test(competencia)) {
                      const [y, m] = competencia.split('-').map(Number);
                      const first = `${competencia}-01`;
                      const lastDay = new Date(y, m, 0).getDate();
                      const last = `${competencia}-${String(lastDay).padStart(2, '0')}`;
                      setZipFrom(first);
                      setZipTo(last);
                    }
                    setZipOpen(true);
                  }}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors duration-200"
                  title="Baixar ZIP escolhendo um intervalo específico de datas (diálogo dedicado)"
                >
                  <CalendarDays className="h-3.5 w-3.5 mr-1" /> ZIP por período…
                </Button>



              </div>
              <div className="flex flex-wrap gap-2">
                <QuickChip active={quick === 'none'} onClick={() => setQuick('none')}>Todos</QuickChip>
                <QuickChip active={quick === 'vencidos'} onClick={() => setQuick('vencidos')} tone="rose">Vencidos</QuickChip>
                <QuickChip active={quick === 'em7'} onClick={() => setQuick('em7')} tone="amber">Vence em 7 dias</QuickChip>
              </div>
            </CardContent>
            <CardContent className="p-0">
              <div
                ref={recibosScrollRef}
                className={`overflow-auto ${recibosFiltrados.length > 50 ? 'max-h-[70vh]' : ''}`}
              >
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox aria-label="Selecionar todos os recibos filtrados"
                          checked={recibosFiltrados.length > 0 && selectedRecibos.size === recibosFiltrados.length}
                          onCheckedChange={toggleSelAllRec} />
                      </TableHead>
                      <TableHead>Nº</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recibosFiltrados.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Sem recibos para os filtros selecionados.
                      </TableCell></TableRow>
                    )}
                    <VirtualRows
                      scrollRef={recibosScrollRef}
                      items={recibosFiltrados}
                      colSpan={9}
                      estimateSize={64}
                      getKey={(r) => r.id}
                      renderRow={(r) => {
                        const venc = r.dataVencimento || '';
                        const atrasoDias = (r.status === 'aberto' || r.status === 'parcial') && venc && venc < today
                          ? diffDays(today, venc) : 0;
                        const isSel = selectedRecibos.has(r.id);
                        return (
                          <TableRow key={r.id}
                            data-state={isSel ? 'selected' : undefined}
                            className={r.status === 'cancelado' ? 'opacity-60' : undefined}>
                            <TableCell>
                              <Checkbox aria-label={`Selecionar recibo ${r.numero}`}
                                checked={isSel}
                                onCheckedChange={() => toggleSelRec(r.id)} />
                            </TableCell>
                            <TableCell className="font-mono text-xs font-bold">{r.numero}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{r.contractNumero}</TableCell>
                            <TableCell className="max-w-[180px] truncate">{r.customerName || '—'}</TableCell>
                            <TableCell className="text-xs">{D(r.dataEmissao)}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-col gap-0.5">
                                <span>{D(r.dataVencimento)}</span>
                                {atrasoDias > 0 && (
                                  <Badge variant="outline" className="text-rose-700 border-rose-200 bg-rose-50 w-fit">
                                    Atrasado {atrasoDias}d
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              <div className="flex flex-col items-end gap-0.5">
                                <span>{BRL(Number(r.valor))}</span>
                                {r.status === 'parcial' && (
                                  <span className="text-[10px] font-normal text-amber-700">
                                    pago {BRL(Number(r.valorPago || 0))}
                                  </span>
                              )}
                              {r.status === 'cancelado' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => voltarParaPendentes(r)}
                                  aria-label="Voltar recibo para pendentes"
                                  title="Voltar para pendentes — como se não tivesse sido faturado"
                                  className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary dark:border-primary/40 transition-colors duration-200"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Voltar p/ pendentes
                                </Button>
                              )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge r={r} />
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button size="sm" variant="ghost" onClick={() => setViewContractId(r.contractId)}
                                aria-label="Ver contrato" title="Ver contrato" className="mr-1">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => baixar(r)} aria-label="Baixar PDF">
                                <Download className="h-3.5 w-3.5 mr-1" /> PDF
                              </Button>
                              {(r.status === 'pago' || r.status === 'parcial') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setReabrirDialog(r)}
                                  aria-label="Reabrir recibo (marcar como pendente)"
                                  title="Reabrir — marcar como pendente"
                                  className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40 transition-colors duration-200"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reabrir
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" aria-label="Mais ações" disabled={working === r.id}>
                                    {working === r.id
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <MoreVertical className="h-3.5 w-3.5" />}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  {r.status !== 'cancelado' && r.status !== 'pago' && (
                                    <DropdownMenuItem onClick={() => setPayDialog(r)}>
                                      <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                                      Registrar pagamento
                                    </DropdownMenuItem>
                                  )}
                                  {(r.status === 'pago' || r.status === 'parcial') && (
                                    <DropdownMenuItem onClick={() => setReabrirDialog(r)}>
                                      <RefreshCw className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                      Reabrir (marcar em aberto)
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => regerar(r)} disabled={r.status === 'cancelado'}>
                                    <RefreshCw className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                    Re-gerar PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditVencDialog(r)} disabled={r.status === 'cancelado'}>
                                    <Pencil className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                    Editar recibo
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {r.status !== 'cancelado' && (
                                    <DropdownMenuItem
                                      onClick={() => setCancelDialog(r)}
                                      className="text-rose-600 focus:text-rose-700"
                                    >
                                      <XCircle className="h-3.5 w-3.5 mr-2" />
                                      Cancelar recibo
                                    </DropdownMenuItem>
                                  )}
                                  {r.status === 'cancelado' && (
                                    <DropdownMenuItem
                                      onClick={() => voltarParaPendentes(r)}
                                      className="text-primary focus:text-primary"
                                    >
                                      <RefreshCw className="h-3.5 w-3.5 mr-2" />
                                      Voltar para pendentes
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      }}
                    />
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 pb-3">
                <PaginationBar
                  page={page} pageSize={pageSize} total={totalRecibos}
                  onPageChange={setPage} onPageSizeChange={setPageSize}
                  pageSizeOptions={[25, 50, 100, 200]}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="sem-validade">
          <Card>
            <CardContent className="p-4 border-b">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-semibold tracking-tight flex items-center gap-2">
                    <ReceiptIcon className="h-4 w-4 text-amber-600" />
                    Recibos sem validade jurídica
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                    Controle interno com numeração própria (0001…). O PDF impresso não indica nada sobre isso.
                    Contratos recorrentes voltam automaticamente para <span className="font-medium text-foreground">Pendentes</span> no próximo mês.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 pl-8 w-[200px] text-sm"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recibosSemValidade.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                          Nenhum recibo sem validade jurídica ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {recibosSemValidade.map((r) => (
                      <TableRow key={r.id} className={r.status === 'cancelado' ? 'opacity-60' : undefined}>
                        <TableCell className="font-mono text-xs font-bold tabular-nums">
                          {r.numeroDisplay || r.numero}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{r.contractNumero}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.customerName || '—'}</TableCell>
                        <TableCell className="text-xs">{D(r.dataEmissao)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {r.periodoInicio && r.periodoFim
                            ? formatPeriodo(r.periodoInicio, r.periodoFim)
                            : formatComp(r.competencia)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{BRL(Number(r.valor))}</TableCell>
                        <TableCell><StatusBadge r={r} /></TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => setViewContractId(r.contractId)}
                            aria-label="Ver contrato" title="Ver contrato" className="mr-1">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => baixar(r)} aria-label="Baixar PDF">
                            <Download className="h-3.5 w-3.5 mr-1" /> PDF
                          </Button>
                          {(r.status === 'pago' || r.status === 'parcial') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReabrirDialog(r)}
                              aria-label="Reabrir recibo (marcar como pendente)"
                              title="Reabrir — marcar como pendente"
                              className="ml-1 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40 transition-colors duration-200"
                            >
                              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reabrir
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" aria-label="Mais ações" disabled={working === r.id}>
                                {working === r.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <MoreVertical className="h-3.5 w-3.5" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {r.status !== 'cancelado' && r.status !== 'pago' && (
                                <DropdownMenuItem onClick={() => setPayDialog(r)}>
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                                  Registrar pagamento
                                </DropdownMenuItem>
                              )}
                              {(r.status === 'pago' || r.status === 'parcial') && (
                                <DropdownMenuItem onClick={() => setReabrirDialog(r)}>
                                  <RefreshCw className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                  Reabrir (marcar em aberto)
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => regerar(r)} disabled={r.status === 'cancelado'}>
                                <RefreshCw className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                Re-gerar PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditVencDialog(r)} disabled={r.status === 'cancelado'}>
                                <Pencil className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                Editar recibo
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {r.status !== 'cancelado' && (
                                <DropdownMenuItem
                                  onClick={() => setCancelDialog(r)}
                                  className="text-rose-600 focus:text-rose-700"
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-2" />
                                  Cancelar recibo
                                </DropdownMenuItem>
                              )}
                              {r.status === 'cancelado' && (
                                <DropdownMenuItem
                                  onClick={() => voltarParaPendentes(r)}
                                  className="text-primary focus:text-primary"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                                  Voltar para pendentes
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 pb-3">
                <PaginationBar
                  page={page} pageSize={pageSize} total={totalRecibos}
                  onPageChange={setPage} onPageSizeChange={setPageSize}
                  pageSizeOptions={[25, 50, 100, 200]}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="clientes">
          <Card>
            <CardContent className="p-4 border-b flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users2 className="h-4 w-4 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Resumo por cliente</h3>
                  <p className="text-xs text-muted-foreground">
                    Agrupado a partir dos recibos filtrados. Cancelados não entram.
                  </p>
                </div>
              </div>
              <Badge variant="outline">{perCustomer.length} cliente(s)</Badge>
            </CardContent>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[70vh]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Recibos</TableHead>
                      <TableHead className="text-right">Total emitido</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead className="text-right">Em aberto</TableHead>
                      <TableHead className="text-right">Vencido</TableHead>
                      <TableHead className="text-right">% inad.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perCustomer.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          Nenhum cliente no filtro atual.
                        </TableCell>
                      </TableRow>
                    )}
                    {perCustomer.map(c => {
                      const inad = c.total > 0 ? (c.aberto / c.total) * 100 : 0;
                      return (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium max-w-[260px] truncate">{c.name}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{c.count}</TableCell>
                          <TableCell className="text-right font-semibold">{BRL(c.total)}</TableCell>
                          <TableCell className="text-right text-emerald-700 dark:text-emerald-400">{BRL(c.recebido)}</TableCell>
                          <TableCell className="text-right text-amber-700 dark:text-amber-400">{BRL(c.aberto)}</TableCell>
                          <TableCell className="text-right">
                            {c.vencido > 0
                              ? <span className="font-semibold text-rose-700 dark:text-rose-400">{BRL(c.vencido)}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={
                                inad >= 30 ? 'border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60'
                                : inad >= 10 ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60'
                                : 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
                              }
                            >
                              {inad.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================== Notas Fiscais ================== */}
        <TabsContent value="notas">
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* KPIs — agregados no servidor (respeitam filtros, independem da página) */}
              {(() => {
                const k = nfKpis;
                const kpis = [
                  { label: 'NFs no período',     value: String(k?.qtdAtivas ?? 0), icon: FileText },
                  { label: 'Total emitido',      value: BRL(k?.totalAtivo ?? 0),   icon: DollarSign },
                  { label: 'Ticket médio',       value: BRL(k?.ticketMedio ?? 0),  icon: ReceiptIcon },
                  { label: 'Canceladas',         value: String(k?.qtdCanceladas ?? 0), icon: XCircle },
                ];
                return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {kpis.map((k) => {
                      const Icon = k.icon;
                      return (
                        <div key={k.label}
                          className="rounded-lg border border-border/60 bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-950/30 dark:to-slate-950 p-3">
                          <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                            <Icon className="h-3 w-3" /> {k.label}
                          </div>
                          <div className="text-lg font-bold mt-1 tabular-nums">{k.value}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                <div className="md:col-span-2 relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={nfSearch} onChange={(e) => setNfSearch(e.target.value)}
                    placeholder="Buscar por nº NF, cliente, contrato..."
                    className="h-9 pl-8"
                  />
                </div>
                <select value={nfStatus} onChange={(e) => setNfStatus(e.target.value as any)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="all">Todos os status</option>
                  <option value="ativa">Ativas</option>
                  <option value="cancelada">Canceladas</option>
                </select>
                <select value={nfForma} onChange={(e) => setNfForma(e.target.value as any)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="all">Toda forma pgto.</option>
                  {Object.entries(INVOICE_FORMA_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <select value={nfCompanyId} onChange={(e) => setNfCompanyId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="all">Todas as empresas</option>
                  {companies.map(c => (<option key={c.id} value={c.id}>{c.razaoSocial}</option>))}
                </select>
                <div className="flex gap-1">
                  <Input type="date" value={nfFrom} onChange={(e) => setNfFrom(e.target.value)} className="h-9" title="Emissão de" />
                  <Input type="date" value={nfTo}   onChange={(e) => setNfTo(e.target.value)}   className="h-9" title="Emissão até" />
                </div>
              </div>

              {/* Ação: exportar dataset filtrado inteiro */}
              <div className="flex justify-end">
                <Button size="sm" variant="outline" disabled={nfExportBusy} onClick={exportAllFilteredNfCsv}>
                  {nfExportBusy
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    : <Download className="h-3.5 w-3.5 mr-1" />}
                  Exportar CSV (filtro)
                </Button>
              </div>

              {/* Tabela */}
              <div className="overflow-auto rounded-md border border-border/60">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Nº NF</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Forma pgto.</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoicesLoading ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando notas fiscais…</TableCell></TableRow>
                    ) : invoices.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma nota fiscal encontrada.</TableCell></TableRow>
                    ) : invoices.map(i => (
                      <TableRow key={i.id} className={i.status === 'cancelada' ? 'opacity-60' : ''}>
                        <TableCell className="font-mono text-xs">
                          {i.numero}{i.serie ? <span className="text-muted-foreground"> · {i.serie}</span> : null}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{i.customerName || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{i.contractNumero || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{i.companyRazaoSocial || '—'}</TableCell>
                        <TableCell className="text-xs tabular-nums">{D(i.dataEmissao)}</TableCell>
                        <TableCell className="text-xs">{i.formaPagamento ? INVOICE_FORMA_LABEL[i.formaPagamento] : '—'}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{BRL(Number(i.valor))}</TableCell>
                        <TableCell>
                          {i.status === 'ativa'
                            ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border">Ativa</Badge>
                            : <Badge className="bg-rose-100 text-rose-700 border-rose-200 border">Cancelada</Badge>}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap space-x-1">
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => window.open(toAuthedUrl(i.pdfUrl), '_blank', 'noopener,noreferrer')}
                            title="Ver PDF">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost" asChild title="Baixar PDF">
                            <a href={toAuthedUrl(i.pdfUrl)}
                              rel="noopener noreferrer"
                              download={i.pdfOriginalFilename || `nf-${i.numero}.pdf`}>
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>

                          {i.status === 'ativa' && (
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => { setNfCancelTarget(i); setNfCancelMotivo(''); }}
                              title="Cancelar NF"
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <PaginationBar
                page={nfPage} pageSize={nfPageSize} total={nfTotal}
                onPageChange={setNfPage} onPageSizeChange={setNfPageSize}
                pageSizeOptions={[25, 50, 100, 200]}
              />
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="medicoes">
          {(() => {
            const totalMes = medKpis?.totalValor ?? 0;
            const ticket = medKpis?.ticketMedio ?? 0;
            const clientesDistintos = medKpis?.clientesDistintos ?? 0;
            const delta = medicoesPrevMonthTotal !== null && medicoesPrevMonthTotal > 0
              ? ((totalMes - medicoesPrevMonthTotal) / medicoesPrevMonthTotal) * 100
              : null;
            // Filtragem server-side (competencia + search debounce).
            const filtered = medicoes;
            const filteredHasFilter = !!medicoesSearch;

            return (
              <div className="space-y-4">
                {/* KPIs — agregados server-side (independem da página) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card><CardContent className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" /> Total do mês
                    </div>
                    <div className="text-xl font-bold tabular-nums mt-1">{BRL(totalMes)}</div>
                    {delta !== null && (
                      <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {Math.abs(delta).toFixed(1)}% vs mês anterior
                      </div>
                    )}
                  </CardContent></Card>
                  <Card><CardContent className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Nº medições
                    </div>
                    <div className="text-xl font-bold tabular-nums mt-1">{medKpis?.total ?? 0}</div>
                  </CardContent></Card>
                  <Card><CardContent className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BarChart3 className="h-3.5 w-3.5" /> Ticket médio
                    </div>
                    <div className="text-xl font-bold tabular-nums mt-1">{BRL(ticket)}</div>
                  </CardContent></Card>
                  <Card><CardContent className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users2 className="h-3.5 w-3.5" /> Clientes
                    </div>
                    <div className="text-xl font-bold tabular-nums mt-1">{clientesDistintos}</div>
                  </CardContent></Card>
                </div>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    {/* Filtros */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar nº, cliente, empresa…"
                          className="h-9 pl-7 w-64"
                          value={medicoesSearch}
                          onChange={(e) => setMedicoesSearch(e.target.value)}
                        />
                      </div>
                      {filteredHasFilter && (
                        <Button size="sm" variant="ghost" onClick={() => setMedicoesSearch('')}>
                          <X className="h-3.5 w-3.5 mr-1" /> Limpar
                        </Button>
                      )}
                      <div className="text-xs text-muted-foreground ml-1">
                        {medicoesLoading ? 'Carregando…' : `${medTotal} em ${formatComp(competencia)}`}
                      </div>
                      <div className="ml-auto flex gap-2">
                        <Button variant="outline" size="sm" disabled={medExportBusy} onClick={exportAllFilteredMedicoesCsv}>
                          {medExportBusy
                            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            : <Download className="h-4 w-4 mr-1" />}
                          Exportar CSV (filtro)
                        </Button>
                        <Button variant="outline" size="sm" onClick={loadMedicoes} disabled={medicoesLoading}>
                          <RefreshCw className={`h-4 w-4 mr-1 ${medicoesLoading ? 'animate-spin' : ''}`} /> Atualizar
                        </Button>
                        <Button size="sm" onClick={() => { setMedicaoEditing(null); setMedicaoDialogOpen(true); }}>
                          <Plus className="h-4 w-4 mr-1" /> Nova medição
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nº</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead className="text-right">Itens</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.length === 0 && !medicoesLoading && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                {filteredHasFilter
                                  ? 'Nenhuma medição encontrada com esses filtros.'
                                  : <>Nenhuma medição em {formatComp(competencia)}. Clique em <b>Nova medição</b> para começar.</>}
                              </TableCell>
                            </TableRow>
                          )}
                          {filtered.map((m) => (
                            <TableRow key={m.id} className="cursor-pointer hover:bg-muted/40"
                              onClick={() => { setMedicaoViewId(m.id); setMedicaoViewOpen(true); }}>
                              <TableCell className="font-mono text-xs">{m.numero}</TableCell>
                              <TableCell>
                                <div className="font-medium">{m.customerName || m.clienteNome || '—'}</div>
                                <div className="text-xs text-muted-foreground">{m.customerDocument || m.clienteDocumento || ''}</div>
                              </TableCell>
                              <TableCell className="text-xs">{m.companyRazaoSocial || '—'}</TableCell>
                              <TableCell className="text-xs">
                                {(m.periodoInicio || m.periodoFim) ? formatPeriodo(m.periodoInicio, m.periodoFim) : (m.competencia || '—')}
                              </TableCell>
                              <TableCell className="text-right text-xs">{m.itensCount ?? '—'}</TableCell>
                              <TableCell className="text-right font-medium tabular-nums">{BRL(Number(m.total || 0))}</TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-1">
                                  <Button size="icon" variant="ghost" title="Baixar PDF"
                                    onClick={async () => {
                                      try {
                                        const full = await medicoesService.get(m.id);
                                        await generateMedicaoPdf(full as any);
                                      } catch (e: any) { toast.error(e.message); }
                                    }}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" title="Duplicar"
                                    onClick={async () => {
                                      try {
                                        const full = await medicoesService.get(m.id);
                                        const dup: any = {
                                          ...full,
                                          id: undefined,
                                          numero: undefined,
                                          competencia,
                                          items: (full.items || []).map(it => ({ ...it, id: undefined })),
                                        };
                                        setMedicaoEditing(null);
                                        setMedicaoDialogOpen(true);
                                        // preenche via rascunho local para o dialog restaurar
                                        try {
                                          localStorage.setItem('medicao:draft:v1', JSON.stringify({
                                            customerId: full.customerId,
                                            companyId: full.companyId,
                                            periodoIni: '', periodoFim: '',
                                            desconto: Number(full.desconto || 0),
                                            observacoes: full.observacoes || '',
                                            rows: (full.items || []).map((it, i) => ({
                                              key: `dup-${i}`,
                                              contractId: it.contractId, contractNumero: it.contractNumero,
                                              descricao: it.descricao, quantidade: it.quantidade,
                                              unidade: it.unidade || 'UN', valorUnit: it.valorUnit,
                                              descontoItem: it.descontoItem || 0,
                                              valorTotal: it.valorTotal || 0,
                                              periodoInicio: null, periodoFim: null,
                                            })),
                                          }));
                                        } catch {}
                                        toast(`Duplicando ${full.numero} — restaure o rascunho no dialog`);
                                      } catch (e: any) { toast.error(e.message); }
                                    }}>
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" title="Editar"
                                    onClick={async () => {
                                      try {
                                        const full = await medicoesService.get(m.id);
                                        setMedicaoEditing(full);
                                        setMedicaoDialogOpen(true);
                                      } catch (e: any) { toast.error(e.message); }
                                    }}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" title="Excluir"
                                    onClick={async () => {
                                      const ok = await confirmDialog({
                                        title: `Excluir medição ${m.numero}?`,
                                        description: 'Esta ação não pode ser desfeita.',
                                        confirmLabel: 'Excluir', destructive: true,
                                      });
                                      if (!ok) return;
                                      try {
                                        await medicoesService.remove(m.id);
                                        toast.success('Medição excluída');
                                        loadMedicoes();
                                      } catch (e: any) { toast.error(e.message); }
                                    }}>
                                    <Trash2 className="h-4 w-4 text-rose-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <PaginationBar
                      page={medPage} pageSize={medPageSize} total={medTotal}
                      onPageChange={setMedPage} onPageSizeChange={setMedPageSize}
                      pageSizeOptions={[25, 50, 100, 200]}
                    />
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </TabsContent>


        <TabsContent value="gastos">
          <GastosPanel />
        </TabsContent>
      </Tabs>

      {/* Dialogs de Medição */}
      <MedicaoDialog
        open={medicaoDialogOpen}
        onOpenChange={setMedicaoDialogOpen}
        competencia={competencia}
        periodoInicioDefault={undefined}
        periodoFimDefault={undefined}
        editing={medicaoEditing}
        onSaved={() => loadMedicoes()}
      />
      <MedicaoViewDialog
        medicaoId={medicaoViewId}
        open={medicaoViewOpen}
        onOpenChange={setMedicaoViewOpen}
        onEdit={(m) => {
          setMedicaoViewOpen(false);
          setMedicaoEditing(m);
          setMedicaoDialogOpen(true);
        }}
      />

      {/* ============ Vincular Nota Fiscal (Marcar pago) ============ */}
      <VincularNfDialog
        open={!!nfDialogTarget}
        onOpenChange={(o) => { if (!o) setNfDialogTarget(null); }}
        pending={nfDialogTarget}
        competencia={nfDialogTarget ? compOf(nfDialogTarget) : competencia}
        onSuccess={async ({ contractId, competencia: billedComp }) => {
          acknowledgeGenerated(contractId, billedComp);
          setNfDialogTarget(null);
          await Promise.all([loadPendentes(), loadInvoices()]);
          setActiveTab('notas');
        }}
      />

      {/* Cancelar NF */}
      <Dialog open={!!nfCancelTarget} onOpenChange={(o) => { if (!o) { setNfCancelTarget(null); setNfCancelMotivo(''); } }}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" /> Cancelar Nota Fiscal
            </DialogTitle>
            <DialogDescription>
              A NF <span className="font-semibold text-foreground">{nfCancelTarget?.numero}</span>{' '}
              será marcada como cancelada e o contrato voltará à lista de pendentes desta competência.
              O PDF é preservado no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs" htmlFor="nf-cancel-motivo">Motivo *</Label>
            <Textarea
              id="nf-cancel-motivo"
              autoFocus
              value={nfCancelMotivo}
              onChange={(e) => setNfCancelMotivo(e.target.value)}
              placeholder="Ex.: NF emitida com dados errados, cliente pediu reemissão…"
              className="min-h-[90px]"
              aria-invalid={!nfCancelMotivo.trim()}
              aria-describedby="nf-cancel-motivo-help"
            />
            <p id="nf-cancel-motivo-help" className="text-[11px] text-muted-foreground">
              O motivo fica registrado no histórico para auditoria.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setNfCancelTarget(null); setNfCancelMotivo(''); }}>
              Voltar
            </Button>
            <Button
              onClick={async () => {
                if (!nfCancelTarget) return;
                if (!nfCancelMotivo.trim()) { toast.error('Informe o motivo.'); return; }
                try {
                  await invoicesService.cancel(nfCancelTarget.id, nfCancelMotivo.trim());
                  toast.success(`NF ${nfCancelTarget.numero} cancelada`);
                  setNfCancelTarget(null);
                  setNfCancelMotivo('');
                  await Promise.all([loadInvoices(), loadPendentes()]);
                } catch (e: any) {
                  toast.error(e?.message || 'Falha ao cancelar NF');
                }
              }}
              disabled={!nfCancelMotivo.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <XCircle className="h-4 w-4 mr-1" /> Cancelar NF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnifiedPreviewDialog 
        input={unifPreview}
        onClose={() => setUnifPreview(null)}
        onConfirm={confirmUnified}
        working={batchWorking}
      />





      {/* Barra flutuante de ações em lote — recibos */}
      {selectedRecibos.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none flex justify-center px-3 pb-4 md:pb-6 animate-in slide-in-from-bottom-4 duration-200">
          <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-border bg-card/95 backdrop-blur shadow-xl px-3 py-2.5 md:px-4 md:py-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 pr-2 mr-auto">
              <Badge className="bg-indigo-600 hover:bg-indigo-700">{selectedRecibos.size}</Badge>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">selecionado(s)</span>
            </div>
            <Button size="sm" variant="outline" disabled={batchWorking}
              onClick={() => exportRecibosCsv(recibosFiltrados.filter(r => selectedRecibos.has(r.id)))}
              className="transition-colors duration-200">
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" disabled={batchWorking}
              onClick={batchReopen}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40 transition-colors duration-200">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reabrir
            </Button>
            <Button size="sm" disabled={batchWorking} onClick={batchMarkPaid}
              className="bg-emerald-600 hover:bg-emerald-700 transition-colors duration-200">
              {batchWorking
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Marcar pago
            </Button>
            <Button size="sm" variant="outline" disabled={batchWorking}
              onClick={() => setBatchCancelOpen(true)}
              className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-800/60 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors duration-200">
              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedRecibos(new Set())}
              className="transition-colors duration-200" aria-label="Limpar seleção">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Diálogo de cancelamento em lote */}
      <Dialog open={batchCancelOpen} onOpenChange={(o) => { if (!o) { setBatchCancelOpen(false); setBatchCancelMotivo(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" /> Cancelar {selectedRecibos.size} recibo(s)
            </DialogTitle>
            <DialogDescription>
              O motivo abaixo será registrado em todos os recibos selecionados. Recibos já cancelados serão ignorados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="batch-cancel-motivo" className="text-xs">Motivo</Label>
            <Textarea
              id="batch-cancel-motivo"
              value={batchCancelMotivo}
              onChange={(e) => setBatchCancelMotivo(e.target.value)}
              placeholder="Ex.: erro de digitação, duplicidade, renegociação…"
              className="min-h-[90px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBatchCancelOpen(false); setBatchCancelMotivo(''); }}>
              Voltar
            </Button>
            <Button
              onClick={batchCancelSubmit}
              disabled={batchWorking || !batchCancelMotivo.trim()}
              className="bg-rose-600 hover:bg-rose-700 transition-colors duration-200"
            >
              {batchWorking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
              Cancelar recibos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PayDialog
        receipt={payDialog}
        onClose={() => setPayDialog(null)}
        onSaved={async () => { setPayDialog(null); await load(); }}
      />
      <CancelDialog
        receipt={cancelDialog}
        onClose={() => setCancelDialog(null)}
        onCanceled={async () => { setCancelDialog(null); await load(); }}
      />
      <Dialog open={!!reabrirDialog} onOpenChange={(o) => !o && setReabrirDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir recibo?</DialogTitle>
            <DialogDescription>
              Recibo <strong>{reabrirDialog?.numero}</strong> ({BRL(Number(reabrirDialog?.valor || 0))})
              voltará para o status <strong>Em aberto</strong> e o pagamento registrado será removido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReabrirDialog(null)}>Cancelar</Button>
            <Button onClick={handleReabrir} disabled={working === reabrirDialog?.id}>
              {working === reabrirDialog?.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditVencimentoDialog
        receipt={editVencDialog}
        onClose={() => setEditVencDialog(null)}
        onSaved={async () => { setEditVencDialog(null); await load(); }}
      />

      {/* Exportar recibos por período em ZIP */}
      <Dialog open={zipOpen} onOpenChange={(o) => { if (!zipBusy) setZipOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar recibos por período</DialogTitle>
            <DialogDescription>
              Baixe todos os recibos emitidos em um intervalo de datas em um único arquivo ZIP.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data inicial</Label>
                <Input type="date" value={zipFrom} onChange={(e) => setZipFrom(e.target.value)} disabled={zipBusy} />
              </div>
              <div>
                <Label className="text-xs">Data final</Label>
                <Input type="date" value={zipTo} onChange={(e) => setZipTo(e.target.value)} disabled={zipBusy} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground select-none">
              <Checkbox
                checked={zipIncludeSV}
                onCheckedChange={(v) => setZipIncludeSV(Boolean(v))}
                disabled={zipBusy}
              />
              Incluir recibos sem validade jurídica
            </label>
            {zipProgress && (
              <div className="text-xs text-muted-foreground">
                Gerando {zipProgress.done} de {zipProgress.total} recibo(s)…
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZipOpen(false)} disabled={zipBusy}>Cancelar</Button>
            <Button onClick={exportRecibosZip} disabled={zipBusy || !zipFrom || !zipTo}>
              {zipBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              Gerar ZIP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContractViewDialog
        contractId={viewContractId}
        onClose={() => setViewContractId(null)}
      />

    </div>
  );
};

// ========================= status badge =========================
const StatusBadge: React.FC<{ r: Receipt }> = ({ r }) => {
  if (r.status === 'cancelado') return <Badge variant="outline" className="text-slate-500 border-slate-300">Cancelado</Badge>;
  if (r.status === 'pago')      return null;
  if (r.status === 'parcial')   return <Badge className="bg-amber-500 hover:bg-amber-600">Parcial</Badge>;
  return <Badge variant="secondary">Em aberto</Badge>;
};

// ========================= KPI / chip =========================
const KPI = ({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: any; accent: string;
}) => (
  <Card className="border-0 shadow-md overflow-hidden">
    <CardContent className="p-0">
      <div className={`bg-gradient-to-br ${accent} p-4 text-white transition-transform duration-200 hover:scale-[1.01]`}>
        <Icon className="h-5 w-5 opacity-80 mb-2" />
        <p className="text-xs uppercase tracking-wider opacity-80">{label}</p>
        <p className="text-2xl font-bold mt-1 break-words leading-tight">{value}</p>
        {sub && <p className="text-[11px] opacity-80 mt-1">{sub}</p>}
      </div>
    </CardContent>
  </Card>
);

const QuickChip: React.FC<{
  active?: boolean; tone?: 'rose' | 'amber'; onClick?: () => void; children: React.ReactNode;
}> = ({ active, tone, onClick, children }) => {
  const base = 'inline-flex items-center px-3 h-7 rounded-full text-xs font-medium border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  let cls = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
  if (active && tone === 'rose')  cls = 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700';
  else if (active && tone === 'amber') cls = 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600';
  else if (active) cls = 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700';
  return <button type="button" onClick={onClick} className={`${base} ${cls}`}>{children}</button>;
};

// ========================= 12-month chart =========================
const ChartCard: React.FC<{ series: ReceiptsSummaryPoint[] }> = ({ series }) => {
  const data = useMemo(() => series.map(s => ({ ...s, label: formatComp(s.competencia) })), [series]);
  if (!data.length) return null;
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-700">Receita × Gasto × Resultado (12 meses)</h2>
          </div>
        </div>
        <div className="h-[260px] w-full">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                formatter={(v: any) => BRL(Number(v))}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="recebido" name="Recebido" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gasto"    name="Gasto"    fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="resultado" name="Resultado" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// ========================= GerarReciboPopover =========================
// Popover compacto: mostra o período que será calculado automaticamente
// (data de início do contrato + 30 dias, dentro do mês da competência)
// e permite definir manualmente o período e vencimento.
const GerarReciboPopover: React.FC<{
  pending: PendingReceipt;
  working: boolean;
  competencia: string;
  onConfirm: (semValidade: boolean, dataVencimento?: string, periodo?: { inicio: string; fim: string }, cno?: string, enderecoObra?: string) => void;
  children: React.ReactNode;
}> = ({ pending, working, competencia, onConfirm, children }) => {
  const [open, setOpen] = useState(false);
  const [semValidade, setSemValidade] = useState(false);
  const [overrideVenc, setOverrideVenc] = useState(false);
  const [vencManual, setVencManual] = useState('');
  const [overridePeriodo, setOverridePeriodo] = useState(false);
  const [perIniManual, setPerIniManual] = useState('');
  const [perFimManual, setPerFimManual] = useState('');
  const [cnoManual, setCnoManual] = useState('');
  const [enderecoManual, setEnderecoManual] = useState('');

  // Vencimento padrão (mesma lógica do backend): dia do contrato no mês da competência.
  const vencPadrao = useMemo(() => {
    const [ano, mes] = competencia.split('-').map(Number);
    if (!ano || !mes) return '';
    const ultimo = new Date(ano, mes, 0).getDate();
    const dia = Math.min(Math.max(1, Number(pending.diaVencimento || 10)), ultimo);
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }, [competencia, pending.diaVencimento]);

  const periodoPadrao = useMemo(() => computeCompetenciaPeriodo(pending.dataInicio, competencia), [pending.dataInicio, competencia]);

  useEffect(() => {
    if (!open) return;
    setSemValidade(false);
    setOverrideVenc(false);
    setVencManual(vencPadrao);
    setOverridePeriodo(false);
    setPerIniManual(periodoPadrao.inicio);
    setPerFimManual(periodoPadrao.fim);
    setCnoManual(pending.cno || '');
    setEnderecoManual(pending.enderecoObra || pending.localEvento || '');
  }, [open, pending.contractId, vencPadrao, periodoPadrao, pending.cno, pending.enderecoObra, pending.localEvento]);

  const periodo = overridePeriodo ? { inicio: perIniManual, fim: perFimManual } : periodoPadrao;
  const dataInicioContrato = pending.dataInicio ? (pending.dataInicio as string).slice(0, 10) : '';

  return (
    <Popover open={open} onOpenChange={(o) => !working && setOpen(o)}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[340px] p-0 overflow-hidden border-border/60 shadow-lg"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/60 bg-muted/40">
          <p className="text-sm font-semibold leading-tight tracking-tight">Gerar recibo</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            O período é calculado automaticamente, mas você pode editá-lo abaixo.
          </p>
        </div>

        <div className="p-4 space-y-3">
          {/* Preview do período */}
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 space-y-2">
            <label htmlFor={`gr-per-${pending.contractId}`} className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                id={`gr-per-${pending.contractId}`}
                checked={overridePeriodo}
                onCheckedChange={(v) => setOverridePeriodo(!!v)}
                className="mt-0.5"
              />
              <div className="text-[11px] leading-snug">
                <div className="font-medium text-foreground">Definir período manualmente</div>
                <div className="text-muted-foreground">
                  Padrão: <span className="tabular-nums font-medium text-foreground">{formatPeriodo(periodoPadrao.inicio, periodoPadrao.fim)}</span>
                </div>
              </div>
            </label>
            {overridePeriodo ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">Início</Label>
                  <Input
                    type="date"
                    value={perIniManual}
                    onChange={(e) => setPerIniManual(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">Fim</Label>
                  <Input
                    type="date"
                    value={perFimManual}
                    onChange={(e) => setPerFimManual(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-md px-2 py-1.5 border bg-muted/20 border-border/40 space-y-1">
                <div className="text-sm font-semibold text-foreground tabular-nums">
                  {formatPeriodo(periodoPadrao.inicio, periodoPadrao.fim)}
                </div>
                {dataInicioContrato && (
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-2.5 w-2.5" />
                    Contrato iniciado em <span className="font-medium text-foreground">{formatDateBR(dataInicioContrato)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vencimento (override manual opcional) */}
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 space-y-2">
            <label htmlFor={`gr-ov-${pending.contractId}`} className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                id={`gr-ov-${pending.contractId}`}
                checked={overrideVenc}
                onCheckedChange={(v) => setOverrideVenc(!!v)}
                className="mt-0.5"
              />
              <div className="text-[11px] leading-snug">
                <div className="font-medium text-foreground">Definir vencimento manualmente</div>
                <div className="text-muted-foreground">
                  Padrão: <span className="tabular-nums font-medium text-foreground">{vencPadrao ? formatDateBR(vencPadrao) : '—'}</span> (dia {pending.diaVencimento} do contrato).
                </div>
              </div>
            </label>
            {overrideVenc && (
              <Input
                type="date"
                value={vencManual}
                onChange={(e) => setVencManual(e.target.value)}
                className="h-8 text-sm"
              />
            )}
          </div>

          {/* CNO / Endereço */}
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">CNO / Ordem de Compra</Label>
              <Input
                value={cnoManual}
                onChange={(e) => setCnoManual(e.target.value)}
                placeholder="Opcional..."
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">Endereço da Obra/Evento</Label>
              <Textarea
                value={enderecoManual}
                onChange={(e) => setEnderecoManual(e.target.value)}
                placeholder="Endereço específico para este recibo..."
                className="min-h-[60px] text-xs resize-none"
              />
            </div>
          </div>

          {/* Toggle: sem validade jurídica */}
          <div className="space-y-2">
            <label
              htmlFor={`gr-sv-${pending.contractId}`}
              className={
                'flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors duration-200 ' +
                (semValidade
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30'
                  : 'border-border/60 bg-muted/30 hover:bg-muted/50')
              }
            >
              <Checkbox
                id={`gr-sv-${pending.contractId}`}
                checked={semValidade}
                onCheckedChange={(v) => setSemValidade(!!v)}
                className="mt-0.5"
              />
              <div className="text-[11px] leading-snug">
                <div className="font-medium text-foreground">Recibo sem validade jurídica</div>
                <div className="text-muted-foreground">
                  Numeração própria interna (0001…). Vai para a aba <span className="font-medium text-foreground">Sem validade</span>. No próximo mês, este contrato volta para pendentes normalmente.
                </div>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={working}
              className="h-8 transition-colors duration-200"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const venc = overrideVenc && /^\d{4}-\d{2}-\d{2}$/.test(vencManual) ? vencManual : undefined;
                const per = overridePeriodo ? { inicio: perIniManual, fim: perFimManual } : undefined;
                onConfirm(semValidade, venc, per, cnoManual, enderecoManual);
                setOpen(false);
              }}
              disabled={
                working || 
                (overrideVenc && !/^\d{4}-\d{2}-\d{2}$/.test(vencManual)) ||
                (overridePeriodo && (!/^\d{4}-\d{2}-\d{2}$/.test(perIniManual) || !/^\d{4}-\d{2}-\d{2}$/.test(perFimManual)))
              }
              className={
                'h-8 transition-colors duration-200 ' +
                (semValidade
                  ? 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500'
                  : 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500')
              }
            >
              {working ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ReceiptIcon className="h-3.5 w-3.5 mr-1" />}
              {semValidade ? 'Gerar (Sem Validade)' : 'Gerar Recibo'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};


const ReceiptUnifiedActions: React.FC<{
  selected: Set<string>;
  pendentes: PendingReceipt[];
  competencia: string;
  companies: ErpCompany[];
  batchWorking: boolean;
  handleUnifiedAction: (sv: boolean) => void;
}> = ({ handleUnifiedAction }) => {
  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      <Button
        size="sm"
        variant="outline"
        className="w-full text-amber-600 border-amber-200 hover:bg-amber-50"
        onClick={() => handleUnifiedAction(true)}
      >
        Unificado (Sem Validade)
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="w-full text-emerald-600 border-emerald-200 hover:bg-emerald-50"
        onClick={() => handleUnifiedAction(false)}
      >
        Unificado (Comum)
      </Button>
    </div>
  );
};





const UnifiedPreviewDialog: React.FC<{
  input: UnifiedReceiptInput | null;
  onClose: () => void;
  onConfirm: (final: UnifiedReceiptInput) => void;
  working: boolean;
}> = ({ input, onClose, onConfirm, working }) => {
  const [dataEmissao, setDataEmissao] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [obs, setObs] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!input) return;
    setDataEmissao(input.dataEmissao);
    setDataVencimento(input.dataVencimento || '');
    setObs('');
    setItems(input.items || []);
    setEditingItemIdx(null);
  }, [input]);

  const updateItem = (idx: number, field: string, val: any) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  if (!input) return null;

  return (
    <Dialog open={!!input} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pré-visualização do Recibo Unificado</DialogTitle>
          <DialogDescription>
            {input.items.length} contrato(s) selecionados para {input.customer.name}.
            O PDF será gerado com numeração comum.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1 px-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data de Emissão</Label>
              <Input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data de Vencimento</Label>
              <Input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações (aparece no PDF)</Label>
            <Textarea 
              value={obs} 
              onChange={e => setObs(e.target.value)} 
              placeholder="Ex: Referente a medição extra de agosto..."
              rows={2}
            />
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border text-sm">
            <div className="font-semibold mb-3 flex items-center justify-between">
              <span>Períodos por Contrato:</span>
              <span className="text-[10px] text-muted-foreground font-normal">Edite individualmente se necessário</span>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="p-2 border rounded-md bg-background space-y-2 shadow-sm">
                  <div className="flex flex-col gap-1 relative">
                    <span className="font-medium text-xs">
                      C. {it.contractNumero}
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-tight italic pr-16">
                      {it.descricao}
                    </span>
                    <span className="font-mono text-xs text-indigo-600 font-bold absolute top-0 right-0">{BRL(it.valor)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Início</Label>
                      <Input 
                        type="date" 
                        value={it.periodoInicio || ''} 
                        onChange={e => updateItem(idx, 'periodoInicio', e.target.value)}
                        className="h-7 text-[11px]"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Fim</Label>
                      <Input 
                        type="date" 
                        value={it.periodoFim || ''} 
                        onChange={e => updateItem(idx, 'periodoFim', e.target.value)}
                        className="h-7 text-[11px]"
                      />
                    </div>
                  </div>

                  <div className="pt-1 border-t mt-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[10px] w-full justify-start text-muted-foreground hover:text-indigo-600"
                      onClick={() => setEditingItemIdx(editingItemIdx === idx ? null : idx)}
                    >
                      {editingItemIdx === idx ? <X className="h-3 w-3 mr-1" /> : <Pencil className="h-3 w-3 mr-1" />}
                      {editingItemIdx === idx ? 'Fechar edição de local' : 'Editar CNO / Endereço'}
                    </Button>

                    {editingItemIdx === idx && (
                      <div className="space-y-2 mt-2 p-2 bg-slate-50 dark:bg-slate-900 rounded border border-indigo-100 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div>
                          <Label className="text-[10px]">Endereço Singular (Obra/Evento)</Label>
                          <Input 
                            value={it.enderecoObra || ''} 
                            onChange={e => updateItem(idx, 'enderecoObra', e.target.value)}
                            placeholder="Endereço completo da obra..."
                            className="h-7 text-[11px]"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">CNO / Ordem de Compra</Label>
                          <Input 
                            value={it.cno || ''} 
                            onChange={e => updateItem(idx, 'cno', e.target.value)}
                            placeholder="Número do CNO..."
                            className="h-7 text-[11px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-4 pt-2 border-t font-bold text-indigo-600">
              <span>TOTAL UNIFICADO</span>
              <span>{BRL(input.total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose} disabled={working}>Cancelar</Button>
          <Button 
            disabled={working}
            className={input.semValidade ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            onClick={() => onConfirm({
              ...input,
              dataEmissao,
              dataVencimento,
              periodoInicio: null,
              periodoFim: null,
              items: items.map(it => ({
                ...it,
                // As edições já estão no estado 'items' devido ao updateItem
              })),
            })}
          >
            {working ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ReceiptIcon className="h-4 w-4 mr-1" />}
            Confirmar e Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PayDialog: React.FC<{
  receipt: Receipt | null; onClose: () => void; onSaved: () => void;
}> = ({ receipt, onClose, onSaved }) => {
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [data, setData]   = useState(todayISO());
  const [valor, setValor] = useState<number>(0);
  const [parcial, setParcial] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!receipt) return;
    setForma((receipt.formaPagamento as FormaPagamento) || 'pix');
    setData(receipt.dataPagamento || todayISO());
    setValor(Number(receipt.valor || 0));
    setParcial(receipt.status === 'parcial');
  }, [receipt]);

  if (!receipt) return null;
  const total = Number(receipt.valor || 0);
  const valorFinal = parcial ? Math.min(valor, total) : total;

  const submit = async () => {
    setSaving(true);
    try {
      await receiptsExtraService.togglePaid(receipt.id, true, {
        formaPagamento: forma,
        dataPagamento: data,
        valorPago: valorFinal,
      });
      toast.success(valorFinal >= total ? 'Pagamento registrado' : 'Baixa parcial registrada');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            Recibo <strong>{receipt.numero}</strong> — total {BRL(total)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <SearchableSelect
                value={forma}
                onValueChange={(v: any) => setForma(v)}
                placeholder="Forma"
                options={(Object.keys(FORMA_LABEL) as FormaPagamento[]).map(k => ({
                  value: k,
                  label: FORMA_LABEL[k],
                }))}
              />
            </div>
            <div>
              <Label className="text-xs">Data do pagamento</Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={parcial} onCheckedChange={(c) => setParcial(!!c)} />
            <span>Baixa parcial</span>
          </label>
          {parcial && (
            <div>
              <Label className="text-xs">Valor pago (R$)</Label>
              <Input type="number" step="0.01" min={0} max={total} value={valor}
                onChange={e => setValor(Number(e.target.value))} />
              <p className="text-[11px] text-slate-500 mt-1">
                Saldo em aberto: <strong>{BRL(Math.max(0, total - valorFinal))}</strong>
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || valorFinal <= 0}
            className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ========================= CancelDialog =========================
const CancelDialog: React.FC<{
  receipt: Receipt | null; onClose: () => void; onCanceled: () => void;
}> = ({ receipt, onClose, onCanceled }) => {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setMotivo(''); }, [receipt]);
  if (!receipt) return null;
  const submit = async () => {
    if (!motivo.trim()) { toast.error('Informe o motivo do cancelamento'); return; }
    setSaving(true);
    try {
       const result = await receiptsService.cancel(receipt.id, motivo.trim());
       toast.success(result.unified
         ? `${result.affected} recibos do grupo unificado cancelados`
         : 'Recibo cancelado');
      onCanceled();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-rose-600 flex items-center gap-2">
            <XCircle className="h-5 w-5" /> Cancelar recibo
          </DialogTitle>
          <DialogDescription>
            {receipt.unifiedGroupId ? 'Todo o grupo unificado' : <>Recibo <strong>{receipt.numero}</strong></>} será marcado como <strong>cancelado</strong>.
            O histórico e a numeração são preservados.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs">Motivo *</Label>
          <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
            placeholder="Ex.: erro de emissão, duplicado, cliente cancelou contrato…" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button onClick={submit} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
            Cancelar recibo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ========================= EditVencimentoDialog =========================
// Edição ampla de um recibo já emitido: datas, valores, numeração, dados do
// cliente/empresa e descrição impressa. Tudo é gravado no snapshot do recibo
// (o PDF lê o snapshot), exceto CNO/Endereço que também sincronizam o contrato.
const EditVencimentoDialog: React.FC<{
  receipt: Receipt | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}> = ({ receipt, onClose, onSaved }) => {
  const [dataEmissao, setDataEmissao] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [valor, setValor] = useState<string>('');
  const [numeroDisplay, setNumeroDisplay] = useState('');
  const [cno, setCno] = useState('');
  const [enderecoObra, setEnderecoObra] = useState('');
  const [descricao, setDescricao] = useState('');
  const [contratoNumero, setContratoNumero] = useState('');
  const [valorLocacao, setValorLocacao] = useState('');
  const [freteIncluso, setFreteIncluso] = useState('');
  const [cust, setCust] = useState<Record<string, string>>({});
  const [comp, setComp] = useState<Record<string, string>>({});
  const [unifiedItems, setUnifiedItems] = useState<Array<{
    id: string;
    numero: string;
    contractNumero: string;
    descricao: string;
    periodoInicio: string;
    periodoFim: string;
    cno: string;
    enderecoObra: string;
    valor: string;
    valorLocacao: string;
    freteIncluso: string;
  }>>([]);
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Normaliza qualquer formato vindo da API (Date, ISO com hora, 'YYYY-MM-DD')
  // para o formato aceito por <input type="date">. Sem isso o campo vinha vazio
  // e o save gravava período nulo — o recibo saía com "—".
  const toDateInput = (v: unknown): string => {
    if (!v) return '';
    if (v instanceof Date) {
      return isNaN(v.getTime())
        ? ''
        : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    }
    const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  };
  // Guarda os valores originais para só enviar período quando de fato mudar.
  const [origPeriodo, setOrigPeriodo] = useState<{ ini: string; fim: string }>({ ini: '', fim: '' });

  const receiptToUnifiedItem = (r: Receipt) => {
    const snap: any = r.snapshot || {};
    const ct = snap.contract || {};
    const pi = toDateInput(r.periodoInicio) || toDateInput(snap?.periodo?.inicio);
    const pf = toDateInput(r.periodoFim) || toDateInput(snap?.periodo?.fim);
    const frete = Number(snap.freteIncluso || 0);
    const locacao = Number(snap.valorLocacao ?? (Number(r.valor || 0) - frete));
    return {
      id: r.id,
      numero: r.numeroDisplay || r.numero,
      contractNumero: ct.numero || r.contractNumero || '',
      descricao: ct.descricao || '',
      periodoInicio: pi,
      periodoFim: pf,
      cno: ct.cno || '',
      enderecoObra: ct.enderecoObra || ct.localEvento || '',
      valor: String(Number(r.valor || 0)),
      valorLocacao: String(Number.isFinite(locacao) ? Math.max(0, locacao) : Number(r.valor || 0)),
      freteIncluso: String(frete),
    };
  };

  useEffect(() => {
    if (!receipt) return;
    const snap: any = receipt.snapshot || {};
    const ct = snap.contract || {};
    const cu = snap.customer || {};
    const co = snap.company || {};
    setDataEmissao(toDateInput(receipt.dataEmissao));
    setDataVencimento(toDateInput(receipt.dataVencimento));
    const pi = toDateInput(receipt.periodoInicio) || toDateInput(snap?.periodo?.inicio);
    const pf = toDateInput(receipt.periodoFim) || toDateInput(snap?.periodo?.fim);
    setPeriodoInicio(pi);
    setPeriodoFim(pf);
    setOrigPeriodo({ ini: pi, fim: pf });

    setValor(String(Number(receipt.valor || 0)));
    setNumeroDisplay(receipt.numeroDisplay || '');
    setCno(ct.cno || '');
    setEnderecoObra(ct.enderecoObra || '');
    setDescricao(ct.descricao || '');
    setContratoNumero(ct.numero || '');
    setValorLocacao(String(Number(snap.valorLocacao ?? receipt.valor ?? 0)));
    setFreteIncluso(String(Number(snap.freteIncluso || 0)));
    setCust({
      name: cu.name || '', document: cu.document || '', address: cu.address || '',
      numero: cu.numero || '', bairro: cu.bairro || '', cidade: cu.cidade || '',
      estado: cu.estado || '', cep: cu.cep || '',
    });
    setComp({
      razaoSocial: co.razaoSocial || '', cnpj: co.cnpj || '',
      inscricaoEstadual: co.inscricaoEstadual || '', endereco: co.endereco || '',
      cidade: co.cidade || '', estado: co.estado || '', cep: co.cep || '',
      telefone: co.telefone || '', email: co.email || '',
      financeiroContato: co.financeiroContato || '',
    });
    setUnifiedItems([receiptToUnifiedItem(receipt)]);
  }, [receipt]);

  useEffect(() => {
    if (!receipt?.unifiedGroupId) {
      setUnifiedLoading(false);
      return;
    }
    let cancelled = false;
    setUnifiedLoading(true);
    receiptsService.list({ unifiedGroupId: receipt.unifiedGroupId, semValidade: !!receipt.semValidade })
      .then((rows) => {
        if (cancelled) return;
        const ativos = rows.filter(r => r.status !== 'cancelado');
        const ordered = ativos.length > 0 ? ativos : rows;
        setUnifiedItems(ordered.map(receiptToUnifiedItem));
      })
      .catch(() => {
        if (!cancelled) setUnifiedItems([receiptToUnifiedItem(receipt)]);
      })
      .finally(() => {
        if (!cancelled) setUnifiedLoading(false);
      });
    return () => { cancelled = true; };
  }, [receipt?.id, receipt?.unifiedGroupId, receipt?.semValidade]);

  const num = (s: string) => Number(String(s).replace(',', '.'));
  const isUnifiedEdit = !!receipt?.unifiedGroupId;
  const updateUnifiedItem = (id: string, field: string, value: string) => {
    setUnifiedItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const next = { ...it, [field]: value };
      if (field === 'valorLocacao' || field === 'freteIncluso') {
        const loc = field === 'valorLocacao' ? num(value) : num(next.valorLocacao);
        const fre = field === 'freteIncluso' ? (value === '' ? 0 : num(value)) : (next.freteIncluso === '' ? 0 : num(next.freteIncluso));
        const total = loc + fre;
        if (Number.isFinite(total)) next.valor = String(total);
      }
      return next;
    }));
  };

  const salvar = async () => {
    if (!receipt) return;
    if (receipt.unifiedGroupId && unifiedLoading) {
      toast.error('Aguarde carregar os contratos do recibo unificado'); return;
    }
    const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (!isDate(dataEmissao)) { toast.error('Data de emissão inválida'); return; }
    if (dataVencimento && !isDate(dataVencimento)) { toast.error('Data de vencimento inválida'); return; }
    if (periodoInicio && !isDate(periodoInicio)) { toast.error('Início do período inválido'); return; }
    if (periodoFim && !isDate(periodoFim)) { toast.error('Fim do período inválido'); return; }
    if (periodoInicio && periodoFim && periodoFim < periodoInicio) {
      toast.error('Fim do período deve ser >= início'); return;
    }
    if (isUnifiedEdit) {
      for (const it of unifiedItems) {
        if (!isDate(it.periodoInicio) || !isDate(it.periodoFim)) {
          toast.error(`Informe o período completo do contrato ${it.contractNumero || it.numero}`); return;
        }
        if (it.periodoFim < it.periodoInicio) {
          toast.error(`Fim do período deve ser >= início no contrato ${it.contractNumero || it.numero}`); return;
        }
        const iv = num(it.valor);
        const il = num(it.valorLocacao);
        const iff = it.freteIncluso === '' ? 0 : num(it.freteIncluso);
        if (!Number.isFinite(iv) || iv < 0 || !Number.isFinite(il) || il < 0 || !Number.isFinite(iff) || iff < 0) {
          toast.error(`Valor inválido no contrato ${it.contractNumero || it.numero}`); return;
        }
      }
    }
    const v = num(valor);
    const vl = num(valorLocacao);
    const vf = freteIncluso === '' ? 0 : num(freteIncluso);
    if (!Number.isFinite(v) || v < 0) { toast.error('Valor inválido'); return; }
    if (!Number.isFinite(vl) || vl < 0) { toast.error('Valor da locação inválido'); return; }
    if (!Number.isFinite(vf) || vf < 0) { toast.error('Valor do frete inválido'); return; }

    const patch: any = {
      dataEmissao,
      dataVencimento: dataVencimento || null,
      valor: v,
      numeroDisplay: numeroDisplay.trim() || null,
      cno: cno.trim() || null,
      enderecoObra: enderecoObra.trim() || null,
      descricao: descricao.trim() || null,
      contratoNumero: contratoNumero.trim() || null,
      valorLocacao: vl,
      freteIncluso: vf,
      customer: cust,
      company: comp,
    };
    // Período: só envia se realmente mudou — evita apagar o período do recibo
    // (que faria o PDF/listagem exibirem "—") quando o campo não foi tocado.
    if (periodoInicio !== origPeriodo.ini) patch.periodoInicio = periodoInicio || null;
    if (periodoFim !== origPeriodo.fim) patch.periodoFim = periodoFim || null;

    // Recalcula competência a partir do período/emissão para manter consistência.
    const compBase = periodoInicio || dataEmissao;
    if (compBase && /^\d{4}-\d{2}-\d{2}$/.test(compBase)) {
      patch.competencia = compBase.slice(0, 7);
    }

    setBusy(true);
    try {
      if (isUnifiedEdit) {
        const shared: any = {
          dataEmissao,
          dataVencimento: dataVencimento || null,
          numeroDisplay: numeroDisplay.trim() || null,
          customer: cust,
          company: comp,
        };
        await Promise.all(unifiedItems.map((it) => receiptsService.update(it.id, {
          ...shared,
          valor: num(it.valor),
          periodoInicio: it.periodoInicio,
          periodoFim: it.periodoFim,
          cno: it.cno.trim() || null,
          enderecoObra: it.enderecoObra.trim() || null,
          descricao: it.descricao.trim() || null,
          contratoNumero: it.contractNumero.trim() || null,
          valorLocacao: num(it.valorLocacao),
          freteIncluso: it.freteIncluso === '' ? 0 : num(it.freteIncluso),
        } as any)));
      } else {
        await receiptsService.update(receipt.id, patch);
      }
      toast.success('Recibo atualizado');
      await onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar recibo');
    } finally {
      setBusy(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: { className?: string; placeholder?: string; type?: string } = {},
  ) => (
    <div className={`space-y-1 ${opts.className || ''}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={opts.type} value={value} placeholder={opts.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );

  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar recibo</DialogTitle>
          <DialogDescription>
            Todas as informações impressas no recibo <strong>{receipt?.numeroDisplay || receipt?.numero}</strong> podem
            ser corrigidas aqui. O PDF refletirá as alterações ao baixar novamente.
            Pagamento e status não são alterados neste modal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Documento */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Documento</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {field('Número exibido', numeroDisplay, setNumeroDisplay, { placeholder: receipt?.numero || '' })}
              {field('Data de emissão', dataEmissao, setDataEmissao, { type: 'date' })}
              {field('Data de vencimento', dataVencimento, setDataVencimento, { type: 'date' })}
              {!isUnifiedEdit && field('Início do período', periodoInicio, setPeriodoInicio, { type: 'date' })}
              {!isUnifiedEdit && field('Fim do período', periodoFim, setPeriodoFim, { type: 'date' })}
              {!isUnifiedEdit && field('Nº do contrato (impresso)', contratoNumero, setContratoNumero)}
            </div>
          </section>

          {/* Serviço e valores */}
          {!isUnifiedEdit && <section className="space-y-2">
            <h4 className="text-sm font-semibold">Serviço e valores</h4>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descrição do serviço</Label>
              <Textarea
                rows={3} value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição que aparece na tabela de itens do recibo..."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {field('Valor da locação (R$)', valorLocacao, (v) => {
                setValorLocacao(v);
                const t = num(v) + (freteIncluso === '' ? 0 : num(freteIncluso));
                if (Number.isFinite(t)) setValor(String(t));
              }, { type: 'number' })}
              {field('Frete incluso (R$)', freteIncluso, (v) => {
                setFreteIncluso(v);
                const t = num(valorLocacao) + (v === '' ? 0 : num(v));
                if (Number.isFinite(t)) setValor(String(t));
              }, { type: 'number' })}
              {field('Total da cobrança (R$)', valor, setValor, { type: 'number' })}
            </div>
          </section>}

          {isUnifiedEdit && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Contratos do recibo unificado</h4>
                {unifiedLoading && <span className="text-xs text-muted-foreground">Carregando grupo…</span>}
              </div>
              <div className="space-y-3">
                {unifiedItems.map((it) => (
                  <div key={it.id} className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">Contrato {it.contractNumero || '—'}</p>
                        <p className="text-[11px] text-muted-foreground">Recibo {it.numero}</p>
                      </div>
                      <span className="text-xs font-semibold text-primary shrink-0">{BRL(num(it.valor))}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {field('Início do período', it.periodoInicio, (v) => updateUnifiedItem(it.id, 'periodoInicio', v), { type: 'date' })}
                      {field('Fim do período', it.periodoFim, (v) => updateUnifiedItem(it.id, 'periodoFim', v), { type: 'date' })}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Descrição do serviço</Label>
                      <Textarea
                        rows={2}
                        value={it.descricao}
                        onChange={(e) => updateUnifiedItem(it.id, 'descricao', e.target.value)}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {field('Valor da locação (R$)', it.valorLocacao, (v) => updateUnifiedItem(it.id, 'valorLocacao', v), { type: 'number' })}
                      {field('Frete incluso (R$)', it.freteIncluso, (v) => updateUnifiedItem(it.id, 'freteIncluso', v), { type: 'number' })}
                      {field('Total deste contrato (R$)', it.valor, (v) => updateUnifiedItem(it.id, 'valor', v), { type: 'number' })}
                      {field('CNO / Ordem de Compra', it.cno, (v) => updateUnifiedItem(it.id, 'cno', v))}
                      {field('Endereço da obra/evento', it.enderecoObra, (v) => updateUnifiedItem(it.id, 'enderecoObra', v), { className: 'sm:col-span-2' })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Local de prestação */}
          {!isUnifiedEdit && <section className="space-y-2">
            <h4 className="text-sm font-semibold">Local de prestação / referências</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {field('CNO / Ordem de Compra', cno, setCno)}
              {field('Endereço da obra/evento', enderecoObra, setEnderecoObra, { className: 'sm:col-span-2' })}
            </div>
          </section>}

          {/* Cliente */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Dados do cliente (neste recibo)</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {field('Nome / Razão social', cust.name || '', (v) => setCust({ ...cust, name: v }), { className: 'sm:col-span-2' })}
              {field('CPF / CNPJ', cust.document || '', (v) => setCust({ ...cust, document: v }))}
              {field('Endereço', cust.address || '', (v) => setCust({ ...cust, address: v }), { className: 'sm:col-span-2' })}
              {field('Número', cust.numero || '', (v) => setCust({ ...cust, numero: v }))}
              {field('Bairro', cust.bairro || '', (v) => setCust({ ...cust, bairro: v }))}
              {field('Cidade', cust.cidade || '', (v) => setCust({ ...cust, cidade: v }))}
              {field('UF', cust.estado || '', (v) => setCust({ ...cust, estado: v }))}
              {field('CEP', cust.cep || '', (v) => setCust({ ...cust, cep: v }))}
            </div>
          </section>

          {/* Empresa emissora */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Empresa emissora (neste recibo)</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {field('Razão social', comp.razaoSocial || '', (v) => setComp({ ...comp, razaoSocial: v }), { className: 'sm:col-span-2' })}
              {field('CNPJ', comp.cnpj || '', (v) => setComp({ ...comp, cnpj: v }))}
              {field('Inscrição estadual', comp.inscricaoEstadual || '', (v) => setComp({ ...comp, inscricaoEstadual: v }))}
              {field('Endereço', comp.endereco || '', (v) => setComp({ ...comp, endereco: v }), { className: 'sm:col-span-2' })}
              {field('Cidade', comp.cidade || '', (v) => setComp({ ...comp, cidade: v }))}
              {field('UF', comp.estado || '', (v) => setComp({ ...comp, estado: v }))}
              {field('CEP', comp.cep || '', (v) => setComp({ ...comp, cep: v }))}
              {field('Telefone', comp.telefone || '', (v) => setComp({ ...comp, telefone: v }))}
              {field('E-mail', comp.email || '', (v) => setComp({ ...comp, email: v }))}
              {field('Contato do financeiro', comp.financeiroContato || '', (v) => setComp({ ...comp, financeiroContato: v }))}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={salvar} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


// ============================================================
// Gastos
// ============================================================
const emptyForm = (): Partial<Expense> => ({
  categoria: 'outros', descricao: '', valor: 0,
  data: new Date().toISOString().slice(0, 10),
});

function GastosPanel() {
  const [list, setList] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [origem, setOrigem] = useState<'all' | 'manual' | 'manutencao'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<{
    total: number; totalValor: number;
    qtdManual: number; qtdManutencao: number;
    totalManual: number; totalManutencao: number;
  } | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Expense>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [recOpen, setRecOpen] = useState(false);
  const gastosScrollRef = useRef<HTMLDivElement>(null);

  const catLabel = useCallback((key: string) => {
    if (key === 'manutencao') return 'Manutenção';
    return categories.find(c => c.key === key)?.label || key;
  }, [categories]);

  const baseFilters = useMemo(() => ({
    from: from || undefined,
    to: to || undefined,
    categoria: cat,
    origem,
    search: debouncedSearch || undefined,
  }), [from, to, cat, origem, debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pg, k] = await Promise.all([
        expensesService.listPaged({ ...baseFilters, page, pageSize }),
        expensesService.kpis(baseFilters),
      ]);
      setList(pg.data);
      setTotal(pg.total);
      setKpis(k);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [baseFilters, page, pageSize]);

  const loadCats = useCallback(async () => {
    try { setCategories(await expenseCategoriesService.list()); } catch { /* silencioso */ }
  }, []);
  const loadRec = useCallback(async () => {
    try { setRecurring(await recurringExpensesService.list()); } catch { /* silencioso */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCats(); loadRec(); }, [loadCats, loadRec]);
  // Reset página quando filtros mudam
  useEffect(() => { setPage(1); }, [baseFilters, pageSize]);

  /** Baixa TODOS os gastos do filtro atual (paginando em blocos de 200). */
  const fetchAllFiltered = useCallback(async (hardLimit = 5000): Promise<Expense[] | null> => {
    const PAGE = 200;
    const first = await expensesService.listPaged({ ...baseFilters, page: 1, pageSize: PAGE });
    if (first.total > hardLimit) {
      toast.error(`Muitos gastos (${first.total}). Refine os filtros — limite ${hardLimit}.`);
      return null;
    }
    const all: Expense[] = [...first.data];
    const totalPages = Math.max(1, Math.ceil(first.total / PAGE));
    for (let p = 2; p <= totalPages; p++) {
      const pg = await expensesService.listPaged({ ...baseFilters, page: p, pageSize: PAGE });
      all.push(...pg.data);
    }
    return all;
  }, [baseFilters]);

  const exportAllCsv = useCallback(async () => {
    setExportBusy(true);
    try {
      const all = await fetchAllFiltered();
      if (!all) return;
      const headers = ['Data','Categoria','Descrição','Fornecedor','NF','Valor','Origem','Observações'];
      const rows = all.map(e => [
        e.data, catLabel(e.categoria), e.descricao, e.fornecedor || '',
        e.notaFiscal || '', Number(e.valor).toFixed(2).replace('.', ','),
        e.origem === 'manutencao' ? 'Manutenção' : 'Manual',
        e.observacoes || '',
      ]);
      downloadCsv(`gastos-${from || 'inicio'}_${to || 'hoje'}`, headers, rows);
      toast.success(`CSV exportado (${all.length} gastos).`);
    } catch (e: any) { toast.error(e.message || 'Falha ao exportar CSV.'); }
    finally { setExportBusy(false); }
  }, [fetchAllFiltered, catLabel, from, to]);

  const totalValor = kpis?.totalValor ?? 0;
  const totManual  = kpis?.totalManual ?? 0;
  const totManut   = kpis?.totalManutencao ?? 0;

  const activeCats = useMemo(() => categories.filter(c => c.ativo), [categories]);

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (e: Expense) => {
    if (e.origem === 'manutencao') { toast.info('Para alterar uma manutenção, vá para o módulo Manutenção.'); return; }
    setEditingId(e.id);
    setForm({
      categoria: e.categoria, descricao: e.descricao, valor: Number(e.valor),
      data: e.data?.slice(0, 10), fornecedor: e.fornecedor || '',
      notaFiscal: e.notaFiscal || '', anexoUrl: e.anexoUrl || '',
      observacoes: e.observacoes || '',
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.descricao || form.valor == null) { toast.error('Descrição e valor são obrigatórios'); return; }
    setSaving(true);
    try {
      if (editingId) { await expensesService.update(editingId, form); toast.success('Gasto atualizado'); }
      else { await expensesService.create(form); toast.success('Gasto adicionado'); }
      setOpen(false); setEditingId(null); setForm(emptyForm());
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (e: Expense) => {
    if (e.origem === 'manutencao') { toast.info('Para alterar uma manutenção, vá para o módulo Manutenção.'); return; }
    if (!(await confirmDialog({ description: 'Excluir este gasto?', destructive: true }))) return;
    try { await expensesService.remove(e.id); toast.success('Removido'); await load(); }
    catch (er: any) { toast.error(er.message); }
  };

  const runRecurring = async () => {
    try {
      const r = await recurringExpensesService.run();
      toast.success(`${r.geradas} gasto(s) gerado(s) para ${formatComp(r.competencia)}`);
      await load(); await loadRec();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPI label="Total no período" value={BRL(totalValor)} icon={TrendingDown} accent="from-rose-500 to-red-600" />
        <KPI label="Gastos manuais / NFs" value={BRL(totManual)} icon={TrendingUp} accent="from-violet-500 to-purple-600" />
        <KPI label="Manutenção de frota" value={BRL(totManut)} icon={Wrench} accent="from-amber-500 to-orange-600" />
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <SearchableSelect
              value={cat}
              onValueChange={setCat}
              triggerClassName="h-9 w-[180px]"
              placeholder="Categoria"
              searchPlaceholder="Buscar categoria..."
              options={[
                { value: 'all', label: 'Todas' },
                ...activeCats.map(c => ({ value: c.key, label: c.label })),
                { value: 'manutencao', label: 'Manutenção' },
              ]}
            />
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <SearchableSelect
              value={origem}
              onValueChange={(v: any) => setOrigem(v)}
              triggerClassName="h-9 w-[160px]"
              placeholder="Origem"
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'manual', label: 'Manuais' },
                { value: 'manutencao', label: 'Manutenção' },
              ]}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Buscar</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Descrição, fornecedor, NF…" className="h-9" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={exportBusy} onClick={exportAllCsv}>
              {exportBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Exportar CSV (filtro)
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCatsOpen(true)}>
              <Tag className="h-4 w-4 mr-1" /> Categorias
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRecOpen(true)}>
              <Repeat className="h-4 w-4 mr-1" /> Recorrências
              {recurring.filter(r => r.ativo).length > 0 && (
                <Badge variant="secondary" className="ml-2">{recurring.filter(r => r.ativo).length}</Badge>
              )}
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Novo gasto
            </Button>
          </div>
        </CardContent>
      </Card>

      {recurring.filter(r => r.ativo).length > 0 && (
        <Card className="border-indigo-100 bg-indigo-50/40">
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <Repeat className="h-4 w-4 text-indigo-600" />
              <span><strong>{recurring.filter(r => r.ativo).length}</strong> recorrência(s) ativa(s) —
                total mensal {BRL(recurring.filter(r => r.ativo).reduce((a, r) => a + Number(r.valor || 0), 0))}</span>
            </div>
            <Button size="sm" onClick={runRecurring} className="bg-indigo-600 hover:bg-indigo-700">
              <PlayCircle className="h-4 w-4 mr-1" /> Gerar deste mês
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div
            ref={gastosScrollRef}
            className={`overflow-auto ${list.length > 50 ? 'max-h-[70vh]' : ''}`}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>NF</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Carregando…
                  </TableCell></TableRow>
                )}
                {!loading && list.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum gasto no período.
                  </TableCell></TableRow>
                )}
                <VirtualRows
                  scrollRef={gastosScrollRef}
                  items={list}
                  colSpan={8}
                  estimateSize={48}
                  getKey={(e) => `${e.origem || 'm'}-${e.id}`}
                  renderRow={(e) => (
                    <TableRow key={`${e.origem || 'm'}-${e.id}`}>
                      <TableCell className="text-xs">{D(e.data)}</TableCell>
                      <TableCell className="text-xs">{catLabel(e.categoria)}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{e.descricao}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.fornecedor || '—'}</TableCell>
                      <TableCell className="text-xs">{e.notaFiscal || '—'}</TableCell>
                      <TableCell className="text-right font-semibold text-rose-700">{BRL(Number(e.valor))}</TableCell>
                      <TableCell>
                        {e.origem === 'manutencao'
                          ? <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Manutenção</Badge>
                          : <Badge variant="outline">Manual</Badge>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {e.origem !== 'manutencao' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(e)} aria-label="Editar gasto">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(e)} aria-label="Excluir gasto">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                />
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PaginationBar
        page={page} pageSize={pageSize} total={total}
        onPageChange={setPage} onPageSizeChange={setPageSize}
        pageSizeOptions={[25, 50, 100, 200]}
      />

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(emptyForm()); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar gasto' : 'Novo gasto'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <SearchableSelect
                value={form.categoria}
                onValueChange={(v) => setForm({ ...form, categoria: v })}
                placeholder="Categoria"
                searchPlaceholder="Buscar categoria..."
                options={activeCats.map(c => ({ value: c.key, label: c.label }))}
              />
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Descrição *</Label>
              <Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.valor}
                onChange={e => setForm({ ...form, valor: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input value={form.fornecedor || ''} onChange={e => setForm({ ...form, fornecedor: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Nº Nota fiscal</Label>
              <Input value={form.notaFiscal || ''} onChange={e => setForm({ ...form, notaFiscal: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Anexo (foto, PDF, etc.)</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const url = await uploadSignedPdf(file);
                      setForm({ ...form, anexoUrl: url });
                      toast.success('Anexo enviado');
                    } catch (err: any) { toast.error(err.message || 'Falha ao enviar anexo'); }
                    finally { e.target.value = ''; }
                  }} />
                {form.anexoUrl && (
                  <>
                    <a href={toAbsoluteUrl(form.anexoUrl)} target="_blank" rel="noreferrer"
                      className="text-xs text-indigo-600 underline whitespace-nowrap">ver anexo</a>
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() => setForm({ ...form, anexoUrl: '' })} aria-label="Remover anexo">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Observações</Label>
              <Input value={form.observacoes || ''} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {editingId ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoriesDialog
        open={catsOpen} onClose={() => setCatsOpen(false)}
        categories={categories} onChanged={loadCats}
      />
      <RecurringDialog
        open={recOpen} onClose={() => setRecOpen(false)}
        list={recurring} categories={activeCats}
        onChanged={async () => { await loadRec(); await load(); }}
      />
    </div>
  );
}

// ========================= CategoriesDialog =========================
const CategoriesDialog: React.FC<{
  open: boolean; onClose: () => void;
  categories: ExpenseCategory[]; onChanged: () => Promise<void>;
}> = ({ open, onClose, categories, onChanged }) => {
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try { await expenseCategoriesService.create({ label: label.trim() }); setLabel(''); await onChanged(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  const toggle = async (c: ExpenseCategory) => {
    try { await expenseCategoriesService.update(c.id, { ativo: !c.ativo }); await onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };
  const remove = async (c: ExpenseCategory) => {
    if (!(await confirmDialog({ description: `Excluir categoria "${c.label}"?`, destructive: true }))) return;
    try {
      const r = await expenseCategoriesService.remove(c.id);
      toast.success(r.inactivated ? 'Categoria padrão — desativada' : 'Excluída');
      await onChanged();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4" /> Categorias de gastos</DialogTitle>
          <DialogDescription>Personalize as categorias usadas nos lançamentos.</DialogDescription>
        </DialogHeader>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">Nova categoria</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)}
              placeholder="Ex.: Marketing" onKeyDown={(e) => e.key === 'Enter' && add()} />
          </div>
          <Button onClick={add} disabled={saving || !label.trim()} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="border rounded-md divide-y max-h-[280px] overflow-y-auto">
          {categories.length === 0 && (
            <div className="text-xs text-slate-400 text-center py-6">Nenhuma categoria.</div>
          )}
          {categories.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Checkbox checked={c.ativo} onCheckedChange={() => toggle(c)} aria-label={`Ativar ${c.label}`} />
                <span className={c.ativo ? '' : 'line-through text-slate-400'}>{c.label}</span>
                <Badge variant="outline" className="text-[10px] font-mono">{c.key}</Badge>
              </div>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(c)} aria-label="Excluir">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ========================= RecurringDialog =========================
const emptyRec = (): Partial<RecurringExpense> => ({
  categoria: 'outros', descricao: '', valor: 0, diaMes: 1, ativo: true,
});

const RecurringDialog: React.FC<{
  open: boolean; onClose: () => void;
  list: RecurringExpense[]; categories: ExpenseCategory[];
  onChanged: () => Promise<void>;
}> = ({ open, onClose, list, categories, onChanged }) => {
  const [editing, setEditing] = useState<Partial<RecurringExpense> | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const startNew = () => setEditing(emptyRec());
  const startEdit = (r: RecurringExpense) => setEditing({ ...r });

  const save = async () => {
    if (!editing) return;
    if (!editing.descricao || editing.valor == null) {
      toast.error('Descrição e valor são obrigatórios'); return;
    }
    setSaving(true);
    try {
      if (editing.id) await recurringExpensesService.update(editing.id, editing);
      else await recurringExpensesService.create(editing);
      toast.success('Salvo');
      setEditing(null); await onChanged();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (r: RecurringExpense) => {
    if (!(await confirmDialog({ description: `Excluir recorrência "${r.descricao}"?`, destructive: true }))) return;
    try { await recurringExpensesService.remove(r.id); toast.success('Removida'); await onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };

  const toggle = async (r: RecurringExpense) => {
    try { await recurringExpensesService.update(r.id, { ativo: !r.ativo }); await onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const out = await recurringExpensesService.run();
      toast.success(`${out.geradas} gasto(s) gerado(s) para ${formatComp(out.competencia)}`);
      await onChanged();
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Repeat className="h-4 w-4" /> Gastos recorrentes</DialogTitle>
          <DialogDescription>
            Cadastre despesas mensais fixas (aluguel, folha, internet) e gere o lote a cada mês com um clique.
          </DialogDescription>
        </DialogHeader>

        {!editing && (
          <>
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" onClick={runNow} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
                Gerar deste mês
              </Button>
              <Button size="sm" onClick={startNew} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-1" /> Nova recorrência
              </Button>
            </div>
            <div className="border rounded-md divide-y max-h-[340px] overflow-y-auto">
              {list.length === 0 && (
                <div className="text-xs text-slate-400 text-center py-6">Nenhuma recorrência cadastrada.</div>
              )}
              {list.map(r => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={r.ativo} onCheckedChange={() => toggle(r)} aria-label={`Ativar ${r.descricao}`} />
                      <span className={`text-sm font-medium truncate ${r.ativo ? '' : 'text-slate-400 line-through'}`}>
                        {r.descricao}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 ml-6">
                      {BRL(Number(r.valor))} · dia {r.diaMes}
                      {r.lastGeneratedCompetencia && ` · último: ${formatComp(r.lastGeneratedCompetencia)}`}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(r)} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(r)} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          </>
        )}

        {editing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Descrição *</Label>
              <Input value={editing.descricao || ''} onChange={e => setEditing({ ...editing, descricao: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Valor mensal (R$) *</Label>
              <Input type="number" step="0.01" value={editing.valor ?? 0}
                onChange={e => setEditing({ ...editing, valor: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Dia do mês</Label>
              <Input type="number" min={1} max={31} value={editing.diaMes ?? 1}
                onChange={e => setEditing({ ...editing, diaMes: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <SearchableSelect
                value={editing.categoria || 'outros'}
                onValueChange={(v) => setEditing({ ...editing, categoria: v })}
                placeholder="Categoria"
                searchPlaceholder="Buscar categoria..."
                options={categories.map(c => ({ value: c.key, label: c.label }))}
              />
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input value={editing.fornecedor || ''} onChange={e => setEditing({ ...editing, fornecedor: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Observações</Label>
              <Input value={editing.observacoes || ''} onChange={e => setEditing({ ...editing, observacoes: e.target.value })} />
            </div>
            <label className="md:col-span-2 flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox checked={editing.ativo ?? true} onCheckedChange={(c) => setEditing({ ...editing, ativo: !!c })} />
              <span>Ativa</span>
            </label>
          </div>
        )}

        <DialogFooter>
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(null)}>Voltar</Button>
              <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Salvar
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ErpFinanceiro;
