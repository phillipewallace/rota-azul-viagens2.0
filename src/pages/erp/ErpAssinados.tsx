/**
 * ERP → Assinados
 * Lista todos os PDFs gerados pela aba Assinatura, com download/abrir/excluir.
 * Paginação, filtros e KPIs são calculados no servidor.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { erpService, type ErpCompany, type SignedPdf } from '@/services/erp';
import { toAuthedUrl } from '@/utils/absoluteUrl';
import { confirmDialog } from '@/lib/confirm';
import PaginationBar from '@/components/PaginationBar';
import { downloadCsv } from '@/utils/exporters';
import { Files, Download, ExternalLink, Trash2, Search, RefreshCw, FileText } from 'lucide-react';

const fmtBytes = (n?: number) => {
  if (!n || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};
const fmtDate = (s: string) => new Date(s).toLocaleString('pt-BR');

const ErpAssinados: React.FC = () => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [items, setItems] = useState<SignedPdf[]>([]);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<{ total: number; totalBytes: number; totalPages: number; empresasDistintas: number }>({
    total: 0, totalBytes: 0, totalPages: 0, empresasDistintas: 0,
  });
  const [exportBusy, setExportBusy] = useState(false);
  const reqRef = useRef(0);

  // Debounce da busca (350ms)
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setPage(1); }, [companyFilter, qDebounced, pageSize]);

  const filterOpts = useMemo(() => ({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
    search: qDebounced || undefined,
  }), [companyFilter, qDebounced]);

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    setLoading(true);
    try {
      const [paged, k] = await Promise.all([
        erpService.listSignedPdfsPaged({ ...filterOpts, page, pageSize }),
        erpService.signedPdfsKpis(filterOpts),
      ]);
      if (id !== reqRef.current) return;
      setItems(paged.data);
      setTotal(paged.total);
      setKpis(k);
    } catch (e: any) {
      if (id === reqRef.current) toast({ title: 'Erro ao carregar', description: e?.message, variant: 'destructive' });
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [filterOpts, page, pageSize, toast]);

  useEffect(() => {
    erpService.listCompanies().then(setCompanies).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleDownload = (it: SignedPdf) => {
    const url = toAuthedUrl(it.fileUrl);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = it.originalFilename;
    a.rel = 'noopener';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDelete = async (it: SignedPdf) => {
    const ok = await confirmDialog({
      title: 'Excluir PDF assinado?',
      description: `"${it.originalFilename}" será removido permanentemente.`,
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    try {
      await erpService.deleteSignedPdf(it.id);
      toast({ title: 'PDF excluído' });
      load();
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' });
    }
  };

  // Exporta CSV percorrendo TODO o dataset filtrado (blocos de 200, cap 5000).
  const exportCsv = useCallback(async () => {
    setExportBusy(true);
    try {
      const CAP = 5000;
      const CHUNK = 200;
      const all: SignedPdf[] = [];
      let p = 1;
      while (all.length < CAP) {
        const res = await erpService.listSignedPdfsPaged({ ...filterOpts, page: p, pageSize: CHUNK });
        all.push(...res.data);
        if (res.data.length < CHUNK || all.length >= res.total) break;
        p++;
      }
      const trimmed = all.slice(0, CAP);
      const headers = ['Arquivo', 'Empresa', 'Data', 'Páginas', 'Tamanho (bytes)', 'Criado por'];
      const rows = trimmed.map(it => [
        it.originalFilename,
        it.companyName || '',
        fmtDate(it.createdAt),
        it.pages ?? '',
        it.sizeBytes ?? '',
        it.createdBy || '',
      ]);
      downloadCsv(`pdfs-assinados-${new Date().toISOString().slice(0, 10)}`, headers, rows);
      toast({ title: `CSV exportado (${trimmed.length} registros).` });
    } catch (e: any) {
      toast({ title: 'Falha ao exportar', description: e?.message, variant: 'destructive' });
    } finally {
      setExportBusy(false);
    }
  }, [filterOpts, toast]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center text-white">
          <Files className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">PDFs Assinados</h1>
          <p className="text-sm text-muted-foreground">Histórico dos documentos gerados na aba Assinatura.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
        <Button
          variant="outline" size="sm"
          onClick={exportCsv}
          disabled={exportBusy || kpis.total === 0}
          title="Exporta o dataset inteiro respeitando os filtros"
        >
          <Download className={`h-4 w-4 mr-1 ${exportBusy ? 'animate-spin' : ''}`} />
          Exportar CSV (filtro)
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total de PDFs</div>
          <div className="text-lg font-semibold tabular-nums">{kpis.total.toLocaleString('pt-BR')}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Páginas assinadas</div>
          <div className="text-lg font-semibold tabular-nums">{kpis.totalPages.toLocaleString('pt-BR')}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Empresas</div>
          <div className="text-lg font-semibold tabular-nums">{kpis.empresasDistintas.toLocaleString('pt-BR')}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Armazenamento</div>
          <div className="text-lg font-semibold tabular-nums">{fmtBytes(Number(kpis.totalBytes) || 0)}</div>
        </Card>
      </div>

      <Card className="p-4 grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Empresa</Label>
          <SearchableSelect
            value={companyFilter}
            onValueChange={setCompanyFilter}
            placeholder="Empresa"
            searchPlaceholder="Buscar empresa..."
            options={[
              { value: 'all', label: 'Todas as empresas' },
              ...companies.map((c) => ({ value: c.id, label: c.razaoSocial })),
            ]}
          />
        </div>
        <div className="space-y-2">
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome do arquivo ou empresa…"
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            {loading ? 'Carregando…' : 'Nenhum PDF assinado ainda. Vá para a aba Assinatura para começar.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Arquivo</th>
                  <th className="text-left px-4 py-3 font-medium">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium">Data</th>
                  <th className="text-right px-4 py-3 font-medium">Páginas</th>
                  <th className="text-right px-4 py-3 font-medium">Tamanho</th>
                  <th className="text-right px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 max-w-[280px] truncate" title={it.originalFilename}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                        <span className="truncate">{it.originalFilename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{it.companyName || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(it.createdAt)}</td>
                    <td className="px-4 py-3 text-right">{it.pages ?? '—'}</td>
                    <td className="px-4 py-3 text-right">{fmtBytes(it.sizeBytes)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => window.open(toAuthedUrl(it.fileUrl) || '#', '_blank', 'noopener,noreferrer')}
                          title="Abrir em nova aba"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(it)} title="Baixar">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleDelete(it)}
                          title="Excluir"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4">
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </Card>
    </div>
  );
};

export default ErpAssinados;
