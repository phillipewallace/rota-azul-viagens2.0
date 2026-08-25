/**
 * ERP · Contratos — lista, cria/edita contratos (gerados ou externos)
 * com vínculo opcional a cliente + OS, valor mensal, dia de vencimento,
 * renovação automática e PDF assinado anexo.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileSignature, Plus, Search, Upload, FileDown, Power, PowerOff,
  Calendar, Loader2, Trash2, Pencil, Copy,
  AlertTriangle, TrendingUp, CheckCircle2, X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { contractsService, type Contract } from '@/services/contracts';
import { erpService, type ErpCompany, uploadSignedPdf } from '@/services/erp';
import { serviceOrdersService } from '@/services/quotes';
import { API_BASE_URL } from '@/services/config';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { generateContractPdf } from '@/utils/contractPdf';
import { BoletoVencimentoDialog } from '@/components/erp/BoletoVencimentoDialog';
import { formatDateBR } from '@/utils/dateFormat';
import PaginationBar from '@/components/PaginationBar';


// Cliente vem do endpoint /customers que retorna camelCase (customerName)
type Customer = { id: string; customerName: string; document?: string };

import { BRL } from '@/utils/currency';
const D = (s?: string | null) => s ? formatDateBR(s) : '—';

const isoDate = (s?: string | null) => (s ? String(s).slice(0, 10) : '');
const isBeforeIso = (a?: string | null, b?: string | null) => {
  const da = isoDate(a);
  const db = isoDate(b);
  return !!da && !!db && da < db;
};

const getContractVigencia = (c: Contract) => {
  const isEvento = c.tipoContrato === 'evento';
  const inicio = isEvento ? (c.dataEvento || c.dataInicio) : c.dataInicio;
  // Para eventos, só usa data de recolhimento explícita — sem fallback para
  // data_fim_prevista (que costuma vir errada da OS). Sem recolhimento => "---".
  let fim: string | null | undefined = isEvento ? c.dataRecolhimento : c.dataFim;
  if (isEvento && isBeforeIso(fim, inicio)) fim = null;

  return { inicio, fim };
};

/** Dias até uma data (positivo = futuro, negativo = passado). Null se não houver data. */
const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(iso); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

const TIPO_LABEL: Record<string, string> = {
  locacao: 'Locação', evento: 'Evento', obra: 'Obra',
};

