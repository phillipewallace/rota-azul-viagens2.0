/**
 * ERP → Aba Excel — lista de planilhas processadas.
 * Documentos com arquivo xlsx/xls/csv/ods aparecem aqui (o backend analisa
 * em background após o upload). O clique abre o editor-tabela em modal.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Search, RefreshCw, Loader2, AlertTriangle, Clock, Pencil, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { erpService, type ErpSpreadsheetSummary } from '@/services/erp';
import SpreadsheetEditorDialog from '@/components/erp/SpreadsheetEditorDialog';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';

const statusBadge = (s: ErpSpreadsheetSummary['status']) => {
  switch (s) {
    case 'pronto':
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Pronta</Badge>;
    case 'processando':
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3 mr-1" />Processando…</Badge>;
    case 'erro':
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><AlertTriangle className="h-3 w-3 mr-1" />Erro</Badge>;
    case 'sem_arquivo':
      return <Badge variant="outline" className="text-muted-foreground">Sem arquivo</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground">Não é planilha</Badge>;
  }
};

const ErpSpreadsheets: React.FC = () => {
  const [items, setItems] = useState<ErpSpreadsheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const data = await erpService.listSpreadsheets(q ? { search: q } : {});
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Se alguma linha estiver "processando", revalida de tempo em tempo.
  useEffect(() => {
    if (!items.some((i) => i.status === 'processando')) return;
    const id = setInterval(() => { load(search || undefined); }, 5000);
    return () => clearInterval(id);
  }, [items, search, load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => `${i.nome} ${i.arquivoNome ?? ''}`.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-emerald-600" /> Excel
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Planilhas enviadas na aba Documentos, prontas para visualizar, editar e exportar em PDF.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => load(search || undefined)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            <Button size="sm" onClick={() => { window.location.href = '/erp/documentos'; }}>
              <Upload className="h-4 w-4 mr-1" /> Enviar planilha
            </Button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome do documento ou arquivo…"
            className="pl-9 bg-white"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando planilhas…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border rounded-xl p-12 text-center text-muted-foreground">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">Nenhuma planilha encontrada</p>
            <p className="text-sm mt-1">
              Envie arquivos .xlsx, .xls, .csv ou .ods na aba <b>Documentos</b> — eles aparecem aqui automaticamente após a análise.
            </p>
          </div>
        ) : (
          <div className="bg-white border rounded-xl divide-y overflow-hidden">
            {filtered.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-slate-900 truncate">{item.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.arquivoNome ?? 'sem arquivo'}
                    {item.abasCount != null && <> · {item.abasCount} aba(s)</>}
                    {item.linhasCount != null && <> · {item.linhasCount} linhas</>}
                    {item.updatedAt && <> · atualizado {new Date(item.updatedAt).toLocaleString('pt-BR')}</>}
                  </p>
                </div>
                {statusBadge(item.status)}
                <Button
                  size="sm"
                  onClick={() => setOpenId(item.id)}
                  disabled={item.status !== 'pronto'}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Abrir
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SpreadsheetEditorDialog
        documentId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
        onChanged={() => load(search || undefined)}
      />
    </div>
  );
};

export default ErpSpreadsheets;
