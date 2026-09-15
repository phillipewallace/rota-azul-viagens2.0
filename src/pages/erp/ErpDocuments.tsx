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
import { useNavigate } from 'react-router-dom';
import { erpService, type ErpCompany, type ErpDocument, type ErpDocumentFile } from '@/services/erp';
import { API_BASE_URL } from '@/services/config';
import { confirmDialog } from '@/lib/confirm';
import PaginationBar from '@/components/PaginationBar';
import DocumentPreviewDialog from '@/components/erp/DocumentPreviewDialog';
import { formatFileSize, getPreviewKind, downloadFileFromUrl, previewKindLabels, type PreviewKind } from '@/utils/documentFiles';
import { SPREADSHEET_EXTS, OFFICE_DOC_EXTS } from '@/utils/spreadsheetConvert';
import {
  Plus, Search, RefreshCw, Trash2, Pencil, Eye, Download, FolderOpen, X,
  FileText, Filter, UploadCloud, FileQuestion, FileEdit, ChevronDown, ChevronRight,
  FolderArchive, Loader2, FileImage, FileVideo, FileAudio, FileArchive, FileSpreadsheet, FileType,
} from 'lucide-react';

const TIPO_SUGGESTIONS = [
  'Contrato', 'Orçamento', 'Ordem de Serviço', 'Nota Fiscal', 'Recibo', 'Boleto',
  'Alvará', 'Licença', 'Laudo', 'Manual', 'Certificado', 'Procuração',
  'Contrato Social', 'CNPJ', 'Seguro', 'Outros',
];

// Filtro propio de cada sub-pasta (por tipo de archivo).
const SUB_FILTER_TYPES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Imagen' },
  { value: 'office', label: 'Office / Planilla' },
  { value: 'text', label: 'Texto' },
  { value: 'video', label: 'Vídeo' },
  { value: 'audio', label: 'Audio' },
  { value: 'archive', label: 'Comprimido' },
  { value: 'other', label: 'Otros' },
];