const ErpContracts: React.FC = () => {
  const [list, setList] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [kpis, setKpis] = useState({ ativos: 0, mrr: 0, vencendo: 0, encerradosMes: 0 });
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [oses, setOses] = useState<any[]>([]);
  const [filterAtivo, setFilterAtivo] = useState<'all' | 'true' | 'false'>('all');
  const [filterTipo, setFilterTipo] = useState<'all' | 'locacao' | 'evento' | 'obra'>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterVencendo, setFilterVencendo] = useState<boolean>(false);
  // Pré-preenche a busca via ?search= (usado ao navegar da OS → Contratos).
  const [search, setSearch] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('search') || '';
  });
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [deleting, setDeleting] = useState<Contract | null>(null);
  const [vencTarget, setVencTarget] = useState<Contract | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const serverParams = useMemo(() => {
    const p: Parameters<typeof contractsService.listPaged>[0] = {};
    if (filterAtivo !== 'all') p.ativo = filterAtivo === 'true';
    if (filterTipo !== 'all') p.tipoContrato = filterTipo;
    if (filterCompany !== 'all') p.companyId = filterCompany;
    if (filterVencendo) p.vencendo = true;
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [filterAtivo, filterTipo, filterCompany, filterVencendo, debouncedSearch]);

  const load = async () => {
    setLoading(true);
    try {
      const [pg, k] = await Promise.all([
        contractsService.listPaged({ ...serverParams, page, pageSize }),
        contractsService.kpis(),
      ]);
      setList(pg.data);
      setTotal(pg.total);
      setKpis(k);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const loadAux = async () => {
    try {
      const [cs, cu, os] = await Promise.all([
        erpService.listCompanies(),
        fetchCustomers(),
        serviceOrdersService.list().catch(() => []),
      ]);
      setCompanies(cs);
      setCustomers(cu);
      setOses(os);
    } catch (e: any) { toast.error(e.message); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [serverParams, page, pageSize]);
  useEffect(() => { setPage(1); }, [serverParams, pageSize]);
  useEffect(() => { loadAux(); }, []);

  // Página já vem filtrada do server
  const filtered = list;

  const activeFiltersCount =
    (filterAtivo !== 'all' ? 1 : 0) +
    (filterTipo !== 'all' ? 1 : 0) +
    (filterCompany !== 'all' ? 1 : 0) +
    (filterVencendo ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const clearFilters = () => {
    setFilterAtivo('all'); setFilterTipo('all');
    setFilterCompany('all'); setFilterVencendo(false); setSearch('');
  };


  const onSaved = async () => {
    setOpenForm(false); setEditing(null);
    await load();
  };

  const toggleActive = async (c: Contract) => {
    try {
      await contractsService.update(c.id, { ativo: !c.ativo });
      toast.success(c.ativo ? 'Contrato encerrado' : 'Contrato reativado');
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const duplicate = async (c: Contract) => {
    try {
      const full = await contractsService.get(c.id);
      const today = new Date().toISOString().slice(0, 10);
      await contractsService.create({
        companyId: full.companyId,
        customerId: full.customerId,
        osId: full.osId || null,
        tipoContrato: full.tipoContrato,
        descricao: full.descricao ? `${full.descricao} (cópia)` : '(cópia)',
        dataInicio: today,
        diaVencimento: full.diaVencimento,
        valorMensal: Number(full.valorMensal || 0),
        frete: 0,
        renovacaoAutomatica: full.renovacaoAutomatica,
        ativo: true,
        observacoes: full.observacoes || null,
        dataEvento: full.dataEvento || null,
        dataRecolhimento: full.dataRecolhimento || null,
        localEvento: full.localEvento || null,
        horaEntrega: full.horaEntrega || null,
        valorTotalEvento: full.valorTotalEvento || null,
        origem: 'manual',
      } as any);
      toast.success('Contrato duplicado');
      await load();
    } catch (e: any) { toast.error(e.message || 'Erro ao duplicar'); }
  };




  const remove = async () => {
    if (!deleting) return;
    try {
      await contractsService.remove(deleting.id);
      toast.success('Contrato removido');
      setDeleting(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const buildPdfSource = (full: Contract) => {
    const tipoCtr = (full.tipoContrato as any) || 'locacao';
    const isEvento = tipoCtr === 'evento';
    const itemsFromOs: any[] = Array.isArray((full as any).osSnapshot?.items)
      ? (full as any).osSnapshot.items
      : (Array.isArray((full as any).items) ? (full as any).items : []);
    return {
      numero: full.numero,
      tipo: 'os' as const,
      tipoContrato: tipoCtr,
      modalidade: (isEvento ? 'diaria' : 'mensal') as 'diaria' | 'mensal',
      dataEmissao: full.dataInicio,
      dataInicio: full.dataInicio,
      dataEntrega: full.dataEvento || full.dataInicio,
      dataFimPrevista: full.dataRecolhimento || full.dataFim || null,
      dataRecolhimento: full.dataRecolhimento || null,
      horaEntrega: full.horaEntrega || null,
      localEvento: full.localEvento || null,
      enderecoEntrega: full.localEvento || (full.customerSnapshot?.address ?? null),
      observacoes: full.observacoes || null,
      total: Number(full.valorTotalEvento ?? full.valorMensal ?? 0),
      frete: Number(full.frete || 0),
      companySnapshot: full.companySnapshot,
      customerSnapshot: full.customerSnapshot,
      companyRazaoSocial: full.companyRazaoSocial,
      companyCnpj: full.companyCnpj,
      customerName: full.customerName,
      responsavelNome: full.responsavelNome || null,
      responsavelTelefone: full.responsavelTelefone || null,
      responsavelEmail: full.responsavelEmail || null,
      items: itemsFromOs,
    };
  };

  const downloadContractPdf = async (
    c: Contract,
    opts: { preview: boolean; dataVencimento?: string; format?: 'pdf' | 'docx' },
  ) => {
    try {
      const full = await contractsService.get(c.id);
      const src: any = buildPdfSource(full);
      if ((!src.items || src.items.length === 0) && (full as any).osId) {
        try {
          const os = await serviceOrdersService.get((full as any).osId);
          if (Array.isArray((os as any).items) && (os as any).items.length) {
            src.items = (os as any).items;
          }
        } catch { /* mantém fallback */ }
      }
      if (opts.dataVencimento) src.dataVencimento = opts.dataVencimento;
      if (opts.format === 'docx') {
        const { generateContractDoc } = await import('@/utils/contractDoc');
        await generateContractDoc(src);
        toast.success('Contrato Word gerado');
        return;
      }
      await generateContractPdf(src, { preview: opts.preview });
      if (!opts.preview) toast.success('Contrato gerado');
    } catch (e: any) { toast.error(e.message || 'Erro ao gerar contrato'); }
  };


  // ---- Sub-render: badge de vencimento -------------------------------------
  const vencimentoBadge = (c: Contract) => {
    if (!c.ativo) return null;
    const { fim } = getContractVigencia(c);
    const d = daysUntil(fim);
    if (d === null) return null;
    if (d < 0) {
      return (
        <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive gap-1">
          <AlertTriangle className="h-3 w-3" /> Vencido
        </Badge>
      );
    }
    if (d <= 7) {
      return (
        <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive gap-1">
          <AlertTriangle className="h-3 w-3" /> {d}d
        </Badge>
      );
    }
    if (d <= 30) {
      return (
        <Badge variant="outline" className="border-warning/40 bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-foreground))] gap-1">
          <AlertTriangle className="h-3 w-3" /> {d}d
        </Badge>
      );
    }
    return null;
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-[1400px] mx-auto space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-primary/10 via-[hsl(var(--success-soft))]/50 to-[hsl(var(--warning-soft))]/40 p-5 md:p-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-[hsl(var(--success))]/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold mb-1">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <FileSignature className="h-3 w-3" />
            </span>
            Contratos
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gestão de Contratos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Contratos ativos alimentam o módulo Financeiro com a geração mensal de recibos.
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setOpenForm(true); }}
          className="relative transition-all duration-200 shadow-sm hover:shadow-md bg-gradient-to-r from-primary to-primary/85 hover:brightness-110"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Novo contrato
        </Button>
      </header>


      {/* ------- KPIs ------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Ativos"
          value={String(kpis.ativos)}
          tone="success"
          active={filterAtivo === 'true' && !filterVencendo}
          onClick={() => { setFilterAtivo('true'); setFilterVencendo(false); }}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Receita mensal recorrente"
          value={BRL(kpis.mrr)}
          tone="brand"
          hint="Soma de valorMensal dos ativos"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Vencendo em 30 dias"
          value={String(kpis.vencendo)}
          tone="warning"
          active={filterVencendo}
          onClick={() => { setFilterVencendo(v => !v); setFilterAtivo('true'); }}
        />
        <KpiCard
          icon={<PowerOff className="h-4 w-4" />}
          label="Encerrados no mês"
          value={String(kpis.encerradosMes)}
          tone="muted"
          active={filterAtivo === 'false'}
          onClick={() => { setFilterAtivo(a => a === 'false' ? 'all' : 'false'); setFilterVencendo(false); }}
        />
      </div>

      {/* ------- Filtros ------- */}
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
                placeholder="Nº, cliente, empresa, descrição…"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <SearchableSelect
              value={filterAtivo}
              onValueChange={(v: any) => setFilterAtivo(v)}
              triggerClassName="h-9 w-[140px]"
              placeholder="Status"
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'true', label: 'Ativos' },
                { value: 'false', label: 'Encerrados' },
              ]}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <SearchableSelect
              value={filterTipo}
              onValueChange={(v: any) => setFilterTipo(v)}
              triggerClassName="h-9 w-[140px]"
              placeholder="Tipo"
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'locacao', label: 'Locação' },
                { value: 'evento', label: 'Evento' },
                { value: 'obra', label: 'Obra' },
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
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost" size="sm" onClick={clearFilters}
              className="h-9 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Limpar ({activeFiltersCount})
            </Button>
          )}
          <div className="ml-auto text-xs text-muted-foreground tabular-nums">
            {filtered.length} nesta página · {total} no total
          </div>
        </CardContent>
      </Card>

      {/* ------- Tabela ------- */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[110px]">Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Empresa</TableHead>
                  <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Vigência</TableHead>
                  <TableHead className="text-right">Valor mensal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-[220px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                  </TableCell></TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-14 text-muted-foreground">
                    <FileSignature className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <div className="text-sm">Nenhum contrato encontrado.</div>
                    {activeFiltersCount > 0 && (
                      <Button variant="link" size="sm" onClick={clearFilters} className="mt-1">
                        Limpar filtros
                      </Button>
                    )}
                  </TableCell></TableRow>
                )}
                {!loading && filtered.map(c => {
                  const vigencia = getContractVigencia(c);
                  const venc = vencimentoBadge(c);
                  const tipo = (c.tipoContrato || 'locacao') as string;
                  return (
                    <TableRow
                      key={c.id}
                      className={cn(
                        'transition-colors hover:bg-primary/[0.03]',
                        !c.ativo && 'opacity-60 hover:opacity-100'
                      )}
                    >
                      <TableCell className="font-mono text-xs relative">
                        <span
                          className={cn(
                            'absolute left-0 top-2 bottom-2 w-[3px] rounded-r',
                            c.ativo ? 'bg-[hsl(var(--success))]' : 'bg-muted-foreground/40'
                          )}
                        />
                        <span className="pl-2 text-muted-foreground">{c.numero}</span>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="font-medium text-foreground truncate">{c.customerName || '—'}</div>
                        {c.descricao && (
                          <div className="text-[11px] text-muted-foreground truncate">{c.descricao}</div>
                        )}
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[160px] truncate">
                        {c.companyRazaoSocial || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {TIPO_LABEL[tipo] || tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        <div className="text-foreground">{D(vigencia.inicio)}</div>
                        <div className="text-muted-foreground flex items-center gap-1.5">
                          <span>até {vigencia.fim ? D(vigencia.fim) : '---'}</span>
                          {venc}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {c.tipoContrato === 'evento' ? (
                          <>
                            <div className="font-semibold tabular-nums">{BRL(Number(c.valorTotalEvento || 0))}</div>
                            <div className="text-[11px] text-muted-foreground">valor do evento</div>
                          </>
                        ) : (
                          <>
                            <div className="font-semibold tabular-nums">{BRL(Number(c.valorMensal))}</div>
                            <div className="text-[11px] text-muted-foreground">venc. dia {c.diaVencimento}</div>
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.ativo
                          ? <Badge className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--success-foreground))]">Ativo</Badge>
                          : <Badge variant="secondary">Encerrado</Badge>}
                        {c.renovacaoAutomatica && c.ativo && (
                          <div className="text-[10px] text-muted-foreground mt-1">renov. auto</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-0.5">

                          <IconAction
                            label="Gerar contrato (PDF)"
                            onClick={() => setVencTarget(c)}
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </IconAction>
                          {c.pdfUrl && (
                            <IconAction
                              label="Abrir PDF assinado"
                              tone="success"
                              onClick={() => window.open(toAbsoluteUrl(c.pdfUrl!), '_blank')}
                            >
                              <FileDown className="h-3.5 w-3.5" />
                            </IconAction>
                          )}
                          <IconAction
                            label="Duplicar"
                            onClick={() => duplicate(c)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </IconAction>
                          <IconAction
                            label="Editar"
                            onClick={() => { setEditing(c); setOpenForm(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </IconAction>
                          <IconAction
                            label={c.ativo ? 'Encerrar contrato' : 'Reativar contrato'}
                            tone={c.ativo ? 'warning' : 'success'}
                            onClick={() => toggleActive(c)}
                          >
                            {c.ativo ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                          </IconAction>
                          <IconAction
                            label="Excluir"
                            tone="danger"
                            onClick={() => setDeleting(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconAction>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 pb-3">
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100, 200]}
            />
          </div>
        </CardContent>
      </Card>


      <ContractFormDialog
        open={openForm}
        editing={editing}
        companies={companies}
        customers={customers}
        oses={oses}
        onClose={() => { setOpenForm(false); setEditing(null); }}
        onSaved={onSaved}
      />

      <BoletoVencimentoDialog
        open={!!vencTarget}
        onClose={() => setVencTarget(null)}
        contractLabel={vencTarget?.numero}
        formaPagamento="boleto"
        dataEntrega={vencTarget?.dataEvento || vencTarget?.dataInicio || null}
        onConfirm={async ({ dataVencimento, preview, format }) => {
          if (vencTarget) {
            await downloadContractPdf(vencTarget, { preview, dataVencimento, format });
            setVencTarget(null);
          }
        }}

      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato {deleting?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os recibos vinculados também serão removidos. Esta ação é definitiva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    </TooltipProvider>
  );
};

export default ErpContracts;

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
  label, children, onClick, tone, loading,
}: {
  label: string; children: React.ReactNode; onClick: () => void;
  tone?: 'success' | 'warning' | 'danger'; loading?: boolean;
}) {
  const toneCls =
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
          disabled={loading}
          className={cn('h-8 w-8 p-0 transition-colors', toneCls)}
          aria-label={label}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

// =====================
// Form Dialog
// =====================
function ContractFormDialog({
  open, editing, companies, customers, oses, onClose, onSaved,
}: {
  open: boolean; editing: Contract | null;
  companies: ErpCompany[]; customers: Customer[]; oses: any[];
  onClose: () => void; onSaved: () => void;
}) {
  const empty = {
    companyId: '', customerId: '', osId: '',
    tipoContrato: 'locacao' as 'locacao' | 'evento' | 'obra',
    descricao: '', dataInicio: new Date().toISOString().slice(0, 10),
    primeiraCompetencia: '',
    diaVencimento: 10, valorMensal: 0,
    frete: 0,
    renovacaoAutomatica: true, ativo: true,
    pdfUrl: '', observacoes: '',
    dataEvento: '', dataRecolhimento: '', localEvento: '', horaEntrega: '',
    valorTotalEvento: 0,
    enderecoObra: '', cno: '',
    responsavelNome: '', responsavelTelefone: '', responsavelEmail: '',
  };

  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  // Se o usuário editou manualmente o dia, paramos de auto-preencher.
  // Limpar o campo reativa o auto-preenchimento.
  const [diaVencTouched, setDiaVencTouched] = useState(false);

  // Vencimento sugerido = dia do mês em (dataInicio + 28 dias). Clampeado 1-28.
  const suggestDiaVenc = (dataInicio: string): number | '' => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) return '';
    const [y, m, d] = dataInicio.split('-').map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    const venc = new Date(base.getTime() + 28 * 24 * 60 * 60 * 1000);
    return Math.min(28, Math.max(1, venc.getUTCDate()));
  };

  useEffect(() => {
    if (editing) {
      setForm({
        companyId: editing.companyId || '',
        customerId: editing.customerId || '',
        osId: editing.osId || '',
        tipoContrato: (editing.tipoContrato as any) || 'locacao',
        descricao: editing.descricao || '',
        dataInicio: (editing.dataInicio || '').slice(0, 10),
        primeiraCompetencia: ((editing as any).primeiraCompetencia || '').slice(0, 7),
        diaVencimento: editing.diaVencimento,
        valorMensal: Number(editing.valorMensal),
        frete: Number(editing.frete || 0),
        renovacaoAutomatica: editing.renovacaoAutomatica,
        ativo: editing.ativo,
        pdfUrl: editing.pdfUrl || '',
        observacoes: editing.observacoes || '',
        dataEvento: (editing.dataEvento || '').slice(0, 10),
        dataRecolhimento: (editing.dataRecolhimento || '').slice(0, 10),
        localEvento: editing.localEvento || '',
        horaEntrega: editing.horaEntrega || '',
        valorTotalEvento: Number(editing.valorTotalEvento || 0),
        enderecoObra: (editing as any).enderecoObra || '',
        cno: (editing as any).cno || '',
        responsavelNome: editing.responsavelNome || '',
        responsavelTelefone: editing.responsavelTelefone || '',
        responsavelEmail: editing.responsavelEmail || '',
      });

      // Editando um contrato existente: o dia já foi decidido, não sobrescreve.
      setDiaVencTouched(true);
    } else { setForm(empty); setDiaVencTouched(false); }
    // eslint-disable-next-line
  }, [editing, open]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadSignedPdf(file);
      setForm((f: any) => ({ ...f, pdfUrl: url }));
      toast.success('PDF anexado');
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    // Guarda síncrona: previne duplicidade em duplo-clique/enter rápido
    // antes de o React aplicar o `disabled` no botão.
    if (savingRef.current) return;
    if (!form.companyId || !form.customerId || !form.dataInicio) {
      toast.error('Empresa, cliente e data de início são obrigatórios');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        ...form,
        osId: form.osId || null,
        primeiraCompetencia: form.primeiraCompetencia || '',
        diaVencimento: Number(form.diaVencimento) || 10,
        valorMensal: Number(form.valorMensal) || 0,
        frete: Number(form.frete) || 0,
      };
      if (editing) await contractsService.update(editing.id, payload);
      else await contractsService.create({ ...payload, origem: 'manual' } as any);

      toast.success(editing ? 'Contrato atualizado' : 'Contrato criado');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar Contrato ${editing.numero}` : 'Novo Contrato'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Empresa Emissora *</Label>
            <SearchableSelect
              value={form.companyId}
              onValueChange={(v) => setForm({ ...form, companyId: v })}
              placeholder="Selecione…"
              searchPlaceholder="Buscar empresa..."
              options={companies.map(c => ({ value: c.id, label: c.razaoSocial }))}
            />
          </div>
          <div>
            <Label className="text-xs">Cliente *</Label>
            <SearchableSelect
              value={form.customerId}
              onValueChange={(v) => setForm({ ...form, customerId: v })}
              placeholder="Selecione…"
              searchPlaceholder="Buscar cliente..."
              options={customers.map(c => ({ value: c.id, label: c.customerName }))}
            />
          </div>
          <div>
            <Label className="text-xs">Tipo de contrato *</Label>
            <SearchableSelect
              value={form.tipoContrato}
              onValueChange={(v) => setForm({ ...form, tipoContrato: v })}
              placeholder="Tipo"
              options={[
                { value: 'obra', label: 'Obra (construção / canteiro)' },
                { value: 'locacao', label: 'Locação mensal recorrente' },
                { value: 'evento', label: 'Evento (curta duração)' },
              ]}
            />
          </div>
          <div>
            <Label className="text-xs">OS vinculada (opcional)</Label>
            <SearchableSelect
              value={form.osId || '__none__'}
              onValueChange={(v) => setForm({ ...form, osId: v === '__none__' ? '' : v })}
              placeholder="Nenhuma"
              searchPlaceholder="Buscar OS..."
              options={[
                { value: '__none__', label: 'Nenhuma' },
                ...oses.map((o: any) => ({
                  value: o.id,
                  label: `${o.numero}${o.customerName ? ` — ${o.customerName}` : ''}`,
                })),
              ]}
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Início do contrato *</Label>
            <Input type="date" value={form.dataInicio}
              onChange={(e) => {
                const dataInicio = e.target.value;
                setForm((f: any) => {
                  const next = { ...f, dataInicio };
                  if (!diaVencTouched) {
                    const sug = suggestDiaVenc(dataInicio);
                    if (sug !== '') next.diaVencimento = sug;
                  }
                  return next;
                });
              }} />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1">
              <Calendar className="h-3 w-3" /> 1º mês de faturamento (opcional)
            </Label>
            <Input
              type="month"
              value={form.primeiraCompetencia || ''}
              onChange={(e) => setForm({ ...form, primeiraCompetencia: e.target.value })}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Se preenchido, o contrato só aparece no Financeiro a partir desse mês —
              competências anteriores não geram cobrança, mesmo com início antes.
              Deixe vazio para faturar desde o início do contrato.
            </p>
          </div>
          {form.tipoContrato !== 'evento' ? (
            <>
              <div>
                <Label className="text-xs flex items-center justify-between gap-2">
                  <span>Dia de vencimento do boleto (1-28)</span>
                  {!diaVencTouched && form.dataInicio && (
                    <span className="text-[10px] font-normal text-muted-foreground">auto · 28 dias após início</span>
                  )}
                </Label>
                <Input
                  type="number" min={1} max={28} value={form.diaVencimento}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Qualquer digitação manual (inclusive apagar) desliga o auto.
                    setDiaVencTouched(true);
                    setForm({ ...form, diaVencimento: v });
                  }}
                  onBlur={(e) => {
                    // Se sair vazio, reativa o auto e sugere a partir da data de início.
                    if (e.target.value === '') {
                      setDiaVencTouched(false);
                      const sug = suggestDiaVenc(form.dataInicio);
                      if (sug !== '') setForm({ ...form, diaVencimento: sug });
                    }
                  }}
                />

              </div>
              <div>
                <Label className="text-xs">Valor mensal (R$)</Label>
                <Input type="number" step="0.01" value={form.valorMensal}
                  onChange={(e) => setForm({ ...form, valorMensal: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Frete (R$) — cobrado UMA ÚNICA VEZ no primeiro recibo</Label>
                <Input type="number" step="0.01" min={0} value={form.frete}
                  onChange={(e) => setForm({ ...form, frete: e.target.value })}
                  placeholder="0,00" />
                <p className="text-[11px] text-slate-500 mt-1">
                  Se preenchido, o valor do frete será somado ao 1º recibo gerado e aparecerá como item separado na nota. Os recibos seguintes cobrarão apenas o valor mensal.
                </p>
              </div>
            </>
          ) : (

            <>
              <div>
                <Label className="text-xs">Data do evento</Label>
                <Input type="date" value={form.dataEvento}
                  onChange={(e) => setForm({ ...form, dataEvento: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Hora de entrega</Label>
                <Input type="time" value={form.horaEntrega}
                  onChange={(e) => setForm({ ...form, horaEntrega: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Data de recolhimento</Label>
                <Input type="date" value={form.dataRecolhimento}
                  onChange={(e) => setForm({ ...form, dataRecolhimento: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Valor total do evento (R$)</Label>
                <Input type="number" step="0.01" value={form.valorTotalEvento}
                  onChange={(e) => setForm({ ...form, valorTotalEvento: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Local do evento (endereço de entrega)</Label>
                <Input value={form.localEvento}
                  onChange={(e) => setForm({ ...form, localEvento: e.target.value })}
                  placeholder="Rua, número, bairro, cidade/UF" />
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <Label className="text-xs">Descrição / objeto do contrato</Label>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder={form.tipoContrato === 'evento'
                ? 'Ex.: 3 banheiros químicos + 1 PNE para evento corporativo'
                : 'Ex.: Locação mensal de 2 sanitários — Obra Castelo Branco'} />
          </div>

          <div className="md:col-span-2">
            <Label className="text-xs">
              Endereço da {form.tipoContrato === 'evento' ? 'evento' : 'obra'} (entrega)
            </Label>
            <Input value={form.enderecoObra}
              onChange={(e) => setForm({ ...form, enderecoObra: e.target.value })}
              placeholder="Rua, número, bairro, cidade/UF — se diferente do endereço do cliente" />
            <p className="text-[11px] text-muted-foreground mt-1">
              Aparecerá em campo separado no recibo, para casos em que o endereço de entrega difere do cadastro do cliente.
            </p>
          </div>

          <div className="md:col-span-2">
            <Label className="text-xs">CNO / Ordem de Compra</Label>
            <Input value={form.cno}
              onChange={(e) => setForm({ ...form, cno: e.target.value })}
              placeholder="Ex.: CNO 12.345.67890/12 ou OC nº 4500123456" />
          </div>

          <div className="md:col-span-2 border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="text-sm font-semibold">Responsável pelo contrato</div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Contato específico deste contrato (quem solicitou a locação). Não altera o cadastro do cliente.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={form.responsavelNome} maxLength={160}
                  onChange={(e) => setForm({ ...form, responsavelNome: e.target.value })}
                  placeholder="Ex.: João Silva" />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.responsavelTelefone} maxLength={32}
                  onChange={(e) => setForm({ ...form, responsavelTelefone: e.target.value })}
                  placeholder="(11) 91234-5678" />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={form.responsavelEmail} maxLength={160}
                  onChange={(e) => setForm({ ...form, responsavelEmail: e.target.value })}
                  placeholder="responsavel@empresa.com" />
              </div>
            </div>
          </div>




          <div className="flex items-center justify-between border rounded-lg p-3 md:col-span-2">
            <div>
              <div className="text-sm font-medium">Renovação automática mensal</div>
              <div className="text-xs text-slate-500">Se ativo, todo mês gera recibo automaticamente para cobrança.</div>
            </div>
            <Switch checked={form.renovacaoAutomatica}
              onCheckedChange={(v) => setForm({ ...form, renovacaoAutomatica: v })} />
          </div>

          {editing && (
            <div className="flex items-center justify-between border rounded-lg p-3 md:col-span-2">
              <div>
                <div className="text-sm font-medium">Contrato ativo</div>
                <div className="text-xs text-slate-500">Desative para encerrar o ciclo de cobrança.</div>
              </div>
              <Switch checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          )}

          <div className="md:col-span-2">
            <Label className="text-xs">Anexar contrato assinado (PDF — opcional)</Label>
            <div className="flex items-center gap-2">
              <Input type="file" accept="application/pdf"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                disabled={uploading} />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.pdfUrl && (
                <Button variant="outline" size="sm" onClick={() => window.open(form.pdfUrl, '_blank')}>
                  <FileDown className="h-3.5 w-3.5 mr-1" /> Ver PDF
                </Button>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="transition-all duration-200">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            {editing ? 'Salvar' : 'Criar contrato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Fallback simple customers fetch (compatível com endpoint /api/customers)
async function fetchCustomers(): Promise<Customer[]> {
  try {
    const t = localStorage.getItem('auth_token');
    const r = await fetch(`${API_BASE_URL}/customers`, {
      headers: t ? { Authorization: `Bearer ${t}` } : undefined,
    });
    if (r.ok) {
      const data = await r.json();
      return Array.isArray(data) ? data : (data?.customers || []);
    }
  } catch {}
  return [];
}
