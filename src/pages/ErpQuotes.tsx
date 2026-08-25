/**
 * ERP — Orçamentos: lista, editor com múltiplos itens, PDF profissional,
 * conversão em OS (reserva sanitários do estoque automaticamente).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, FileText, Trash2, Search, Loader2, Save, Download,
  CheckCircle2, RefreshCcw, FileDown, AlertCircle, Copy,
  AlertTriangle, TrendingUp, Send, ClipboardCheck, X, Clock,
  MoreHorizontal, Pencil, XCircle, MessageCircle, Mail, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { quotesService, Quote, QuoteItem } from '@/services/quotes';
import { erpService, ErpCompany, sanitarioNewService, sanitarioCategoriaLabel, SANITARIO_CATEGORIAS } from '@/services/erp';
import { useCustomers } from '@/hooks/useCustomers';

import { generateQuotePdf, generateQuotePdfBlob } from '@/utils/quotePdf';
import { API_BASE_URL } from '@/services/config';
import { generateContractPdf } from '@/utils/contractPdf';
import { FileSignature } from 'lucide-react';
import { OBSERVACAO_FIXA_LOCACAO, describeFormaPagamento, calcVencimentoBoleto, type FormaPagamento } from '@/utils/fixedObservations';
import { formatDateBR, parseLocalDate } from '@/utils/dateFormat';
import { Switch } from '@/components/ui/switch';


import { confirmDialog } from '@/lib/confirm';
import { BRL } from '@/utils/currency';
import { PaginationBar } from '@/components/PaginationBar';

/** Dias até uma data ISO (positivo = futuro). */
const daysBetween = (from: Date, iso?: string | null): number | null => {
  if (!iso) return null;
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(iso); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

/** Retorna quantos dias faltam pra validade expirar (positivo=futuro, negativo=vencido). */
const daysUntilExpire = (dataEmissao?: string | null, validadeDias?: number): number | null => {
  if (!dataEmissao || !validadeDias) return null;
  // Parse LOCAL para não deslocar -1 dia em fuso BR (bug de timezone).
  const emissao = parseLocalDate(dataEmissao);
  if (!emissao) return null;
  const expiry = new Date(emissao.getFullYear(), emissao.getMonth(), emissao.getDate() + validadeDias);
  return daysBetween(new Date(), expiry.toISOString());
};

interface EditorState {
  id?: string;
  companyId?: string;
  customerId?: string;
  modalidade: 'diaria' | 'mensal';
  tipoLocacao?: 'obra' | 'evento' | 'industria' | 'outro';
  validadeDias: number;
  dataEntrega?: string;
  dataRecolhimento?: string;
  enderecoEntrega?: string;
  limpezasSemanais?: number;
  descontoPct: number;
  frete: number;
  observacoes: string;
  condicoesPagamento: string;
  formaPagamento?: FormaPagamento;
  status: Quote['status'];
  responsavelNome?: string;
  responsavelTelefone?: string;
  responsavelEmail?: string;
  items: QuoteItem[];
}

let __itemUid = 0;
const withUid = <T extends object>(it: T): T & { __uid: number } => ({ ...it, __uid: ++__itemUid } as any);

const emptyEditor = (): EditorState => ({
  modalidade: 'mensal', tipoLocacao: 'evento', validadeDias: 15, descontoPct: 0, frete: 0,
  dataEntrega: '', dataRecolhimento: '', enderecoEntrega: '', limpezasSemanais: 1,
  observacoes: '', condicoesPagamento: '',
  formaPagamento: 'boleto',
  status: 'rascunho',
  responsavelNome: '', responsavelTelefone: '', responsavelEmail: '',
  items: [withUid({ produto: 'Sanitário Químico Standard', descricao: '', quantidade: 1, valorUnitario: 0 })],
});

// Badges por status — todas via tokens semânticos.
type Status = Quote['status'];
const STATUS_LABEL: Record<Status, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
  recusado: 'Recusado', convertido: 'Convertido',
};
const StatusBadge: React.FC<{ status: Status }> = ({ status }) => {
  const cls: Record<Status, string> = {
    rascunho:   'bg-muted text-muted-foreground border-border',
    enviado:    'bg-primary/10 text-primary border-primary/30',
    aprovado:   'bg-[hsl(var(--success-soft))] text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
    recusado:   'bg-destructive/10 text-destructive border-destructive/30',
    convertido: 'bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-foreground))] border-[hsl(var(--warning))]/30',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium uppercase tracking-wide', cls[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
};

const ErpQuotes: React.FC = () => {
  const [list, setList] = useState<Quote[]>([]);
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const { customers } = useCustomers();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [availableSanitarios, setAvailableSanitarios] = useState<any[]>([]);

  useEffect(() => {
    const loadSanitarios = async () => {
      try {
        const data = await sanitarioNewService.listAvailable();
        setAvailableSanitarios(data || []);
      } catch (e) {}
    };
    loadSanitarios();
  }, []);


  // ---- Filtros ----
  const [filterStatus, setFilterStatus] = useState<'all' | Status>('all');
  const [filterModalidade, setFilterModalidade] = useState<'all' | 'diaria' | 'mensal'>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterExpiring, setFilterExpiring] = useState(false);

  // ---- Paginação server-side ----
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);   // múltiplo de 3 (colunas do grid)
  const [totalCount, setTotalCount] = useState(0);

  // ---- Debounce da busca (evita 1 req por tecla) ----
  const [searchDebounced, setSearchDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Reseta para 1 ao mudar qualquer filtro server-side
  useEffect(() => { setPage(1); }, [
    filterStatus, filterModalidade, filterCompany, searchDebounced, pageSize,
  ]);

  // ---- KPIs vindos do servidor (agregados, não dependem da página atual) ----
  const [kpis, setKpis] = useState({
    rascunhos: 0, enviados: 0, aprovadosMes: 0,
    valorAprovadosMes: 0, ticketMedio: 0,
  });
  const loadKpis = async () => {
    try { setKpis(await quotesService.stats()); }
    catch { /* silencioso — KPIs não são bloqueantes */ }
  };

  // ---- Carregamento paginado ----
  const load = async () => {
    try {
      setLoading(true);
      const [pg, cs] = await Promise.all([
        quotesService.listPaged({
          page, pageSize,
          status:      filterStatus !== 'all'     ? filterStatus     : undefined,
          modalidade:  filterModalidade !== 'all' ? filterModalidade : undefined,
          companyId:   filterCompany !== 'all'    ? filterCompany    : undefined,
          search:      searchDebounced || undefined,
        }),
        companies.length ? Promise.resolve(companies) : erpService.listCompanies(),
      ]);
      setList(pg.data);
      setTotalCount(pg.total);
      if (!companies.length) setCompanies(cs);
    } catch (e: any) { toast.error(e.message || 'Erro ao carregar'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [page, pageSize, filterStatus, filterModalidade, filterCompany, searchDebounced]);
  useEffect(() => { loadKpis(); }, []);

  // Filtro "Vencendo (7d)" permanece client-side sobre a página corrente —
  // depende de cálculo de data por linha; empurrar ao servidor exige nova SQL.
  const filtered = useMemo(() => {
    if (!filterExpiring) return list;
    return list.filter(q => {
      const d = daysUntilExpire(q.dataEmissao, q.validadeDias);
      return q.status === 'enviado' && d !== null && d <= 7;
    });
  }, [list, filterExpiring]);

  const activeFiltersCount =
    (filterStatus !== 'all' ? 1 : 0) +
    (filterModalidade !== 'all' ? 1 : 0) +
    (filterCompany !== 'all' ? 1 : 0) +
    (filterExpiring ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const clearFilters = () => {
    setFilterStatus('all'); setFilterModalidade('all');
    setFilterCompany('all'); setFilterExpiring(false); setSearch('');
  };

  // ---- Editor helpers ----
  const subtotal = useMemo(() => {
    if (!editing) return 0;
    return editing.items.reduce((acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), 0);
  }, [editing]);
  const total = useMemo(() => {
    if (!editing) return 0;
    const desc = subtotal * (Number(editing.descontoPct) || 0) / 100;
    return Math.max(0, subtotal - desc + (Number(editing.frete) || 0));
  }, [subtotal, editing]);

  // Recarrega lista de empresas para evitar cache stale (empresa recém-criada
  // ou removida causando 404 "Empresa emissora não encontrada" ao salvar).
  const refreshCompanies = async () => {
    try { setCompanies(await erpService.listCompanies()); }
    catch { /* silencioso — lista antiga permanece */ }
  };
  const openNew = () => { refreshCompanies(); setEditing(emptyEditor()); };
  const openEdit = async (id: string) => {
    try {
      refreshCompanies();
      const q = await quotesService.get(id);
      setEditing({
        id: q.id, companyId: q.companyId, customerId: q.customerId,
        modalidade: q.modalidade, tipoLocacao: (q as any).tipoLocacao || undefined,
        validadeDias: q.validadeDias,
        dataEntrega: q.dataEntrega ? String(q.dataEntrega).slice(0, 10) : '',
        dataRecolhimento: q.dataRecolhimento ? String(q.dataRecolhimento).slice(0, 10) : '',
        enderecoEntrega: q.enderecoEntrega || '',
        limpezasSemanais: q.limpezasSemanais ?? undefined,
        descontoPct: Number(q.descontoPct), frete: Number(q.frete),
        observacoes: q.observacoes || '', condicoesPagamento: q.condicoesPagamento || '',
        formaPagamento: (q.formaPagamento as FormaPagamento) || 'boleto',
        status: q.status,
        responsavelNome: (q as any).responsavelNome || '',
        responsavelTelefone: (q as any).responsavelTelefone || '',
        responsavelEmail: (q as any).responsavelEmail || '',
        items: (q.items?.length ? q.items : [{ produto: '', quantidade: 1, valorUnitario: 0, isSanitario: false, isGenericService: false }]).map(withUid),
      });
    } catch (e: any) { toast.error(e.message); }
  };

  const updateItem = (i: number, patch: Partial<QuoteItem>) => {
    if (!editing) return;
    setEditing({ ...editing, items: editing.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) });
  };
  const addItem = () => editing && setEditing({ ...editing, items: [...editing.items, withUid({ produto: '', quantidade: 1, valorUnitario: 0, isSanitario: false, isGenericService: false })] });
  const removeItem = (i: number) => editing && setEditing({ ...editing, items: editing.items.filter((_, idx) => idx !== i) });

  const save = async (): Promise<Quote | null> => {
    if (!editing) return null;
    if (!editing.companyId) { toast.error('Selecione a empresa emissora'); return null; }
    if (!editing.customerId) { toast.error('Selecione o cliente'); return null; }
    if (!editing.items.length) { toast.error('Adicione pelo menos 1 item'); return null; }
    setSaving(true);
    try {
      let id = editing.id;
      const payload: any = { ...editing };
      if (payload.tipoLocacao === 'evento' || payload.tipoLocacao === 'outro') payload.limpezasSemanais = undefined;
      // Sincroniza o texto livre com a forma escolhida (compat. com PDFs antigos).
      payload.condicoesPagamento = describeFormaPagamento(payload.formaPagamento, payload.dataEntrega);
      if (id) await quotesService.update(id, payload);
      else {
        const r = await quotesService.create(payload);
        id = r.id;
      }
      toast.success('Orçamento salvo');
      await load();
      const full = await quotesService.get(id!);
      setEditing({
        id: full.id, companyId: full.companyId, customerId: full.customerId,
        modalidade: full.modalidade, tipoLocacao: (full as any).tipoLocacao || undefined,
        validadeDias: full.validadeDias,
        dataEntrega: full.dataEntrega ? String(full.dataEntrega).slice(0, 10) : '',
        dataRecolhimento: full.dataRecolhimento ? String(full.dataRecolhimento).slice(0, 10) : '',
        enderecoEntrega: full.enderecoEntrega || '',
        limpezasSemanais: full.limpezasSemanais ?? undefined,
        descontoPct: Number(full.descontoPct), frete: Number(full.frete),
        observacoes: full.observacoes || '', condicoesPagamento: full.condicoesPagamento || '',
        formaPagamento: (full.formaPagamento as FormaPagamento) || 'boleto',
        status: full.status,
        responsavelNome: (full as any).responsavelNome || '',
        responsavelTelefone: (full as any).responsavelTelefone || '',
        responsavelEmail: (full as any).responsavelEmail || '',
        items: full.items || [],
      });
      return full;
    } catch (e: any) { toast.error(e.message); return null; }
    finally { setSaving(false); }
  };

  const exportPdf = async () => {
    const q = await save();
    if (!q) return;
    try { generateQuotePdf(q); toast.success('PDF gerado'); }
    catch (e: any) { toast.error('Erro ao gerar PDF: ' + e.message); }
  };

  const exportContract = async (format: 'pdf' | 'docx' = 'pdf') => {
    const q = await save();
    if (!q) return;
    try {
      const src = {

        numero: q.numero,
        tipo: 'orcamento',
        tipoContrato: (() => {
          const t = ((q as any).tipoLocacao || '').toLowerCase();
          if (t === 'evento') return 'evento';
          if (t === 'obra') return 'obra';
          return 'locacao';
        })(),
        modalidade: q.modalidade,
        dataEmissao: q.dataEmissao,
        dataEntrega: q.dataEntrega,
        dataRecolhimento: (q as any).dataRecolhimento || null,
        horaEntrega: (q as any).horaEntrega || null,
        localEvento: (q as any).localEvento || null,
        validadeDias: q.validadeDias,
        limpezasSemanais: q.limpezasSemanais,
        enderecoEntrega: q.enderecoEntrega,
        observacoes: q.observacoes,
        condicoesPagamento: q.condicoesPagamento,
        formaPagamento: q.formaPagamento || null,
        dataVencimento: q.formaPagamento === 'boleto' ? calcVencimentoBoleto(q.dataEntrega) : null,
        frete: q.frete,
        total: q.total,
        companySnapshot: q.companySnapshot,
        customerSnapshot: q.customerSnapshot,
        companyRazaoSocial: q.companyRazaoSocial,
        companyCnpj: q.companyCnpj,
        customerName: q.customerName,
        responsavelNome: (q as any).responsavelNome || null,
        responsavelTelefone: (q as any).responsavelTelefone || null,
        responsavelEmail: (q as any).responsavelEmail || null,
        items: q.items,
      } as any;
      if (format === 'docx') {
        const { generateContractDoc } = await import('@/utils/contractDoc');
        await generateContractDoc(src);
        toast.success('Contrato Word gerado');
      } else {
        await generateContractPdf(src);
        toast.success('Contrato gerado');
      }
    } catch (e: any) { toast.error('Erro ao gerar contrato: ' + e.message); }

  };

  const convertToOs = async () => {
    if (!editing?.id) { toast.error('Salve o orçamento antes'); return; }
    const dias = editing.modalidade === 'diaria'
      ? parseInt(prompt('Quantos dias de locação?', '1') || '1') || 1
      : 30;
    try {
      const r = await quotesService.convertToOs(editing.id, { dias });
      toast.success(`OS ${r.osNumero} criada · ${r.sanitariosReservados} sanitário(s) reservado(s)`);
      setEditing(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const removeQuote = async (id: string) => {
    if (!(await confirmDialog({ description: 'Excluir este orçamento?', destructive: true }))) return;
    try { await quotesService.remove(id); toast.success('Excluído'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  // Atualização rápida de status (sem abrir o editor).
  const quickStatus = async (q: Quote, next: Status) => {
    if (q.status === next) return;
    try {
      await quotesService.update(q.id, { status: next });
      toast.success(`Status: ${STATUS_LABEL[next]}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const quickConvert = async (q: Quote) => {
    if (q.status === 'convertido') return;
    if (!(await confirmDialog({ description: `Converter ${q.numero} em OS?` }))) return;
    const dias = q.modalidade === 'diaria'
      ? parseInt(prompt('Dias de locação?', '1') || '1') || 1 : 30;
    try {
      const r = await quotesService.convertToOs(q.id, { dias });
      toast.success(`OS ${r.osNumero} criada · ${r.sanitariosReservados} reservados`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const duplicateQuote = async (q: Quote) => {
    try {
      const r = await quotesService.duplicate(q.id);
      toast.success(`Orçamento ${r.numero} criado`);
      await load();
      openEdit(r.id);
    } catch (e: any) { toast.error(e.message); }
  };

  /** Gera o PDF, envia ao servidor e retorna a URL pública absoluta. */
  const uploadQuotePdf = async (q: Quote): Promise<string> => {
    const blob = await generateQuotePdfBlob(q);
    const { fileUrl } = await quotesService.uploadPdf(q.id, blob);
    const origin = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${origin}${fileUrl}`;
  };

  const shareViaWhatsApp = async (q: Quote) => {
    let phone = (q.responsavelTelefone || '').replace(/\D/g, '');
    if (!phone) {
      const cust = customers.find(c => c.id === q.customerId);
      phone = (cust?.contactPhone || '').replace(/\D/g, '');
    }
    
    if (!phone) {
      toast.error('Cadastre o telefone do responsável ou do cliente para enviar por WhatsApp.');
      return;
    }
    
    const waNumber = phone.length <= 11 ? `55${phone}` : phone;
    setWorking(q.id);
    const t = toast.loading('Gerando e enviando PDF...');
    try {
      const url = await uploadQuotePdf(q);
      const nome = q.responsavelNome ? `, ${q.responsavelNome}` : '';
      const empresa = q.companyRazaoSocial ? ` da ${q.companyRazaoSocial}` : '';
      const msg = `Olá${nome}! Segue o orçamento ${q.numero}${empresa}:\n${url}`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
      toast.success('WhatsApp aberto', { id: t });
    } catch (e: any) {
      toast.error(e.message || 'Falha ao preparar compartilhamento', { id: t });
    } finally {
      setWorking(null);
    }
  };

  const shareViaEmail = async (q: Quote) => {
    let email = (q.responsavelEmail || '').trim();
    if (!email) {
      const cust = customers.find(c => c.id === q.customerId);
      email = (cust?.email || '').trim();
    }

    if (!email) {
      toast.error('Cadastre o e-mail do responsável ou do cliente.');
      return;
    }

    setWorking(q.id);
    const t = toast.loading('Gerando e enviando PDF...');
    try {
      const url = await uploadQuotePdf(q);
      const nome = q.responsavelNome ? `, ${q.responsavelNome}` : '';
      const subject = `Orçamento ${q.numero}${q.companyRazaoSocial ? ' - ' + q.companyRazaoSocial : ''}`;
      const body = `Olá${nome},\n\nSegue o orçamento ${q.numero} em anexo:\n${url}\n\nAtenciosamente.`;
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      toast.success('E-mail preparado', { id: t });
    } catch (e: any) {
      toast.error(e.message || 'Falha ao preparar e-mail', { id: t });
    } finally {
      setWorking(null);
    }
  };



  // Badge de validade — só faz sentido em 'enviado' (aguardando resposta).
  const validadeBadge = (q: Quote) => {
    if (q.status !== 'enviado') return null;
    const d = daysUntilExpire(q.dataEmissao, q.validadeDias);
    if (d === null) return null;
    if (d < 0) return (
      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive gap-1 text-[10px]">
        <AlertTriangle className="h-3 w-3" /> Vencido
      </Badge>
    );
    if (d <= 3) return (
      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive gap-1 text-[10px]">
        <Clock className="h-3 w-3" /> Vence em {d}d
      </Badge>
    );
    if (d <= 7) return (
      <Badge variant="outline" className="border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-foreground))] gap-1 text-[10px]">
        <Clock className="h-3 w-3" /> Vence em {d}d
      </Badge>
    );
    return null;
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="min-h-screen bg-background">
      {/* ---------- Header ---------- */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/10 via-background/85 to-[hsl(var(--warning-soft))]/40 backdrop-blur-md border-b border-border/70">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold mb-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
                <FileText className="h-3 w-3" />
              </span>
              Orçamentos
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">Propostas comerciais</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crie, envie e acompanhe orçamentos até a conversão em Ordem de Serviço.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} className="transition-all duration-200">
              <RefreshCcw className="h-4 w-4 mr-1.5" />Recarregar
            </Button>
            <Button size="sm" onClick={openNew} className="transition-all duration-200 shadow-sm hover:shadow-md bg-gradient-to-r from-primary to-primary/85 hover:brightness-110">
              <Plus className="h-4 w-4 mr-1.5" />Novo orçamento
            </Button>
          </div>
        </div>
      </div>


      <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-6">
        {/* ---------- KPIs ---------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<Pencil className="h-4 w-4" />}
            label="Rascunhos"
            value={String(kpis.rascunhos)}
            tone="muted"
            active={filterStatus === 'rascunho'}
            onClick={() => setFilterStatus(s => s === 'rascunho' ? 'all' : 'rascunho')}
          />
          <KpiCard
            icon={<Send className="h-4 w-4" />}
            label="Aguardando resposta"
            value={String(kpis.enviados)}
            tone="brand"
            active={filterStatus === 'enviado'}
            onClick={() => setFilterStatus(s => s === 'enviado' ? 'all' : 'enviado')}
          />
          <KpiCard
            icon={<ClipboardCheck className="h-4 w-4" />}
            label="Aprovados no mês"
            value={String(kpis.aprovadosMes)}
            hint={kpis.valorAprovadosMes > 0 ? BRL(kpis.valorAprovadosMes) : undefined}
            tone="success"
            active={filterStatus === 'aprovado'}
            onClick={() => setFilterStatus(s => s === 'aprovado' ? 'all' : 'aprovado')}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Ticket médio"
            value={BRL(kpis.ticketMedio)}
            tone="warning"
            hint="Média de aprovados + convertidos"
          />
        </div>

        {/* ---------- Filtros ---------- */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div className="space-y-1 flex-1 min-w-[220px]">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 transition-colors"
                  placeholder="Nº, cliente ou empresa…"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <SearchableSelect
                value={filterStatus}
                onValueChange={(v: any) => setFilterStatus(v)}
                triggerClassName="h-9 w-[150px]"
                placeholder="Status"
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'rascunho', label: 'Rascunho' },
                  { value: 'enviado', label: 'Enviado' },
                  { value: 'aprovado', label: 'Aprovado' },
                  { value: 'recusado', label: 'Recusado' },
                  { value: 'convertido', label: 'Convertido' },
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Modalidade</Label>
              <SearchableSelect
                value={filterModalidade}
                onValueChange={(v: any) => setFilterModalidade(v)}
                triggerClassName="h-9 w-[130px]"
                placeholder="Modalidade"
                options={[
                  { value: 'all', label: 'Todas' },
                  { value: 'diaria', label: 'Diária' },
                  { value: 'mensal', label: 'Mensal' },
                ]}
              />
            </div>
            {companies.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Empresa emissora</Label>
                <SearchableSelect
                  value={filterCompany}
                  onValueChange={setFilterCompany}
                  triggerClassName="h-9 w-[200px]"
                  placeholder="Empresa"
                  searchPlaceholder="Buscar empresa..."
                  options={[
                    { value: 'all', label: 'Todas' },
                    ...companies.map(c => ({ value: c.id, label: c.razaoSocial })),
                  ]}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Validade</Label>
              <Button
                type="button"
                variant={filterExpiring ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterExpiring(v => !v)}
                className="h-9 transition-all duration-200"
              >
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                Vencendo (7d)
              </Button>
            </div>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost" size="sm" onClick={clearFilters}
                className="h-9 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Limpar ({activeFiltersCount})
              </Button>
            )}
            <div className="ml-auto text-xs text-muted-foreground tabular-nums">
              {filterExpiring
                ? <>{filtered.length} vencendo · {totalCount} no total</>
                : <>{list.length} nesta página · {totalCount} no total</>}
            </div>
          </CardContent>
        </Card>

        {/* ---------- Lista ---------- */}
        {loading ? (
          <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed border-border/60"><CardContent className="p-16 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-foreground">Nenhum orçamento encontrado</p>
            <p className="text-sm mt-1">
              {activeFiltersCount > 0
                ? 'Ajuste ou limpe os filtros para ver mais resultados.'
                : 'Clique em "Novo orçamento" para começar.'}
            </p>
            {activeFiltersCount > 0 && (
              <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                Limpar filtros
              </Button>
            )}
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(q => {
              const venc = validadeBadge(q);
              const accent =
                q.status === 'aprovado'   ? 'before:bg-[hsl(var(--success))]' :
                q.status === 'enviado'    ? 'before:bg-primary' :
                q.status === 'recusado'   ? 'before:bg-destructive' :
                q.status === 'convertido' ? 'before:bg-[hsl(var(--warning))]' :
                                            'before:bg-muted-foreground/40';
              return (
                <Card
                  key={q.id}
                  className={cn(
                    'group relative overflow-hidden border-border/70 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer',
                    "before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1",
                    accent,
                  )}
                  onClick={() => openEdit(q.id)}
                >
                  <CardContent className="p-4 space-y-3">

                    {/* Cabeçalho */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[11px] text-muted-foreground">{q.numero}</div>
                        <div className="text-sm font-semibold text-foreground truncate mt-0.5">
                          {q.customerName || '—'}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {q.companyRazaoSocial}
                        </div>
                      </div>
                      <StatusBadge status={q.status} />
                    </div>

                    {/* Meta */}
                    <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {q.modalidade === 'diaria' ? 'Diária' : 'Mensal'}
                      </Badge>
                      {q.tipoLocacao && (
                        <Badge variant="outline" className="text-[10px] font-normal capitalize">
                          {q.tipoLocacao}
                        </Badge>
                      )}
                      <span className="ml-auto tabular-nums">{formatDateBR(q.dataEmissao)}</span>
                    </div>

                    {venc && <div>{venc}</div>}

                    {/* Total */}
                    <div className="flex items-end justify-between pt-2 border-t border-border/60">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
                      <div className="text-xl font-bold text-foreground tabular-nums leading-none">
                        {BRL(q.total)}
                      </div>
                    </div>

                    {/* Ações rápidas */}
                    <div
                      className="flex items-center gap-0.5 pt-2 border-t border-border/60"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconAction label="Editar" onClick={() => openEdit(q.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconAction>
                      {q.status === 'rascunho' && (
                        <IconAction label="Marcar como enviado" tone="brand" onClick={() => quickStatus(q, 'enviado')}>
                          <Send className="h-3.5 w-3.5" />
                        </IconAction>
                      )}
                      {q.status === 'enviado' && (
                        <>
                          <IconAction label="Aprovar" tone="success" onClick={() => quickStatus(q, 'aprovado')}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </IconAction>
                          <IconAction label="Recusar" tone="danger" onClick={() => quickStatus(q, 'recusado')}>
                            <XCircle className="h-3.5 w-3.5" />
                          </IconAction>
                        </>
                      )}
                      <IconAction label="Baixar PDF" onClick={() => generateQuotePdf(q)}>
                        <FileDown className="h-3.5 w-3.5" />
                      </IconAction>
                      <IconAction
                        label={q.responsavelTelefone ? `Enviar por WhatsApp (${q.responsavelTelefone})` : 'Cadastre o telefone do responsável'}
                        tone="success"
                        onClick={() => shareViaWhatsApp(q)}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </IconAction>
                      <IconAction
                        label={q.responsavelEmail ? `Enviar por e-mail (${q.responsavelEmail})` : 'Cadastre o e-mail do responsável'}
                        tone="brand"
                        onClick={() => shareViaEmail(q)}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </IconAction>
                      <IconAction label="Duplicar" onClick={() => duplicateQuote(q)}>
                        <Copy className="h-3.5 w-3.5" />
                      </IconAction>
                      {q.status !== 'convertido' && (
                        <IconAction label="Converter em OS" tone="warning" onClick={() => quickConvert(q)}>
                          <ClipboardCheck className="h-3.5 w-3.5" />
                        </IconAction>
                      )}
                      <div className="ml-auto">
                        <IconAction label="Excluir" tone="danger" onClick={() => removeQuote(q.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconAction>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Paginação server-side (aparece só quando há mais de 1 página) */}
        <PaginationBar
          page={page} pageSize={pageSize} total={totalCount}
          onPageChange={setPage} onPageSizeChange={setPageSize}
          pageSizeOptions={[12, 24, 48, 96]}
        />
      </div>

      {/* Editor Modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Editar orçamento` : 'Novo orçamento'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              {/* Cabeçalho do orçamento */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Empresa emissora (CNPJ) *</label>
                  <SearchableSelect
                    value={editing.companyId || ''}
                    placeholder="— Selecione —"
                    searchPlaceholder="Buscar empresa..."
                    options={companies.map(c => ({
                      value: c.id,
                      label: c.sigla ? `${c.sigla} — ${c.razaoSocial || '(sem razão)'}` : (c.razaoSocial || '(sem razão)'),
                      hint: c.cnpj || undefined,
                    }))}
                    onValueChange={(v) => setEditing({ ...editing, companyId: v || undefined })}
                  />
                  {!companies.length && (
                    <p className="text-[10px] text-orange-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" /> Cadastre uma empresa em Configurações.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cliente *</label>
                  <SearchableSelect
                    value={editing.customerId || ''}
                    placeholder="— Selecione —"
                    searchPlaceholder="Buscar cliente..."
                    options={customers.map(c => ({
                      value: c.id,
                      label: c.customerName || '(sem nome)',
                      hint: c.document || undefined,
                    }))}
                    onValueChange={(v) => setEditing({ ...editing, customerId: v || undefined })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Modalidade *</label>
                  <div className="flex gap-1">
                    <Button type="button" variant={editing.modalidade === 'diaria' ? 'default' : 'outline'}
                            size="sm" className="flex-1"
                            onClick={() => setEditing({ ...editing, modalidade: 'diaria' })}>Diária</Button>
                    <Button type="button" variant={editing.modalidade === 'mensal' ? 'default' : 'outline'}
                            size="sm" className="flex-1"
                            onClick={() => setEditing({ ...editing, modalidade: 'mensal' })}>Mensal</Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo de locação</label>
                  <div className="flex gap-1 flex-wrap">
                    {([
                      { v: 'obra', l: '🏗️ Obra' },
                      { v: 'evento', l: '🎉 Evento' },
                      { v: 'industria', l: '🏭 Indústria' },
                      { v: 'outro', l: 'Outro' },
                    ] as const).map(o => (
                      <Button key={o.v} type="button" size="sm"
                              variant={editing.tipoLocacao === o.v ? 'default' : 'outline'}
                              onClick={() => setEditing({ ...editing, tipoLocacao: o.v })}>
                        {o.l}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data de entrega (opcional)</label>
                  <Input type="date" value={editing.dataEntrega || ''}
                         onChange={e => setEditing({ ...editing, dataEntrega: e.target.value })} />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Pode ficar em branco e ser preenchida depois.
                  </p>
                </div>
                {editing.modalidade === 'mensal' && editing.tipoLocacao !== 'evento' && editing.tipoLocacao !== 'outro' && (
                  <div>
                    <label className="text-xs text-muted-foreground">Limpezas por semana</label>
                    <Input type="number" min={0} max={7} step={1}
                           value={editing.limpezasSemanais ?? ''}
                           onChange={e => setEditing({ ...editing, limpezasSemanais: e.target.value === '' ? undefined : parseInt(e.target.value) || 0 })} />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Quantidade de manutenções/limpezas previstas por semana.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Endereço de entrega</label>
                  <Textarea rows={2} value={editing.enderecoEntrega || ''}
                            onChange={e => setEditing({ ...editing, enderecoEntrega: e.target.value })}
                            placeholder="Endereço onde os sanitários serão instalados (usado no contrato e ao vincular sanitários)" />
                </div>
                {editing.tipoLocacao === 'evento' && (
                  <div>
                    <label className="text-xs text-muted-foreground">Data de recolhimento</label>
                    <Input type="date" value={editing.dataRecolhimento || ''}
                           onChange={e => setEditing({ ...editing, dataRecolhimento: e.target.value })} />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Em eventos, o fechamento da OS dispara o recolhimento automático.
                    </p>
                  </div>
                )}
              </div>

              {/* Responsável pelo orçamento (contato do pedido) */}
              <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                <div className="text-sm font-semibold">Responsável pelo orçamento</div>
                <p className="text-[11px] text-muted-foreground -mt-1">
                  Contato específico deste orçamento (quem solicitou). Não altera o cadastro do cliente.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Nome</label>
                    <Input value={editing.responsavelNome || ''} maxLength={160}
                           placeholder="Ex.: Maria Souza"
                           onChange={e => setEditing({ ...editing, responsavelNome: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Telefone</label>
                    <Input value={editing.responsavelTelefone || ''} maxLength={32}
                           placeholder="(11) 91234-5678"
                           onChange={e => setEditing({ ...editing, responsavelTelefone: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">E-mail</label>
                    <Input type="email" value={editing.responsavelEmail || ''} maxLength={160}
                           placeholder="responsavel@empresa.com"
                           onChange={e => setEditing({ ...editing, responsavelEmail: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Tabela de itens */}

              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[40px_1fr_2fr_90px_120px_120px_40px] gap-2 px-3 py-2 bg-gray-100 text-xs font-semibold">
                   <div title="Definir tipo de sanitário">Tipo?</div>
                  <div>Produto</div>
                  <div>Descrição</div>
                  <div className="text-right">Qtd</div>
                  <div className="text-right">Valor Unit.</div>
                  <div className="text-right">Total</div>
                  <div />
                </div>
                {editing.items.map((it: any, i) => (
                  <div key={it.__uid ?? i} className="grid grid-cols-[40px_1fr_2fr_90px_120px_120px_40px] gap-2 px-3 py-2 border-t items-center">
                    <div className="flex justify-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col items-center gap-1">
                              <Switch 
                                checked={!!(it as any).isSanitario} 
                                onCheckedChange={(val) => updateItem(i, { isSanitario: val, isGenericService: !val })} 
                                className="scale-75"
                              />
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">
                                {(it as any).isSanitario ? 'Ativo' : 'Serv'}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {(it as any).isSanitario 
                              ? "Ativo (Sanitário): Pede fotos e numeração na entrega/recolhimento" 
                              : "Serviço: Pede apenas relato e foto final na OS"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                     {(it as any).isSanitario ? (
                      <SearchableSelect
                        value={it.produto}
                        placeholder="Tipo de sanitário..."
                        options={SANITARIO_CATEGORIAS.map(cat => ({
                          value: sanitarioCategoriaLabel(cat.value),
                          label: sanitarioCategoriaLabel(cat.value),
                        }))}
                        onValueChange={(val) => {
                          updateItem(i, { 
                            produto: val,
                            descricao: it.descricao || `Locação de Sanitário Químico tipo ${val}`
                          });
                        }}
                      />
                    ) : (
                      <Input value={it.produto} placeholder="Ex.: Sanitário Standard"
                             onChange={e => updateItem(i, { produto: e.target.value })} />
                    )}
                    <Input value={it.descricao || ''} placeholder="Opcional"
                           onChange={e => updateItem(i, { descricao: e.target.value })} />

                    <Input type="number" min={0} step="0.01" className="text-right"
                           value={it.quantidade}
                           onChange={e => updateItem(i, { quantidade: parseFloat(e.target.value) || 0 })} />
                    <Input type="number" min={0} step="0.01" className="text-right"
                           value={it.valorUnitario}
                           onChange={e => updateItem(i, { valorUnitario: parseFloat(e.target.value) || 0 })} />
                    <div className="text-right text-sm font-semibold tabular-nums">
                      {BRL(Number(it.quantidade) * Number(it.valorUnitario))}
                    </div>
                    <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50"
                            aria-label="Remover item do orçamento"
                            onClick={() => removeItem(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="px-3 py-2 border-t bg-gray-50">
                  <Button size="sm" variant="ghost" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />Adicionar item
                  </Button>
                </div>
              </div>

              {/* Resumo + condições */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Forma de pagamento *</label>
                    <div className="flex gap-1">
                      {([
                        { v: 'cartao', l: '💳 Cartão' },
                        { v: 'pix', l: '⚡ PIX' },
                        { v: 'boleto', l: '🧾 Boleto' },
                      ] as const).map(o => (
                        <Button key={o.v} type="button" size="sm" className="flex-1"
                                variant={editing.formaPagamento === o.v ? 'default' : 'outline'}
                                onClick={() => setEditing({ ...editing, formaPagamento: o.v })}>
                          {o.l}
                        </Button>
                      ))}
                    </div>
                    {editing.formaPagamento === 'boleto' && (
                      <p className="text-[11px] text-blue-700 mt-1">
                        Vencimento do boleto: <strong>{formatDateBR(calcVencimentoBoleto(editing.dataEntrega))}</strong>
                        {' '}(28 dias após a entrega — regra fixa).
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Observações livres</label>
                    <Textarea rows={2} value={editing.observacoes}
                              onChange={e => setEditing({ ...editing, observacoes: e.target.value })}
                              placeholder="Observações específicas deste orçamento (opcional)" />
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-900 whitespace-pre-line">
                    <div className="font-semibold mb-1">Observações fixas (sempre incluídas no orçamento e na OS):</div>
                    {OBSERVACAO_FIXA_LOCACAO}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Validade (dias)</label>
                      <Input type="number" min={1} value={editing.validadeDias}
                             onChange={e => setEditing({ ...editing, validadeDias: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Desconto (%)</label>
                      <Input type="number" min={0} max={100} step="0.01" value={editing.descontoPct}
                             onChange={e => setEditing({ ...editing, descontoPct: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Frete (R$)</label>
                      <Input type="number" min={0} step="0.01" value={editing.frete}
                             onChange={e => setEditing({ ...editing, frete: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span>Subtotal</span><span className="tabular-nums">{BRL(subtotal)}</span></div>
                  <div className="flex justify-between text-sm text-red-700">
                    <span>Desconto ({editing.descontoPct || 0}%)</span>
                    <span className="tabular-nums">- {BRL(subtotal * (editing.descontoPct || 0) / 100)}</span>
                  </div>
                  <div className="flex justify-between text-sm"><span>Frete</span><span className="tabular-nums">{BRL(editing.frete)}</span></div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg text-primary">
                    <span>Total</span><span className="tabular-nums">{BRL(total)}</span>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Status</label>
                    <SearchableSelect
                      value={editing.status}
                      options={[
                        { value: 'rascunho', label: 'Rascunho' },
                        { value: 'enviado', label: 'Enviado' },
                        { value: 'aprovado', label: 'Aprovado' },
                        { value: 'recusado', label: 'Recusado' },
                      ]}
                      onValueChange={(v) => setEditing({ ...editing, status: v as Quote['status'] })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Fechar</Button>
            <Button variant="outline" onClick={exportPdf} disabled={saving}>
              <FileDown className="h-4 w-4 mr-1" />Salvar e gerar PDF
            </Button>
            <Button variant="outline" onClick={() => exportContract('pdf')} disabled={saving} className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              <FileSignature className="h-4 w-4 mr-1" />Gerar contrato
            </Button>
            <Button variant="outline" onClick={() => exportContract('docx')} disabled={saving} className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              <FileSignature className="h-4 w-4 mr-1" />Contrato Word
            </Button>

            <Button variant="outline" onClick={convertToOs} disabled={!editing?.id}>
              <CheckCircle2 className="h-4 w-4 mr-1" />Converter em OS
            </Button>
            <Button onClick={save} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};

export default ErpQuotes;

// =====================
// KPI Card
// =====================
type KpiTone = 'brand' | 'success' | 'warning' | 'muted';
function KpiCard({
  icon, label, value, tone, active, onClick, hint,
}: {
  icon: React.ReactNode; label: string; value: string; tone: KpiTone;
  active?: boolean; onClick?: () => void; hint?: string;
}) {
  const toneFg: Record<KpiTone, string> = {
    brand:   'text-primary',
    success: 'text-[hsl(var(--success))]',
    warning: 'text-[hsl(var(--warning))]',
    muted:   'text-muted-foreground',
  };
  const toneIconBg: Record<KpiTone, string> = {
    brand:   'bg-primary text-primary-foreground',
    success: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
    warning: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
    muted:   'bg-muted-foreground/80 text-background',
  };
  const toneAccent: Record<KpiTone, string> = {
    brand:   'from-primary/12 via-primary/5 to-transparent',
    success: 'from-[hsl(var(--success-soft))] via-[hsl(var(--success-soft))]/40 to-transparent',
    warning: 'from-[hsl(var(--warning-soft))] via-[hsl(var(--warning-soft))]/40 to-transparent',
    muted:   'from-muted via-muted/40 to-transparent',
  };
  const toneBar: Record<KpiTone, string> = {
    brand:   'bg-primary',
    success: 'bg-[hsl(var(--success))]',
    warning: 'bg-[hsl(var(--warning))]',
    muted:   'bg-muted-foreground/40',
  };
  const Wrapper: any = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={hint}
      className={cn(
        'group relative overflow-hidden text-left rounded-xl border border-border/70 bg-card p-4 shadow-sm',
        'transition-all duration-200',
        onClick && 'hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40',
        onClick && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active && 'border-primary/60 ring-2 ring-primary/20',
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-1', toneBar[tone])} />
      <div className={cn('absolute inset-0 -z-0 bg-gradient-to-br opacity-70', toneAccent[tone])} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className={cn('h-9 w-9 rounded-lg grid place-items-center shadow-sm', toneIconBg[tone])}>
            {icon}
          </div>
          {active && <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Filtrado</span>}
        </div>
        <div className={cn('mt-3 text-2xl font-bold tabular-nums leading-tight', toneFg[tone])}>{value}</div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</div>}
      </div>
    </Wrapper>
  );
}


// =====================
// Icon action button (row actions)
// =====================
function IconAction({
  label, children, onClick, tone,
}: {
  label: string; children: React.ReactNode; onClick: () => void;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
}) {
  const toneCls =
    tone === 'brand'   ? 'text-primary hover:bg-primary/10' :
    tone === 'success' ? 'text-[hsl(var(--success))] hover:bg-[hsl(var(--success-soft))]' :
    tone === 'warning' ? 'text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning-soft))]' :
    tone === 'danger'  ? 'text-destructive hover:bg-destructive/10' :
    'text-muted-foreground hover:text-foreground hover:bg-muted';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost" size="sm"
          onClick={onClick}
          className={cn('h-8 w-8 p-0 transition-colors', toneCls)}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