const subFileIcon = (kind: PreviewKind) => {
  switch (kind) {
    case 'pdf': return <FileText className="h-5 w-5 text-rose-500 flex-shrink-0" />;
    case 'image': return <FileImage className="h-5 w-5 text-emerald-500 flex-shrink-0" />;
    case 'video': return <FileVideo className="h-5 w-5 text-violet-500 flex-shrink-0" />;
    case 'audio': return <FileAudio className="h-5 w-5 text-sky-500 flex-shrink-0" />;
    case 'text': return <FileType className="h-5 w-5 text-indigo-500 flex-shrink-0" />;
    case 'office': return <FileSpreadsheet className="h-5 w-5 text-blue-500 flex-shrink-0" />;
    case 'archive': return <FileArchive className="h-5 w-5 text-amber-500 flex-shrink-0" />;
    default: return <FileQuestion className="h-5 w-5 text-slate-400 flex-shrink-0" />;
  }
};

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
  const navigate = useNavigate();
  const fileExtension = (name?: string | null) => (name ? name.split('.').pop()!.toLowerCase() : '');
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
  const [dragActive, setDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const [previewDoc, setPreviewDoc] = useState<ErpDocument | null>(null);
  const [previewHideEdit, setPreviewHideEdit] = useState(false);
  const reqRef = useRef(0);

  // Sub-pasta: múltiplos arquivos por documento (estado por doc-id).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filesStore, setFilesStore] = useState<Record<string, ErpDocumentFile[]>>({});
  const [filesLoading, setFilesLoading] = useState<Record<string, boolean>>({});
  const [fileSearch, setFileSearch] = useState<Record<string, string>>({});
  const [fileTipoFilter, setFileTipoFilter] = useState<Record<string, string>>({});
  const [subDragActive, setSubDragActive] = useState<Record<string, boolean>>({});
  const [subUploading, setSubUploading] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    // Impede que o navegador navegue/abra o arquivo quando o usuário soltar
    // fora da dropzone do modal (comportamento padrão de drag-and-drop).
    const preventDefault = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
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
    setDragActive(false);
    setPendingFiles([]);
    setUploadProgress(null);
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
    setDragActive(false);
    setPendingFiles([]);
    setUploadProgress(null);
    setModalOpen(true);
  };

  // ── Drag & drop de arquivo para dentro do modal ─────────────────────────
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragActive) setDragActive(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Só desativa quando o ponteiro realmente sai da dropzone (não ao passar
    // por elementos filhos), evitando "piscar" no estado de arraste.
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragActive(false);
  };

  // Acumula arquivos (sem limite) na lista de envio da sub-pasta.
  const addPendingFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setPendingFiles((prev) => {
      const keys = new Set(prev.map((f) => `${f.name}|${f.size}`));
      const added = list.filter((f) => !keys.has(`${f.name}|${f.size}`));
      return [...prev, ...added];
    });
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (!files || !files.length) return;
    addPendingFiles(files);
  };

  // ── Sub-pasta ─────────────────────────────────────────────────────────────
  const loadDocFiles = async (doc: ErpDocument) => {
    setFilesLoading((s) => ({ ...s, [doc.id]: true }));
    try {
      const files = await erpService.listDocumentFiles(doc.id);
      setFilesStore((s) => ({ ...s, [doc.id]: files }));
    } catch (e: any) {
      toast({ title: 'Erro ao carregar arquivos', description: e?.message, variant: 'destructive' });
    } finally {
      setFilesLoading((s) => ({ ...s, [doc.id]: false }));
    }
  };

  const toggleExpand = (doc: ErpDocument) => {
    const next = new Set(expandedIds);
    if (next.has(doc.id)) {
      next.delete(doc.id);
    } else {
      next.add(doc.id);
      if (!filesStore[doc.id] && !filesLoading[doc.id]) loadDocFiles(doc);
    }
    setExpandedIds(next);
  };

  const bumpCount = (docId: string, delta: number) => {
    setItems((prev) => prev.map((d) =>
      d.id === docId ? { ...d, arquivosCount: Math.max(0, (d.arquivosCount || 0) + delta) } : d,
    ));
  };

  const addFileToDoc = async (docId: string, file: File) => {
    setSubUploading((s) => ({ ...s, [docId]: true }));
    try {
      const created = await erpService.uploadDocumentFile(docId, file);
      setFilesStore((s) => ({ ...s, [docId]: [created, ...(s[docId] || [])] }));
      bumpCount(docId, 1);
    } catch (e: any) {
      toast({ title: 'Erro ao enviar arquivo', description: e?.message, variant: 'destructive' });
    } finally {
      setSubUploading((s) => ({ ...s, [docId]: false }));
    }
  };

  const handleRemoveDocFile = async (doc: ErpDocument, f: ErpDocumentFile) => {
    const ok = await confirmDialog({
      title: 'Remover arquivo?',
      description: `"${f.arquivoNome}" será removido da sub-pasta de "${doc.nome}".`,
      confirmLabel: 'Remover',
      destructive: true,
    });
    if (!ok) return;
    try {
      await erpService.deleteDocumentFile(doc.id, f.id);
      setFilesStore((s) => ({ ...s, [doc.id]: (s[doc.id] || []).filter((x) => x.id !== f.id) }));
      bumpCount(doc.id, -1);
    } catch (e: any) {
      toast({ title: 'Erro ao remover arquivo', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const openFilePreview = (doc: ErpDocument, f: ErpDocumentFile) => {
    setPreviewDoc({
      id: doc.id,
      nome: f.arquivoNome,
      tipo: doc.tipo,
      numeracao: doc.numeracao,
      empresaEmissora: doc.empresaEmissora,
      arquivoUrl: f.arquivoUrl,
      arquivoNome: f.arquivoNome,
      arquivoTamanho: f.arquivoTamanho,
      arquivoTipo: f.arquivoTipo,
    });
    setPreviewHideEdit(true);
  };

  const onClosePreview = (open: boolean) => {
    if (!open) { setPreviewDoc(null); setPreviewHideEdit(false); }
  };

  // Drag & drop do arquivo dentro de cada sub-pasta.
  const onSubDragEnter = (docId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setSubDragActive((s) => ({ ...s, [docId]: true }));
  };
  const onSubDragLeave = (docId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
    setSubDragActive((s) => ({ ...s, [docId]: false }));
  };
  const onSubDrop = (docId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSubDragActive((s) => ({ ...s, [docId]: false }));
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) addFileToDoc(docId, f);
  };

  // Busca + filtro de tipo — próprios de cada sub-pasta (filtrados no cliente).
  const visibleSubFiles = (docId: string) => {
    const all = filesStore[docId] || [];
    const qs = (fileSearch[docId] || '').trim().toLowerCase();
    const tf = fileTipoFilter[docId] || 'all';
    return all.filter((f) => {
      if (qs && !f.arquivoNome.toLowerCase().includes(qs)) return false;
      if (tf !== 'all' && getPreviewKind(f.arquivoNome, f.arquivoTipo) !== tf) return false;
      return true;
    });
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

      // 1) Cria/atualiza o registro do documento.
      let docId: string | null = editing?.id || null;
      if (docId) {
        await erpService.updateDocument(docId, payload);
      } else {
        const created = await erpService.createDocument(payload);
        docId = created.id;
      }

      // 2) Processa e envia TODOS os arquivos pendentes para a sub-pasta
      //    (sem limite por vez, 1 a 1 para não sobrecarregar o servidor).
      if (docId && pendingFiles.length) {
        setUploadProgress({ done: 0, total: pendingFiles.length });
        let done = 0;
        for (const f of pendingFiles) {
          try {
            await erpService.uploadDocumentFile(docId, f);
          } catch (e: any) {
            // Falha pontual não aborta o restante da fila.
            toast({ title: `Falha ao enviar "${f.name}"`, description: e?.message || 'Arquivo ignorado.', variant: 'destructive' });
          }
          done += 1;
          setUploadProgress({ done, total: pendingFiles.length });
        }
      }

      const totalSub = (docId && pendingFiles.length) ? pendingFiles.length : 0;
      toast({
        title: 'Documento salvo',
        description: totalSub > 0
          ? `${nome} salvo e sub-pasta gerada com ${totalSub} arquivo(s).`
          : `${nome} foi salvo com sucesso.`,
      });
      setModalOpen(false);
      setPendingFiles([]);
      setUploadProgress(null);
      await load();
      refreshMeta();

      // Abre a sub-pasta do documento recém-criado para mostrar os arquivos enviados.
      if (!editing?.id && docId && totalSub > 0) {
        setExpandedIds((prev) => { const n = new Set(prev); n.add(docId as string); return n; });
        loadDocFiles({ id: docId } as ErpDocument);
      }
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

  const handleEditFile = (d: ErpDocument) => {
    const ext = fileExtension(d.arquivoNome);
    if (SPREADSHEET_EXTS.includes(ext)) {
      navigate(`/erp/documentos/${d.id}/editar`);
    } else {
      navigate(`/erp/documentos/${d.id}/office`);
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
                  const ext = fileExtension(d.arquivoNome);
                  const canEditFile = !!d.arquivoUrl && (SPREADSHEET_EXTS.includes(ext) || OFFICE_DOC_EXTS.includes(ext));
                  const isExpanded = expandedIds.has(d.id);
                  const subFiles = visibleSubFiles(d.id);
                  return (
                    <React.Fragment key={d.id}>
                    <tr className={`border-t border-slate-100 ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 max-w-[280px]">
                          <Button
                            variant="ghost" size="icon"
                            title={isExpanded ? 'Ocultar sub-pasta' : 'Ver sub-pasta'}
                            onClick={() => toggleExpand(d)}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
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
                        {d.arquivosCount ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderArchive className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            <span className="text-xs font-medium">{d.arquivosCount} archivo{d.arquivosCount === 1 ? '' : 's'}</span>
                            {d.arquivoNome && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[110px]" title={d.arquivoNome}>{d.arquivoNome}</span>
                            )}
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
                          {canEditFile && (
                            <Button
                              variant="ghost" size="sm"
                              title={SPREADSHEET_EXTS.includes(ext) ? 'Editar planilha' : 'Editar documento'}
                              onClick={() => handleEditFile(d)}
                            >
                              <FileEdit className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
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

                    {isExpanded && (
                      <tr key={`${d.id}-sub`} className="border-t border-slate-100 bg-indigo-50/20">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-sm font-semibold flex items-center gap-2">
                                <FolderArchive className="h-4 w-4 text-indigo-500" />
                                Sub-pasta de {d.nome}
                                <Badge variant="secondary">
                                  {(filesStore[d.id] || []).length} archivo{(filesStore[d.id] || []).length === 1 ? '' : 's'}
                                </Badge>
                              </p>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => { const n = new Set(expandedIds); n.delete(d.id); setExpandedIds(n); }}
                              >
                                <X className="h-4 w-4" /> Cerrar
                              </Button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  value={fileSearch[d.id] || ''}
                                  onChange={(e) => setFileSearch((s) => ({ ...s, [d.id]: e.target.value }))}
                                  placeholder="Buscar archivos por nombre..."
                                  className="pl-9"
                                />
                              </div>
                              <select
                                value={fileTipoFilter[d.id] || 'all'}
                                onChange={(e) => setFileTipoFilter((s) => ({ ...s, [d.id]: e.target.value }))}
                                className="h-10 px-3 rounded-md border bg-white text-sm"
                              >
                                {SUB_FILTER_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!!subUploading[d.id]}
                                onClick={(e) => { e.stopPropagation(); document.getElementById(`erp-doc-sub-input-${d.id}`)?.click(); }}
                              >
                                <UploadCloud className="h-4 w-4" />
                                {subUploading[d.id] ? 'Subiendo...' : 'Añadir archivos'}
                              </Button>
                              <input
                                id={`erp-doc-sub-input-${d.id}`}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  const fs = e.target.files;
                                  if (fs) Array.from(fs).forEach((f) => addFileToDoc(d.id, f));
                                  e.target.value = '';
                                }}
                              />
                            </div>
<div
                                className={`rounded-xl border p-3 transition-colors cursor-pointer ${
                                  subDragActive[d.id] ? 'border-indigo-400 bg-indigo-50/70' : 'border-dashed hover:border-indigo-300'
                                }`}
                                onDragEnter={onSubDragEnter(d.id)}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!subDragActive[d.id]) setSubDragActive((s) => ({ ...s, [d.id]: true })); }}
                                onDragLeave={onSubDragLeave(d.id)}
                                onDrop={onSubDrop(d.id)}
                              >
                                <div className="flex flex-col items-center justify-center gap-2 py-3 text-center text-muted-foreground">
                                  <UploadCloud className="h-5 w-5" />
                                  <p className="text-sm font-medium">
                                    {subDragActive[d.id] ? 'Solte aquí para añadir' : 'Arrastre y suelte nuevos archivos aquí'}
                                  </p>
                                </div>
                              </div>

                              {filesLoading[d.id] ? (
                                <div className="p-6 text-center text-muted-foreground">
                                  <Loader2 className="h-5 w-5 mx-auto animate-spin" /> Cargando archivos…
                                </div>
                              ) : subFiles.length === 0 ? (
                                <div className="p-5 text-center text-muted-foreground text-sm">
                                  {(filesStore[d.id] || []).length === 0
                                    ? 'Aún no hay archivos en esta sub-pasta — añade o arrastra uno aquí arriba.'
                                    : 'Ningún archivo coincide con esta búsqueda y filtro.'}
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {subFiles.map((f) => {
                                    const fKind = getPreviewKind(f.arquivoNome, f.arquivoTipo);
                                    return (
                                      <div key={f.id} className="p-3 rounded-lg bg-white border shadow-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {subFileIcon(fKind)}
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium truncate" title={f.arquivoNome}>{f.arquivoNome}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                              {previewKindLabels[fKind]} · {formatFileSize(f.arquivoTamanho)} · {fmtDate(f.createdAt)}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-1 mt-1.5">
                                          <Button variant="ghost" size="sm" title="Visualizar" onClick={() => openFilePreview(d, f)}>
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                          <Button variant="ghost" size="sm" title="Baixar"
                                            onClick={() => downloadFileFromUrl(f.arquivoUrl, f.arquivoNome).catch(() => {})}>
                                            <Download className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost" size="sm" title="Remover"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleRemoveDocFile(d, f)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
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
{/* Arquivo vinculado (principal — apenas ao editar) */}
            {editing && editing.arquivoNome && (
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="mb-0">Arquivo vinculado {`(atual)`}</Label>
                  {removeFile && <span className="text-xs text-amber-600">Será desvinculado ao salvar.</span>}
                </div>
                {!removeFile && (
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
                )}
                <div className="flex items-center gap-2">
                  <input
                    id="erp-doc-replace-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0];
                      if (f) { setSelectedFile(f); setRemoveFile(false); }
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); document.getElementById('erp-doc-replace-input')?.click(); }}
                  >
                    <UploadCloud className="h-4 w-4" />
                    {selectedFile ? 'Trocar arquivo' : 'Substituir arquivo'}
                  </Button>
                </div>
                {selectedFile && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)} · substituirá o atual</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)} title="Remover seleção">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Sub-pasta: vários arquivos de uma única vez (sem limite) */}
            <div
              className={`rounded-xl border p-4 space-y-3 transition-colors cursor-pointer ${
                dragActive ? 'border-indigo-400 bg-indigo-50/70' : 'border-dashed hover:border-indigo-300'
              }`}
              onClick={() => document.getElementById('erp-doc-file-input')?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="mb-0">Sub-pasta (arquivos adicionais)</Label>
                <span className="text-xs text-muted-foreground">
                  {dragActive ? 'Solte os arquivos aqui' : 'Arraste vários arquivos ou clique — sem limite por vez'}
                </span>
              </div>
              <input
                id="erp-doc-file-input"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addPendingFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              <div className={`flex flex-col items-center justify-center gap-2 py-8 rounded-lg border text-center transition-colors ${dragActive ? 'border-indigo-400 bg-indigo-100 text-indigo-700' : 'border-dashed border-slate-200 text-muted-foreground'}`}>
                <UploadCloud className="h-6 w-6" />
                <p className="text-sm font-medium">{dragActive ? 'Solte os arquivos aqui' : 'Arraste e solte os arquivos'}</p>
                <p className="text-xs opacity-80">
                  {pendingFiles.length > 0
                    ? `${pendingFiles.length} arquivo(s) pronto(s) para envio`
                    : 'Vários arquivos de uma vez · clique para selecionar'}
                </p>
              </div>

              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  {pendingFiles.map((f, i) => (
                    <div key={`${f.name}|${f.size}`} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(f.size)} · pronto para envio</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removePendingFile(i)} title="Remover da lista">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); document.getElementById('erp-doc-file-input')?.click(); }}
              >
                <UploadCloud className="h-4 w-4" />
                {pendingFiles.length > 0 ? 'Adicionar mais arquivos' : 'Adicionar arquivos'}
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {saving
                ? uploadProgress
                  ? `Enviando ${uploadProgress.done}/${uploadProgress.total}…`
                  : 'Salvando…'
                : editing
                  ? 'Salvar alterações'
                  : pendingFiles.length > 0
                    ? `Cadastrar documento + ${pendingFiles.length} arquivo${pendingFiles.length === 1 ? '' : 's'}`
                    : 'Cadastrar documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pré-visualização */}
      <DocumentPreviewDialog
        open={!!previewDoc}
        doc={previewDoc}
        hideEdit={previewHideEdit}
        onOpenChange={onClosePreview}
      />
    </div>
  );
};

export default ErpDocuments;