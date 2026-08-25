/**
 * Nova/Editar Medição — layout premium em 2 colunas:
 *  - Esquerda: contratos ativos do cliente com itens parseados da descrição
 *    (checkbox por item, "sugerir preço" rateado, "copiar do último recibo").
 *  - Direita: itens adicionados, agrupados por contrato, edição inline.
 *  - Header e footer sticky com total ao vivo.
 *  - Autosave em localStorage e atalhos de teclado.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Loader2, Plus, Trash2, ChevronDown, ChevronRight, Sparkles,
  Copy, FileText, CheckCircle2, Search, Wand2, PackageOpen, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { contractsService, type Contract } from '@/services/contracts';
import { medicoesService, type Medicao, type MedicaoItem } from '@/services/medicoes';
import { erpService, type ErpCompany } from '@/services/erp';
import { formatDateBR } from '@/utils/dateFormat';

import { BRL } from '@/utils/currency';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  competencia: string;
  periodoInicioDefault?: string;
  periodoFimDefault?: string;
  editing?: Medicao | null;
  onSaved: (id: string) => void;
}

type Row = MedicaoItem & { key: string };

// Interpreta o campo "descrição/objeto" do contrato como lista de itens.
export function parseContractItems(text?: string | null): { quantidade: number; descricao: string }[] {
  if (!text) return [];
  return text
    .split(/\r?\n|;/)
    .map((l) => l.replace(/^[\s\-•*]+/, '').trim())
    .filter((l) => l && !/^(objeto|descri[cç][aã]o|itens?)\s*:?\s*$/i.test(l))
    .map((line) => {
      const m = line.match(/^(\d+)\s*(?:x|un|unid|-|–|:|\.|\))\s*(.+)$/i);
      if (m) return { quantidade: Number(m[1]) || 1, descricao: m[2].trim() };
      const m2 = line.match(/^(\d+)\s+(.+)$/);
      if (m2) return { quantidade: Number(m2[1]) || 1, descricao: m2[2].trim() };
      return { quantidade: 1, descricao: line };
    })
    .filter((x) => x.descricao.length > 0);
}

const rowFromDraft = (
  c: Contract, descricao: string, quantidade: number, valorUnit: number,
  periodoInicio: string, periodoFim: string,
): Row => ({
  key: `p-${c.id}-${Math.random().toString(36).slice(2, 8)}`,
  contractId: c.id,
  contractNumero: c.numero,
  descricao,
  quantidade,
  unidade: 'UN',
  valorUnit,
  descontoItem: 0,
  valorTotal: Math.max(0, quantidade * valorUnit),
  periodoInicio,
  periodoFim,
});

const rowSuggested = (c: Contract, periodoInicio: string, periodoFim: string): Row => ({
  key: `c-${c.id}-${Math.random().toString(36).slice(2, 8)}`,
  contractId: c.id,
  contractNumero: c.numero,
  descricao: `Locação — Contrato ${c.numero}`,
  quantidade: 1,
  unidade: 'MÊS',
  valorUnit: Number(c.valorMensal || 0),
  descontoItem: 0,
  valorTotal: Number(c.valorMensal || 0),
  periodoInicio,
  periodoFim,
});

const rowEmpty = (): Row => ({
  key: `m-${Math.random().toString(36).slice(2, 8)}`,
  contractId: null,
  contractNumero: null,
  descricao: '',
  quantidade: 1,
  unidade: 'UN',
  valorUnit: 0,
  descontoItem: 0,
  valorTotal: 0,
  periodoInicio: null,
  periodoFim: null,
});

const OBS_CHIPS = [
  'Pagamento via PIX',
  'Vencimento em 10 dias',
  'Vencimento em 30 dias',
  'Referente à locação do mês',
  'Sujeito à conferência',
];

const monthRange = (offset = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const last = new Date(y, d.getMonth() + 1, 0).getDate();
  return { ini: `${y}-${m}-01`, fim: `${y}-${m}-${String(last).padStart(2, '0')}` };
};

export const MedicaoDialog: React.FC<Props> = ({
  open, onOpenChange, competencia, periodoInicioDefault, periodoFimDefault, editing, onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [prevMedicoes, setPrevMedicoes] = useState<Medicao[]>([]);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [periodoIni, setPeriodoIni] = useState(periodoInicioDefault || '');
  const [periodoFim, setPeriodoFim] = useState(periodoFimDefault || '');

  const [rows, setRows] = useState<Row[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [observacoes, setObservacoes] = useState('');

  const [contractSearch, setContractSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [contractDrafts, setContractDrafts] = useState<
    Record<string, { quantidade: number; descricao: string; valorUnit: number; checked: boolean }[]>
  >({});
  const [downloadAfterSave, setDownloadAfterSave] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // ---------- Load ----------
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      contractsService.list({ ativo: true }).catch(() => [] as Contract[]),
      erpService.listCompanies().catch(() => [] as ErpCompany[]),
    ]).then(([cs, comps]) => {
      setContracts(cs);
      setCompanies(comps);
    }).finally(() => setLoading(false));
  }, [open]);

  // Reset / hydrate on open
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCustomerId(editing.customerId || null);
      setCompanyId(editing.companyId || null);
      setPeriodoIni(editing.periodoInicio || periodoInicioDefault || '');
      setPeriodoFim(editing.periodoFim || periodoFimDefault || '');
      setDesconto(Number(editing.desconto || 0));
      setObservacoes(editing.observacoes || '');
      setRows((editing.items || []).map((it, i) => ({ ...it, key: `e-${i}-${Math.random().toString(36).slice(2, 6)}` })));
    } else {
      setCustomerId(null); setCompanyId(null);
      setPeriodoIni(periodoInicioDefault || '');
      setPeriodoFim(periodoFimDefault || '');
      setDesconto(0); setObservacoes(''); setRows([]);
    }
    setExpanded({});
    setContractDrafts({});
    setContractSearch('');
    setDownloadAfterSave(false);
  }, [open, editing, periodoInicioDefault, periodoFimDefault]);

  // ---------- Autosave (nova medição) ----------
  const draftKey = editing ? null : 'medicao:draft:v1';
  // Restaurar rascunho ao abrir
  useEffect(() => {
    if (!open || !draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || !d.rows?.length) return;
      toast('Rascunho recuperado', {
        description: `${d.rows.length} ${d.rows.length === 1 ? 'item' : 'itens'} da sessão anterior`,
        action: {
          label: 'Restaurar',
          onClick: () => {
            setCustomerId(d.customerId || null);
            setCompanyId(d.companyId || null);
            setPeriodoIni(d.periodoIni || '');
            setPeriodoFim(d.periodoFim || '');
            setDesconto(Number(d.desconto || 0));
            setObservacoes(d.observacoes || '');
            setRows((d.rows || []).map((r: any, i: number) => ({ ...r, key: `r-${i}-${Math.random().toString(36).slice(2, 6)}` })));
          },
        },
      });
    } catch { /* noop */ }
  }, [open, draftKey]);

  useEffect(() => {
    if (!open || !draftKey) return;
    if (rows.length === 0 && !customerId) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          customerId, companyId, periodoIni, periodoFim, desconto, observacoes, rows,
        }));
      } catch { /* noop */ }
    }, 800);
    return () => clearTimeout(t);
  }, [open, draftKey, customerId, companyId, periodoIni, periodoFim, desconto, observacoes, rows]);

  // ---------- Derivados ----------
  const customers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; document?: string }>();
    for (const c of contracts) {
      if (!c.customerId) continue;
      if (!map.has(c.customerId)) {
        map.set(c.customerId, { id: c.customerId, name: c.customerName || '(sem nome)', document: c.customerDocument });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [contracts]);

  const contratosDoCliente = useMemo(() => {
    if (!customerId) return [];
    return contracts
      .filter(c => c.customerId === customerId)
      .filter(c => !contractSearch || `${c.numero} ${c.descricao || ''}`.toLowerCase().includes(contractSearch.toLowerCase()));
  }, [contracts, customerId, contractSearch]);

  // Resumo do cliente selecionado
  const customerSummary = useMemo(() => {
    if (!customerId) return null;
    const ativos = contracts.filter(c => c.customerId === customerId);
    const somaMensal = ativos.reduce((s, c) => s + Number(c.valorMensal || 0), 0);
    const ultima = prevMedicoes
      .filter(m => m.customerId === customerId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
    return { nContratos: ativos.length, somaMensal, ultima };
  }, [customerId, contracts, prevMedicoes]);

  // Carrega medições anteriores do cliente (para "última medição" e "copiar preços").
  useEffect(() => {
    if (!open || !customerId) { setPrevMedicoes([]); return; }
    medicoesService.list({ customerId })
      .then((r) => setPrevMedicoes(r || []))
      .catch(() => setPrevMedicoes([]));
  }, [open, customerId]);

  // Subtotal/total
  const subtotal = rows.reduce((s, r) => s + Number(r.valorTotal || 0), 0);
  const total = Math.max(0, subtotal - Number(desconto || 0));
  const canSave = rows.length > 0 && !!customerId;

  // ---------- Handlers ----------
  const recalcRow = (r: Row): Row => ({
    ...r,
    valorTotal: Math.max(0, Number(r.quantidade || 0) * Number(r.valorUnit || 0) - Number(r.descontoItem || 0)),
  });
  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => r.key === key ? recalcRow({ ...r, ...patch }) : r));
  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key));

  const ensureDraftsFor = (c: Contract) => {
    setContractDrafts((prev) => {
      if (prev[c.id]) return prev;
      const parsed = parseContractItems(c.descricao);
      return {
        ...prev,
        [c.id]: parsed.map((it) => ({ ...it, valorUnit: 0, checked: true })),
      };
    });
  };

  const toggleExpand = (c: Contract) => {
    setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }));
    ensureDraftsFor(c);
    if (!companyId && c.companyId) setCompanyId(c.companyId);
  };

  const updateDraft = (
    contractId: string, idx: number,
    patch: Partial<{ quantidade: number; descricao: string; valorUnit: number; checked: boolean }>,
  ) => {
    setContractDrafts((prev) => {
      const list = [...(prev[contractId] || [])];
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, [contractId]: list };
    });
  };

  const addSelectedDrafts = (c: Contract) => {
    const list = (contractDrafts[c.id] || []).filter(d => d.checked && d.descricao.trim() && d.quantidade > 0);
    if (list.length === 0) { toast.error('Nenhum item selecionado válido.'); return; }
    setRows((prev) => [
      ...prev,
      ...list.map((d) => rowFromDraft(c, d.descricao.trim(), d.quantidade, d.valorUnit, periodoIni, periodoFim)),
    ]);
    if (!companyId && c.companyId) setCompanyId(c.companyId);
    toast.success(`${list.length} ${list.length === 1 ? 'item adicionado' : 'itens adicionados'}`);
  };

  const addEmptyDraft = (c: Contract) => {
    setContractDrafts((prev) => ({
      ...prev,
      [c.id]: [...(prev[c.id] || []), { quantidade: 1, descricao: '', valorUnit: 0, checked: true }],
    }));
  };

  const addSuggestedContract = (c: Contract) => {
    setRows(prev => [...prev, rowSuggested(c, periodoIni, periodoFim)]);
    if (!companyId && c.companyId) setCompanyId(c.companyId);
  };

  const addFreeItem = () => setRows(prev => [...prev, rowEmpty()]);

  // Sugere preço rateando valorMensal entre a soma das quantidades dos drafts.
  const suggestPricesFromMensal = (c: Contract) => {
    const list = contractDrafts[c.id] || [];
    const somaQtd = list.reduce((s, d) => s + Number(d.quantidade || 0), 0);
    if (!c.valorMensal || somaQtd <= 0) { toast.error('Sem valor mensal ou quantidades para ratear.'); return; }
    const unit = Number(c.valorMensal) / somaQtd;
    setContractDrafts((prev) => ({
      ...prev,
      [c.id]: (prev[c.id] || []).map(d => ({ ...d, valorUnit: Math.round(unit * 100) / 100 })),
    }));
    toast.success(`Rateio aplicado: ${BRL(unit)}/unid.`);
  };

  // Copia preços da última medição desse contrato.
  const copyFromLastMedicao = async (c: Contract) => {
    try {
      const last = prevMedicoes.find(m => (m.customerId === customerId));
      if (!last) { toast.error('Sem medições anteriores para este cliente.'); return; }
      const full = await medicoesService.get(last.id);
      const items = (full.items || []).filter(it => it.contractId === c.id);
      if (items.length === 0) { toast.error('Última medição não tem itens deste contrato.'); return; }
      setContractDrafts((prev) => {
        const cur = [...(prev[c.id] || [])];
        for (const it of items) {
          const match = cur.findIndex(d => d.descricao.trim().toLowerCase() === (it.descricao || '').trim().toLowerCase());
          if (match >= 0) cur[match] = { ...cur[match], valorUnit: Number(it.valorUnit || 0) };
          else cur.push({ quantidade: Number(it.quantidade || 1), descricao: it.descricao, valorUnit: Number(it.valorUnit || 0), checked: true });
        }
        return { ...prev, [c.id]: cur };
      });
      toast.success(`Preços copiados de ${full.numero}`);
    } catch (e: any) { toast.error(e.message || 'Erro ao copiar'); }
  };

  const applyDiscountPercent = (pct: number) => {
    if (!pct || pct <= 0) return;
    setRows(prev => prev.map(r => recalcRow({
      ...r,
      descontoItem: Math.round(Number(r.quantidade || 0) * Number(r.valorUnit || 0) * (pct / 100) * 100) / 100,
    })));
    toast.success(`Desconto de ${pct}% aplicado a cada item`);
  };

  const clearAllRows = () => {
    if (rows.length === 0) return;
    setRows([]);
    toast('Itens limpos');
  };

  // Agrupa rows por contrato para exibição.
  const rowsByContract = useMemo(() => {
    const groups: Record<string, { numero: string | null; items: Row[] }> = {};
    for (const r of rows) {
      const k = r.contractId || '__free__';
      if (!groups[k]) groups[k] = { numero: r.contractNumero || null, items: [] };
      groups[k].items.push(r);
    }
    return groups;
  }, [rows]);

  const save = useCallback(async () => {
    if (!canSave) { toast.error('Selecione um cliente e ao menos 1 item.'); return; }
    setSaving(true);
    try {
      const payload = {
        customerId: customerId || undefined,
        companyId: companyId || undefined,
        competencia,
        periodoInicio: periodoIni || undefined,
        periodoFim: periodoFim || undefined,
        desconto: Number(desconto || 0),
        observacoes: observacoes || undefined,
        items: rows.map((r, i) => ({
          contractId: r.contractId || null,
          contractNumero: r.contractNumero || null,
          descricao: r.descricao || '—',
          quantidade: Number(r.quantidade || 0),
          unidade: r.unidade || 'UN',
          valorUnit: Number(r.valorUnit || 0),
          descontoItem: Number(r.descontoItem || 0),
          periodoInicio: r.periodoInicio || null,
          periodoFim: r.periodoFim || null,
          ordem: i,
        })),
      };
      let savedId: string;
      let savedNumero: string;
      if (editing) {
        await medicoesService.update(editing.id, payload);
        savedId = editing.id; savedNumero = editing.numero;
        toast.success(`Medição ${editing.numero} atualizada`);
      } else {
        const r = await medicoesService.create(payload);
        savedId = r.id; savedNumero = r.numero;
        toast.success(`Medição ${r.numero} gerada`);
        try { if (draftKey) localStorage.removeItem(draftKey); } catch {}
      }
      onSaved(savedId);
      onOpenChange(false);
      // download opcional
      if (downloadAfterSave) {
        try {
          const full = await medicoesService.get(savedId);
          const { generateMedicaoPdf } = await import('@/utils/medicaoPdf');
          await generateMedicaoPdf(full as any);
        } catch (e: any) { toast.error(e.message || 'PDF falhou'); }
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }, [canSave, customerId, companyId, competencia, periodoIni, periodoFim, desconto, observacoes, rows, editing, onSaved, onOpenChange, downloadAfterSave, draftKey]);

  // Ctrl+Enter para salvar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSave && !saving) save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, canSave, saving, save]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[95vw] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header sticky */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b bg-background/95 backdrop-blur sticky top-0 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {editing ? `Editar medição ${editing.numero}` : 'Nova medição'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Consolide produtos e valores de um ou mais contratos do mesmo cliente.
              </DialogDescription>
            </div>
            <div className="rounded-lg border bg-primary/5 px-4 py-2 text-right shrink-0" aria-live="polite">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total ao vivo</div>
              <div className="text-xl font-bold text-primary tabular-nums">{BRL(total)}</div>
              <div className="text-[10px] text-muted-foreground">
                {rows.length} {rows.length === 1 ? 'item' : 'itens'}
              </div>
            </div>
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <div ref={scrollerRef} className="flex-1 overflow-y-auto">
            {/* Seção 1 — Cliente & Período */}
            <section className="px-5 py-4 border-b bg-muted/20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Cliente</Label>
                  <SearchableSelect
                    value={customerId || ''}
                    disabled={!!editing}
                    placeholder="— Selecione —"
                    searchPlaceholder="Buscar cliente..."
                    triggerClassName="h-9"
                    options={customers.map((c) => ({
                      value: c.id,
                      label: c.name || '(sem nome)',
                      hint: c.document || undefined,
                    }))}
                    onValueChange={(v) => {
                      setCustomerId(v || null);
                      setRows([]);
                      setContractDrafts({});
                      setExpanded({});
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Empresa emissora</Label>
                  <SearchableSelect
                    value={companyId || '__default__'}
                    placeholder="— Padrão do contrato —"
                    searchPlaceholder="Buscar empresa..."
                    triggerClassName="h-9"
                    options={[
                      { value: '__default__', label: '— Padrão do contrato —' },
                      ...companies.map((c) => ({ value: c.id, label: c.razaoSocial || '(sem razão social)' })),
                    ]}
                    onValueChange={(v) => setCompanyId(v === '__default__' ? null : v)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Período de referência</Label>
                  <div className="flex items-center gap-1">
                    <Input type="date" className="h-9" value={periodoIni} onChange={(e) => setPeriodoIni(e.target.value)} />
                    <span className="text-muted-foreground text-xs">→</span>
                    <Input type="date" className="h-9" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
                  </div>
                  <div className="flex gap-1 mt-1">
                    <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px] px-2"
                      onClick={() => { const r = monthRange(0); setPeriodoIni(r.ini); setPeriodoFim(r.fim); }}>
                      <Calendar className="h-3 w-3 mr-1" /> Este mês
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px] px-2"
                      onClick={() => { const r = monthRange(-1); setPeriodoIni(r.ini); setPeriodoFim(r.fim); }}>
                      Mês passado
                    </Button>
                  </div>
                </div>
              </div>

              {/* Resumo do cliente */}
              {customerSummary && (
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground rounded-md border bg-background/60 px-3 py-2">
                  <span><b className="text-foreground">{customerSummary.nContratos}</b> contrato(s) ativo(s)</span>
                  <span>Mensal somado: <b className="text-foreground">{BRL(customerSummary.somaMensal)}</b></span>
                  {customerSummary.ultima ? (
                    <span>Última medição: <b className="text-foreground">{customerSummary.ultima.numero}</b> · {formatDateBR(customerSummary.ultima.createdAt)} · {BRL(Number(customerSummary.ultima.total || 0))}</span>
                  ) : (
                    <span className="italic">Nenhuma medição anterior</span>
                  )}
                </div>
              )}
            </section>

            {/* Seção 2 — Itens (2 colunas) */}
            <section className="px-5 py-4">
              {!customerId ? (
                <div className="text-center text-sm text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                  <PackageOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Selecione um cliente para ver seus contratos e itens.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Coluna esquerda — Contratos + drafts */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Contratos do cliente</div>
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar contrato…"
                          className="h-8 pl-7 w-56 text-xs"
                          value={contractSearch}
                          onChange={(e) => setContractSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    {contratosDoCliente.length === 0 && (
                      <div className="text-xs text-muted-foreground italic border rounded-md p-4 text-center">
                        Nenhum contrato ativo para este cliente.
                      </div>
                    )}

                    <div className="space-y-2">
                      {contratosDoCliente.map((c) => {
                        const isOpen = !!expanded[c.id];
                        const drafts = contractDrafts[c.id] || [];
                        const linhasCount = rows.filter(r => r.contractId === c.id).length;
                        const parsedCount = parseContractItems(c.descricao).length;
                        return (
                          <div key={c.id} className="rounded-md border bg-background overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleExpand(c)}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/40 text-left"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                <Badge variant="outline" className="text-[10px] shrink-0">{c.numero}</Badge>
                                <span className="text-xs text-muted-foreground truncate">{c.descricao || '—'}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {parsedCount > 0 && !isOpen && (
                                  <Badge variant="secondary" className="text-[10px]">{parsedCount} detectado(s)</Badge>
                                )}
                                {linhasCount > 0 && (
                                  <Badge className="text-[10px] gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {linhasCount}
                                  </Badge>
                                )}
                                <span className="text-[11px] text-muted-foreground tabular-nums">{BRL(c.valorMensal)}/mês</span>
                              </div>
                            </button>

                            {isOpen && (
                              <div className="border-t bg-muted/10 p-3 space-y-2">
                                <div className="flex flex-wrap gap-1 mb-1">
                                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => addSelectedDrafts(c)}>
                                    <Plus className="h-3 w-3 mr-1" /> Adicionar selecionados
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addSuggestedContract(c)}>
                                    <Sparkles className="h-3 w-3 mr-1" /> Locação mensal
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => suggestPricesFromMensal(c)}
                                    title="Rateia o valor mensal do contrato entre a soma das quantidades">
                                    <Wand2 className="h-3 w-3 mr-1" /> Sugerir preço
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => copyFromLastMedicao(c)}>
                                    <Copy className="h-3 w-3 mr-1" /> Copiar da última
                                  </Button>
                                </div>

                                {drafts.length === 0 && (
                                  <div className="text-[11px] text-muted-foreground italic">
                                    Nenhum item detectado na descrição — adicione manualmente abaixo.
                                  </div>
                                )}

                                {drafts.map((d, i) => (
                                  <div key={i} className="grid grid-cols-[auto_60px_1fr_100px] gap-2 items-center">
                                    <Checkbox
                                      checked={d.checked}
                                      onCheckedChange={(v) => updateDraft(c.id, i, { checked: !!v })}
                                    />
                                    <Input type="number" step="1" min="1" className="h-8 text-xs" value={d.quantidade}
                                      onChange={(e) => updateDraft(c.id, i, { quantidade: Number(e.target.value) })} />
                                    <Input className="h-8 text-xs" value={d.descricao} placeholder="Descrição do item"
                                      onChange={(e) => updateDraft(c.id, i, { descricao: e.target.value })} />
                                    <Input type="number" step="0.01" min="0" className="h-8 text-xs text-right"
                                      placeholder="0,00" value={d.valorUnit || ''}
                                      onChange={(e) => updateDraft(c.id, i, { valorUnit: Number(e.target.value) })} />
                                  </div>
                                ))}

                                <Button variant="ghost" size="sm" type="button" className="h-7 text-xs" onClick={() => addEmptyDraft(c)}>
                                  <Plus className="h-3 w-3 mr-1" /> Novo item
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Coluna direita — Itens da medição */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">
                        Itens da medição <span className="text-muted-foreground font-normal">({rows.length})</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addFreeItem}>
                          <Plus className="h-3 w-3 mr-1" /> Item avulso
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs"
                          onClick={() => {
                            const v = window.prompt('Aplicar desconto de qual % em cada item?', '5');
                            const pct = Number(v);
                            if (pct > 0) applyDiscountPercent(pct);
                          }}>
                          <Wand2 className="h-3 w-3 mr-1" /> Desc. %
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-600" onClick={clearAllRows}>
                          <Trash2 className="h-3 w-3 mr-1" /> Limpar
                        </Button>
                      </div>
                    </div>

                    {rows.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                        Adicione itens pelos contratos ao lado.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(rowsByContract).map(([k, g]) => (
                          <div key={k} className="rounded-md border">
                            <div className="px-3 py-1.5 bg-muted/50 border-b flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                {g.numero ? (
                                  <>
                                    <Badge variant="outline" className="text-[10px]">{g.numero}</Badge>
                                    <span className="text-muted-foreground">Contrato</span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground italic">Itens avulsos</span>
                                )}
                              </div>
                              <span className="tabular-nums font-medium">
                                {BRL(g.items.reduce((s, r) => s + Number(r.valorTotal || 0), 0))}
                              </span>
                            </div>
                            <div className="divide-y">
                              {g.items.map((r) => (
                                <div key={r.key} className="p-2 space-y-1.5">
                                  <div className="flex gap-2">
                                    <Input
                                      className="h-8 text-xs flex-1"
                                      placeholder="Descrição"
                                      value={r.descricao}
                                      onChange={(e) => updateRow(r.key, { descricao: e.target.value })}
                                    />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRow(r.key)}>
                                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-[60px_60px_1fr_1fr_auto] gap-2 items-center">
                                    <Input type="number" step="0.01" min="0" className="h-7 text-xs"
                                      title="Quantidade"
                                      value={r.quantidade}
                                      onChange={(e) => updateRow(r.key, { quantidade: Number(e.target.value) })} />
                                    <Input className="h-7 text-xs" title="Unidade" value={r.unidade || ''}
                                      onChange={(e) => updateRow(r.key, { unidade: e.target.value })} />
                                    <Input type="number" step="0.01" min="0" className="h-7 text-xs text-right"
                                      title="Valor unitário"
                                      value={r.valorUnit}
                                      onChange={(e) => updateRow(r.key, { valorUnit: Number(e.target.value) })} />
                                    <Input type="number" step="0.01" min="0" className="h-7 text-xs text-right"
                                      title="Desconto do item"
                                      value={r.descontoItem}
                                      onChange={(e) => updateRow(r.key, { descontoItem: Number(e.target.value) })} />
                                    <div className="text-xs font-semibold text-right tabular-nums min-w-[80px]">
                                      {BRL(r.valorTotal)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Seção 3 — Observações + Totais */}
            <section className="px-5 py-4 border-t bg-muted/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-xs">Observações</Label>
                  <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Notas que aparecerão no PDF (opcional)" />
                  <div className="flex flex-wrap gap-1">
                    {OBS_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setObservacoes((prev) => prev ? `${prev}\n${chip}` : chip)}
                        className="text-[11px] px-2 py-0.5 rounded-full border bg-background hover:bg-muted transition-colors"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border p-3 bg-background space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">{BRL(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Desconto geral</span>
                    <Input type="number" step="0.01" min="0" className="h-8 w-32 text-right tabular-nums"
                      value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} />
                  </div>
                  <div className="flex items-center justify-between text-base border-t pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-primary tabular-nums">{BRL(total)}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Footer sticky */}
        <DialogFooter className="px-5 py-3 border-t bg-background/95 backdrop-blur sticky bottom-0">
          <div className="flex items-center justify-between w-full gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Checkbox checked={downloadAfterSave} onCheckedChange={(v) => setDownloadAfterSave(!!v)} />
              Baixar PDF ao salvar
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground hidden md:inline">
                Ctrl+Enter para salvar
              </span>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={save} disabled={saving || !canSave}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editing ? 'Salvar alterações' : 'Gerar medição'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
