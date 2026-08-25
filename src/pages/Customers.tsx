/**
 * Aba Clientes — orquestrador com paginação server-side.
 *
 * Mudanças:
 *  - useCustomersPaged (server-side pagination + busca + filtros + KPIs)
 *  - CRUD individual (POST/PATCH/DELETE), sem mais bulk save
 *  - checagem de duplicata via lookup no servidor antes de salvar
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Filter, Loader2, Plus, RefreshCcw, Search, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { Customer } from '@/hooks/useCustomers';
import { useCustomersPaged, CustomerFilter } from '@/hooks/useCustomersPaged';
import { useCustomerSanCounts } from '@/hooks/useCustomerSanCounts';
import { onlyDigits } from '@/utils/brazilianDocs';
import { CustomerCard } from '@/components/customers/CustomerCard';
import { CustomerEditDialog } from '@/components/customers/CustomerEditDialog';
import { CustomerHistoryDialog } from '@/components/customers/CustomerHistoryDialog';
import { CustomerDuplicateDialog } from '@/components/customers/CustomerDuplicateDialog';
import { PaginationBar } from '@/components/PaginationBar';
import { API_BASE_URL } from '@/services/config';

const FILTER_OPTIONS: { value: CustomerFilter; label: string }[] = [
  { value: 'all',      label: 'Todos' },
  { value: 'pj',       label: 'Pessoa Jurídica' },
  { value: 'pf',       label: 'Pessoa Física' },
  { value: 'withSan',  label: 'Com sanitários' },
  { value: 'noCoords', label: 'Sem coordenadas' },
];

/** Lookup no servidor: busca duplicata por documento (ignorando um id). */
async function lookupDuplicateByDocument(document: string, excludeId?: string): Promise<Customer | null> {
  const doc = onlyDigits(document);
  if (!doc) return null;
  const t = localStorage.getItem('auth_token');
  const r = await fetch(`${API_BASE_URL}/customers?search=${encodeURIComponent(doc)}&page=1&pageSize=25`, {
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const rows: Customer[] = j.data || [];
  return rows.find(x => x.id !== excludeId && onlyDigits(x.document || '') === doc) || null;
}

const Customers: React.FC = () => {
  // ---------- estado de filtros (com debounce na busca) ----------
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<CustomerFilter>('all');
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // debounce 350ms
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [filterMode, onlyDuplicates, pageSize]);

  // ---------- estado de fluxo ----------
  const [editing, setEditing] = useState<Customer | null>(null);
  const [isNewDraft, setIsNewDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{ existing: Customer; attempted: Customer } | null>(null);

  // ---------- dados ----------
  const {
    items, total, kpis, loading, error, refetch,
    createCustomer, patchCustomer, removeCustomer,
  } = useCustomersPaged({ search, filter: filterMode, onlyDuplicates, page, pageSize });

  const counts = useCustomerSanCounts(items.length);
  const sanCount = (c: Customer) => counts[(c.customerName || '').toLowerCase()] || 0;

  // ---------- handlers ----------
  const openNew = () => {
    setIsNewDraft(true);
    setEditing({
      id: uuidv4(),
      customerName: '', address: '', cep: '',
      personType: 'PJ', document: '',
    });
  };
  const closeEditor = () => { setEditing(null); setIsNewDraft(false); };

  const persistCustomer = async (c: Customer, force = false) => {
    setSaving(true);
    try {
      if (!force && c.document) {
        const dup = await lookupDuplicateByDocument(c.document, c.id);
        if (dup) {
          setDuplicatePrompt({ existing: dup, attempted: c });
          setSaving(false);
          return;
        }
      }
      if (isNewDraft) {
        await createCustomer(c);
        toast.success('Cliente cadastrado!');
      } else {
        await patchCustomer(c);
        toast.success('Cliente atualizado!');
      }
      setDuplicatePrompt(null);
      closeEditor();
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setDeleting(true);
    try {
      await removeCustomer(target.id);
      toast.success(`"${target.customerName || 'Cliente'}" removido.`);
      setConfirmDelete(null);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover cliente');
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = !!search || filterMode !== 'all' || onlyDuplicates;

  // ---------- render ----------
  const initialLoading = loading && items.length === 0 && !error;

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost" size="icon" asChild
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              title="Voltar" aria-label="Voltar ao início"
            >
              <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="h-9 w-9 rounded-lg bg-primary/5 text-primary flex items-center justify-center ring-1 ring-primary/10 shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-semibold tracking-tight leading-none">Clientes</h1>
              <p className="text-[11px] text-muted-foreground mt-1 leading-none tabular-nums">
                {kpis.total} {kpis.total === 1 ? 'cadastro' : 'cadastros'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm" onClick={refetch}
              className="hidden sm:inline-flex h-9 gap-1.5 text-xs font-medium"
              disabled={loading}
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Recarregar
            </Button>
            <Button size="sm" onClick={openNew} className="h-9 gap-1.5 text-xs font-medium shadow-sm">
              <Plus className="h-4 w-4" />
              Novo cliente
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* KPIs compactos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile label="Total" value={kpis.total} />
          <KpiTile label="Pessoa Jurídica" value={kpis.pj} />
          <KpiTile label="Pessoa Física" value={kpis.pf} />
          <KpiTile label="Sem coordenadas" value={kpis.semCoord} accent={kpis.semCoord > 0 ? 'warn' : undefined} />
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="truncate">Falha ao carregar clientes: {error}</span>
            </div>
            <Button size="sm" variant="outline" onClick={refetch} className="shrink-0">Tentar novamente</Button>
          </div>
        )}

        {/* Toolbar */}
        <Card className="border-border/70 shadow-[var(--shadow-sm)]">
          <div className="p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 pr-9 h-10 bg-background border-border/80 focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Buscar por nome, documento, endereço, telefone…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                aria-label="Buscar clientes"
              />
              {searchInput && (
                <button
                  type="button" onClick={() => setSearchInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Filter className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <select
                  className="h-10 pl-8 pr-8 rounded-md border border-border/80 bg-background text-sm appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                  value={filterMode}
                  onChange={e => setFilterMode(e.target.value as CustomerFilter)}
                  aria-label="Filtrar"
                >
                  {FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {kpis.duplicados > 0 && (
                <button
                  type="button"
                  onClick={() => setOnlyDuplicates(v => !v)}
                  className={[
                    'inline-flex items-center gap-1.5 h-10 px-3 rounded-md border text-xs font-medium transition-colors',
                    onlyDuplicates
                      ? 'bg-warning text-warning-foreground border-warning'
                      : 'bg-warning-soft text-warning-foreground border-warning/30 hover:bg-warning/20',
                  ].join(' ')}
                  title="Mostrar apenas duplicados"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {kpis.duplicados} duplicado{kpis.duplicados > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="px-4 pb-3 -mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Exibindo <strong className="text-foreground tabular-nums">{total}</strong>{' '}
                resultado{total === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => { setSearchInput(''); setFilterMode('all'); setOnlyDuplicates(false); }}
                className="text-primary hover:underline font-medium"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </Card>

        {/* Grid */}
        {initialLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-background/60">
            <div className="px-6 py-16 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {hasActiveFilters ? 'Nenhum cliente corresponde aos filtros' : 'Nenhum cliente cadastrado ainda'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveFilters
                  ? 'Tente ajustar a busca ou os filtros acima.'
                  : 'Clique em "Novo cliente" para começar.'}
              </p>
              {!hasActiveFilters && (
                <Button size="sm" onClick={openNew} className="mt-5 gap-1.5">
                  <Plus className="h-4 w-4" />Cadastrar primeiro cliente
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map(c => (
                <CustomerCard
                  key={c.id}
                  customer={c}
                  sanCount={sanCount(c)}
                  isDuplicate={!!c.isDuplicate}
                  duplicateReason={c.isDuplicate ? 'Duplicado' : undefined}
                  onEdit={() => { setIsNewDraft(false); setEditing(c); }}
                  onHistory={setHistoryFor}
                  onDelete={setConfirmDelete}
                />
              ))}
            </div>
            <PaginationBar
              page={page} pageSize={pageSize} total={total}
              onPageChange={setPage} onPageSizeChange={setPageSize}
              alwaysShow
            />
          </>
        )}

        <p className="text-[11px] text-muted-foreground text-center pt-2">
          Cada cadastro, edição ou remoção é salvo automaticamente no servidor.
        </p>
      </main>

      <CustomerEditDialog
        open={!!editing} initial={editing} isNew={isNewDraft} saving={saving}
        onClose={closeEditor} onSave={c => persistCustomer(c, false)}
      />

      <CustomerHistoryDialog customer={historyFor} onClose={() => setHistoryFor(null)} />

      <CustomerDuplicateDialog
        open={!!duplicatePrompt}
        existing={duplicatePrompt?.existing || null}
        attempted={duplicatePrompt?.attempted || null}
        saving={saving}
        onCancel={() => setDuplicatePrompt(null)}
        onProceed={() => duplicatePrompt && persistCustomer(duplicatePrompt.attempted, true)}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && !deleting && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Você está prestes a remover <strong className="text-foreground">{confirmDelete?.customerName || 'este cliente'}</strong>.
                </p>
                {confirmDelete && sanCount(confirmDelete) > 0 && (
                  <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft text-warning-foreground px-3 py-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Este cliente possui <strong>{sanCount(confirmDelete)}</strong> sanitário(s) alocado(s).
                      A remoção não afeta o histórico já registrado.
                    </span>
                  </p>
                )}
                <p className="text-muted-foreground">Esta ação é imediata e não pode ser desfeita.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Removendo…</> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const KpiTile: React.FC<{ label: string; value: number; accent?: 'warn' }> = ({ label, value, accent }) => (
  <Card className={[
    'p-3 border-border/70',
    accent === 'warn' ? 'bg-warning-soft/40 border-warning/30' : 'bg-background',
  ].join(' ')}>
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-xl font-semibold tabular-nums mt-0.5">{value}</div>
  </Card>
);

export default Customers;
