/**
 * ERP → Documentos
 * Central de documentos: nome, empresa emissora, numeração, tipo e arquivo
 * vinculado (qualquer tipo/extensão). Pré-visualização, download, busca e filtros.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { erpService, type ErpCompany, type ErpDocument } from '@/services/erp';
import { API_BASE_URL } from '@/services/config';
import { confirmDialog } from '@/lib/confirm';
import PaginationBar from '@/components/PaginationBar';
import DocumentPreviewDialog from '@/components/erp/DocumentPreviewDialog';
import { formatFileSize, getPreviewKind, downloadFileFromUrl, previewKindLabels } from '@/utils/documentFiles';
import {
  Plus, Search, RefreshCw, Trash2, Pencil, Eye, Download, FolderOpen, X,
  FileText, Filter, UploadCloud, FileQuestion,
} from 'lucide-react';

const TIPO_SUGGESTIONS = [
  'Contrato', 'Orçamento', 'Ordem de Serviço', 'Nota Fiscal', 'Recibo', 'Boleto',
  'Alvará', 'Licença', 'Laudo', 'Manual', 'Certificado', 'Procuração',
  'Contrato Social', 'CNPJ', 'Seguro', 'Outros',
];

interface DocForm {
  nome: string;
  tipo: string;
  numeracao: string;
  empresaEmissora: string;
  observacoes: string;
}

const EMPTY_FORM: DocForm = { nome: '', tipo: '', numeracao: '', empresaEmissora: '', observacoes: '' };

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

async function uploadDocumentFile(file: File): Promise<{ url: string; size: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const tk = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: tk ? { Authorization: `Bearer ${tk}` } : undefined,
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.url) throw new Error(data?.error || 'Falha ao enviar o arquivo');
  return { url: data.url, size: Number(data.size) || file.size };
}

const ErpDocuments: React.FC = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<ErpDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [empresaFilter, setEmpresaFilter] = useState('all');

  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [usedTipos, setUsedTipos] = useState<string[]>([]);
  const [usedEmpresas, setUsedEmpresas] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ErpDocument | null>(null);
  const [form, setForm] = useState<DocForm>(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [saving, setSaving] = useState(false);

  const [previewDoc, setPreviewDoc] = useState<ErpDocument | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setPage(1); }, [tipoFilter, empresaFilter, qDebounced, pageSize]);

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    setLoading(true);
    try {
      const paged = await erpService.listDocuments({
        search: qDebounced || undefined,
        tipo: tipoFilter === 'all' ? undefined : tipoFilter,
        empresa: empresaFilter === 'all' ? undefined : empresaFilter,
        page,
        pageSize,
      });
      if (id !== reqRef.current) return;
      setItems(paged.data || []);
      setTotal(paged.total || 0);
    } catch (e: any) {
      if (id === reqRef.current) toast({ title: 'Erro ao carregar documentos', description: e?.message, variant: 'destructive' });
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [qDebounced, tipoFilter, empresaFilter, page, pageSize, toast]);

  useEffect(() => {
    erpService.listCompanies().then(setCompanies).catch(() => {});
    erpService.listDocumentMeta()
      .then((m) => {
        setUsedTipos(Array.isArray(m.tipos) ? m.tipos : []);
        setUsedEmpresas(Array.isArray(m.empresas) ? m.empresas.map((x) => x.empresaEmissora).filter(Boolean) : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // Opções únicas para os filtros e datalists do formulário.
  const tipoOptions = useMemo(() => {
    const set = new Set<string>(TIPO_SUGGESTIONS);
    usedTipos.forEach((t) => set.add(t));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [usedTipos]);

  const empresaOptions = useMemo(() => {
    const set = new Set<string>();
    usedEmpresas.forEach((e) => set.add(e));
    companies.forEach((c) => c.razaoSocial && set.add(c.razaoSocial));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [usedEmpresas, companies]);

  const hasFilters = qDebounced !== '' || tipoFilter !== 'all' || empresaFilter !== 'all';

  const clearFilters = () => {
    setQ('');
    setTipoFilter('all');
    setEmpresaFilter('all');
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedFile(null);
    setRemoveFile(false);
    setModalOpen(true);
  };

  const openEdit = (d: ErpDocument) => {
    setEditing(d);
    setForm({
      nome: d.nome || '',
      tipo: d.tipo || '',
      numeracao: d.numeracao || '',
      empresaEmissora: d.empresaEmissora || '',
      observacoes: d.observacoes || '',
    });
    setSelectedFile(null);
    setRemoveFile(false);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const nome = form.nome.trim();
    if (!nome) return toast({ title: 'Nome obrigatório', description: 'Informe o nome do documento.', variant: 'destructive' });
    setSaving(true);
    try {
      let arquivoUrl: string | null = !removeFile ? (editing?.arquivoUrl || null) : null;
      let arquivoNome: string | null = !removeFile ? (editing?.arquivoNome || null) : null;
      let arquivoTamanho: number | null = !removeFile ? (editing?.arquivoTamanho ?? null) : null;
      let arquivoTipo: string | null = !removeFile ? (editing?.arquivoTipo || null) : null;

      if (selectedFile) {
        const up = await uploadDocumentFile(selectedFile);
        arquivoUrl = up.url;
        arquivoNome = selectedFile.name;
        arquivoTamanho = up.size;
        arquivoTipo = selectedFile.type || null;
      }

      const payload = {
        nome,
        tipo: form.tipo.trim() || null,
        numeracao: form.numeracao.trim() || null,
        empresaEmissora: form.empresaEmissora.trim() || null,
        observacoes: form.observacoes.trim() || null,
        arquivoUrl,
        arquivoNome,
        arquivoTamanho,
        arquivoTipo,
      };

      if (editing?.id) await erpService.updateDocument(editing.id, payload);
      else await erpService.createDocument(payload);

      toast({ title: 'Documento salvo', description: `${nome} foi salvo com sucesso.` });
      setModalOpen(false);
      await load();
      refreshMeta();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const refreshMeta = () => {
    erpService.listDocumentMeta()
      .then((m) => {
        setUsedTipos(Array.isArray(m.tipos) ? m.tipos : []);
        setUsedEmpresas(Array.isArray(m.empresas) ? m.empresas.map((x) => x.empresaEmissora).filter(Boolean) : []);
      })
      .catch(() => {});
  };

  const handleDelete = async (d: ErpDocument) => {
    const ok = await confirmDialog({
      title: 'Excluir documento?',
      description: `"${d.nome}" será removido permanentemente${d.arquivoNome ? ` junto com o arquivo "${d.arquivoNome}"` : ''}.`,
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    try {
      await erpService.deleteDocument(d.id);
      toast({ title: 'Documento excluído' });
      await load();
      refreshMeta();
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleDownload = async (d: ErpDocument) => {
    if (!d.arquivoUrl) return;
    try {
      await downloadFileFromUrl(d.arquivoUrl, d.arquivoNome || `${d.nome}.bin`);
    } catch (e: any) {
      toast({ title: 'Erro ao baixar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-indigo-500" /> Documentos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Arquive e organize documentos de qualquer tipo — com pré-visualização e download.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { load(); refreshMeta(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Sincronizar
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo Documento
          </Button>
        </div>
      </header>

      {/* Busca + filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_260px_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, numeração, empresa ou tipo..."
              className="pl-9"
            />
          </div>
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="h-10 px-3 rounded-md border bg-white text-sm"
          >
            <option value="all">Todos os tipos</option>
            {tipoOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={empresaFilter}
            onChange={(e) => setEmpresaFilter(e.target.value)}
            className="h-10 px-3 rounded-md border bg-white text-sm"
          >
            <option value="all">Todas as empresas</option>
            {empresaOptions.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={load} title="Aplicar filtros">
              <Filter className="h-4 w-4" />
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" /> Limpar
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{total} documento{total === 1 ? '' : 's'}</Badge>
          {hasFilters && <span>Filtros ativos — clique em “Limpar” para ver tudo.</span>}
        </p>
      </Card>

      {/* Lista */}
      <Card className="p-0 overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
            Carregando documentos…
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <FileQuestion className="h-10 w-10 mx-auto mb-3 opacity-40" />
            {hasFilters
              ? 'Nenhum documento encontrado com esses filtros.'
              : 'Nenhum documento cadastrado ainda. Clique em “Novo Documento” para começar.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Documento</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">Numeração</th>
                  <th className="text-left px-4 py-3 font-medium">Empresa Emissora</th>
                  <th className="text-left px-4 py-3 font-medium">Arquivo</th>
                  <th className="text-left px-4 py-3 font-medium">Data</th>
                  <th className="text-right px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => {
                  const kind = getPreviewKind(d.arquivoNome, d.arquivoTipo);
                  const kindLabel = previewKindLabels[kind];
                  return (
                    <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 max-w-[240px]">
                          <FileText className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                          <span className="truncate font-medium" title={d.nome}>{d.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {d.tipo
                          ? <Badge variant="outline">{d.tipo}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{d.numeracao || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[180px]">
                        <span className="truncate block" title={d.empresaEmissora}>{d.empresaEmissora || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {d.arquivoNome ? (
                          <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
                            <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate text-xs" title={d.arquivoNome}>{d.arquivoNome}</p>
                              <p className="text-[10px] text-muted-foreground">{kindLabel} · {formatFileSize(d.arquivoTamanho)}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(d.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" title="Visualizar" disabled={!d.arquivoUrl}
                            onClick={() => setPreviewDoc(d)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Baixar" disabled={!d.arquivoUrl}
                            onClick={() => handleDownload(d)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Editar" onClick={() => openEdit(d)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Excluir"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(d)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Modal Criar/Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar documento' : 'Novo documento'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Nome do documento *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Contrato de locação — Cliente X"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Input
                  list="erp-doc-tipos"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  placeholder="Ex: Contrato"
                />
                <datalist id="erp-doc-tipos">
                  {tipoOptions.map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Numeração</Label>
                <Input
                  value={form.numeracao}
                  onChange={(e) => setForm({ ...form, numeracao: e.target.value })}
                  placeholder="Ex: 001/2026"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Empresa emissora</Label>
                <Input
                  list="erp-doc-empresas"
                  value={form.empresaEmissora}
                  onChange={(e) => setForm({ ...form, empresaEmissora: e.target.value })}
                  placeholder="Digite ou selecione a empresa emissora"
                />
                <datalist id="erp-doc-empresas">
                  {empresaOptions.map((e) => <option key={e} value={e} />)}
                </datalist>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={2}
                  placeholder="Anotações opcionais sobre o documento"
                />
              </div>
            </div>
{/* Vincular arquivo (qualquer tipo) */}
            <div className="rounded-xl border border-dashed p-4 space-y-3">
              <Label className="mb-1">Arquivo vinculado</Label>
              <input
                id="erp-doc-file-input"
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  if (f) { setSelectedFile(f); setRemoveFile(false); }
                  e.target.value = '';
                }}
              />

              {selectedFile ? (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)} · pronto para envio</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)} title="Remover seleção">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : editing && editing.arquivoNome && !removeFile ? (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{editing.arquivoNome}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(editing.arquivoTamanho)} · vinculado</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" title="Pré-visualizar" onClick={() => setPreviewDoc(editing!)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" title="Desvincular" onClick={() => setRemoveFile(true)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {!selectedFile && removeFile && (
                <p className="text-xs text-amber-600">O arquivo atual será desvinculado ao salvar.</p>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('erp-doc-file-input')?.click()}
              >
                <UploadCloud className="h-4 w-4" />
                {selectedFile
                  ? 'Trocar arquivo'
                  : editing && editing.arquivoNome && !removeFile
                    ? 'Substituir arquivo'
                    : 'Vincular arquivo'}
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Salvar alterações' : 'Cadastrar documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pré-visualização */}
      <DocumentPreviewDialog
        open={!!previewDoc}
        doc={previewDoc}
        onOpenChange={(o) => { if (!o) setPreviewDoc(null); }}
      />
    </div>
  );
};

export default ErpDocuments;