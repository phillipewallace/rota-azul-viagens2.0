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
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { SPREADSHEET_EXTS, OFFICE_DOC_EXTS } from '@/utils/spreadsheetConvert';
import {
  Plus, Search, RefreshCw, Trash2, Pencil, Eye, Download, FolderOpen, X,
  FileText, Filter, UploadCloud, FileQuestion, FileEdit, ChevronDown, ChevronRight,
  FolderArchive, Loader2, FileImage, FileVideo, FileAudio, FileArchive, FileSpreadsheet, FileType, ExternalLink,
} from 'lucide-react';

const TIPO_SUGGESTIONS = [
  'Contrato', 'Orçamento', 'Ordem de Serviço', 'Nota Fiscal', 'Recibo', 'Boleto',
  'Alvará', 'Licença', 'Laudo', 'Manual', 'Certificado', 'Procuração',
  'Contrato Social', 'CNPJ', 'Seguro', 'Outros',
];

// Filtro próprio de cada sub-pasta (por tipo de arquivo).
const SUB_FILTER_TYPES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Imagem' },
  { value: 'office', label: 'Office / Planilha' },
  { value: 'text', label: 'Texto' },
  { value: 'video', label: 'Vídeo' },
  { value: 'audio', label: 'Áudio' },
  { value: 'archive', label: 'Compactado' },
  { value: 'other', label: 'Outros' },
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

// ── Arrastar pasta(s) do sistema de arquivos ────────────────────────────────

/** Pasta arrastada + os arquivos que estavam dentro dela (recursivo). */
interface DroppedFolder { nome: string; files: File[]; }

/** Lê o arquivo de uma entrada de arquivo do sistema de arquivos. */
function readFileEntry(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file((file) => resolve(file), () => resolve(null));
  });
}

/** Lê (recursivamente) os arquivos de uma entrada arrastada. */
async function readEntryFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const f = await readFileEntry(entry as FileSystemFileEntry);
    return f ? [f] : [];
  }
  if (!entry.isDirectory) return [];
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children: FileSystemEntry[] = [];
  // readEntries devolve em lotes de ~100: repetir até vir um lote vazio.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries((es) => resolve(es), () => resolve([]));
    });
    if (!batch.length) break;
    children.push(...batch);
  }
  const nested = await Promise.all(children.map((c) => readEntryFiles(c)));
  return nested.flat();
}

/** Separa o que foi solto em pastas (com seus arquivos) e arquivos soltos. */
async function readDroppedEntries(dt: DataTransfer): Promise<{ folders: DroppedFolder[]; looseFiles: File[] }> {
  const entries: FileSystemEntry[] = [];
  for (const it of Array.from(dt.items || [])) {
    if (it.kind !== 'file') continue;
    const entry = typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null;
    if (entry) entries.push(entry);
  }
  // Navegador sem FileSystem API → trata tudo como arquivos soltos.
  if (!entries.length) return { folders: [], looseFiles: Array.from(dt.files || []) };

  const folders: DroppedFolder[] = [];
  const looseFiles: File[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      folders.push({ nome: entry.name, files: await readEntryFiles(entry) });
    } else {
      looseFiles.push(...(await readEntryFiles(entry)));
    }
  }
  return { folders, looseFiles };
}

/** Detecta se o arraste contém pasta (null = navegador não informa durante o arraste). */
function dragHasFolder(dt?: DataTransfer | null): boolean | null {
  if (!dt || !dt.items || !dt.items.length) return null;
  let viuArquivo = false;
  for (const it of Array.from(dt.items)) {
    if (it.kind !== 'file') continue;
    const entry = typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null;
    if (!entry) return null;
    viuArquivo = true;
    if (entry.isDirectory) return true;
  }
  return viuArquivo ? false : null;
}

/** Numeração automática do cadastro em lote (o nome do documento vem da pasta). */
const numeracaoAleatoria = () =>
  `${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

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

  // Arrastar pasta(s) para a aba Documentos.
  const [pageDrag, setPageDrag] = useState(false);
  const dragDepth = useRef(0);
  // Nome da pasta que originou o cadastro simples (mostrado como dica no modal).
  const [folderOrigin, setFolderOrigin] = useState<string | null>(null);
  // Cadastro em lote: 2+ pastas soltas de uma vez → pergunta somente o tipo.
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderQueue, setFolderQueue] = useState<DroppedFolder[]>([]);
  const [folderTipo, setFolderTipo] = useState('');
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderProgress, setFolderProgress] = useState<{ done: number; total: number } | null>(null);

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
    setFolderOrigin(null);
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
    setFolderOrigin(null);
    setModalOpen(true);
  };

  // ─ Arrastar pasta(s) para a aba Documentos ───────────────────────────────
  // Com um modal aberto (ou pré-visualização), o arraste pertence ao modal —
  // os eventos React sobem pela árvore mesmo com portal, então ignoramos aqui.
  const arrasteNaAbaDesativado = () => modalOpen || folderModalOpen || !!previewDoc;

  const handlePageDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (arrasteNaAbaDesativado()) return;
    e.preventDefault();
    dragDepth.current += 1;
    // Só exibe a área de soltar quando o arraste tem pasta (null = indefinido).
    if (dragHasFolder(e.dataTransfer) !== false) setPageDrag(true);
  };

  const handlePageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (arrasteNaAbaDesativado()) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };

  const handlePageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (arrasteNaAbaDesativado()) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setPageDrag(false);
  };

  /** Solta pasta(s) na aba: 1 pasta = cadastro simples já com o nome dela;
   *  2+ pastas = cadastro em lote perguntando apenas o tipo. */
  const handlePageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (arrasteNaAbaDesativado()) return;
    e.preventDefault();
    dragDepth.current = 0;
    setPageDrag(false);
    if (!e.dataTransfer) return;
    const { folders } = await readDroppedEntries(e.dataTransfer);
    const comArquivos = folders.filter((f) => f.files.length > 0);
    if (!comArquivos.length) {
      toast({
        title: folders.length > 0 ? 'Pasta sem arquivos' : 'Nenhuma pasta detectada',
        description: folders.length > 0
          ? 'A(s) pasta(s) solta(s) não contêm arquivos para vincular.'
          : 'Solte uma pasta aqui para cadastrar. Para adicionar arquivos avulsos, abra a sub-pasta do documento.',
        variant: 'destructive',
      });
      return;
    }
    if (comArquivos.length === 1) {
      openFolderSingle(comArquivos[0]);
      return;
    }
    openFolderBatch(comArquivos);
  };

  /** 1 pasta → abre o cadastro normal com nome e arquivos já preenchidos. */
  const openFolderSingle = (pasta: DroppedFolder) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, nome: pasta.nome.slice(0, 255) });
    setSelectedFile(null);
    setRemoveFile(false);
    setDragActive(false);
    setPendingFiles(pasta.files);
    setUploadProgress(null);
    setFolderOrigin(`${pasta.nome} · ${pasta.files.length} arquivo${pasta.files.length === 1 ? '' : 's'}`);
    setModalOpen(true);
  };

  /** Botão "Importar pasta": mesma regra do arraste, mas via seletor do sistema.
   *  O navegador permite escolher várias pastas com Ctrl/Shift. */
  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    // Agrupa pela pasta raiz: webkitRelativePath = "Pasta/Sub/arquivo.pdf".
    const mapa = new Map<string, File[]>();
    for (const f of files) {
      const raiz = (f.webkitRelativePath || '').split('/')[0] || f.name;
      const arr = mapa.get(raiz);
      if (arr) arr.push(f);
      else mapa.set(raiz, [f]);
    }
    const pastas: DroppedFolder[] = Array.from(mapa, ([nome, fs]) => ({ nome, files: fs }));
    if (pastas.length === 1) openFolderSingle(pastas[0]);
    else openFolderBatch(pastas);
  };

  const openFolderBatch = (pastas: DroppedFolder[]) => {
    setFolderQueue(pastas);
    setFolderTipo('');
    setFolderProgress(null);
    setFolderModalOpen(true);
  };

  /** Cria 1 documento por pasta: nome = nome da pasta, tipo comum informado,
   *  numeração aleatória e arquivos vinculados automaticamente. */
  const handleSaveFolderBatch = async () => {
    const tipo = folderTipo.trim();
    if (!tipo) {
      return toast({ title: 'Tipo obrigatório', description: 'Informe o tipo dos documentos.', variant: 'destructive' });
    }
    const pastas = folderQueue.filter((f) => f.files.length > 0);
    if (!pastas.length) {
      return toast({ title: 'Nada para cadastrar', description: 'As pastas soltas não contêm arquivos.', variant: 'destructive' });
    }
    setFolderSaving(true);
    setFolderProgress({ done: 0, total: pastas.length });
    const criados: string[] = [];
    let arquivosComFalha = 0;
    let done = 0;
    for (const pasta of pastas) {
      try {
        // Pasta com 1 arquivo segue o fluxo simples (arquivo vinculado).
        const unico = pasta.files.length === 1 ? pasta.files[0] : null;
        let arquivoUrl: string | null = null;
        let arquivoNome: string | null = null;
        let arquivoTamanho: number | null = null;
        let arquivoTipo: string | null = null;
        if (unico) {
          const up = await uploadDocumentFile(unico);
          arquivoUrl = up.url;
          arquivoNome = unico.name;
          arquivoTamanho = up.size;
          arquivoTipo = unico.type || null;
        }
        const created = await erpService.createDocument({
          nome: pasta.nome.slice(0, 255),
          tipo,
          numeracao: numeracaoAleatoria(),
          arquivoUrl,
          arquivoNome,
          arquivoTamanho,
          arquivoTipo,
        });
        criados.push(created.id);
        if (!unico) {
          for (const f of pasta.files) {
            try {
              await erpService.uploadDocumentFile(created.id, f);
            } catch {
              arquivosComFalha += 1;
            }
          }
        }
      } catch (err) {
        toast({
          title: `Falha ao cadastrar "${pasta.nome}"`,
          description: err instanceof Error ? err.message : 'Pasta ignorada.',
          variant: 'destructive',
        });
      }
      done += 1;
      setFolderProgress({ done, total: pastas.length });
    }
    setFolderSaving(false);
    setFolderProgress(null);
    setFolderModalOpen(false);
    setFolderQueue([]);
    toast({
      title: criados.length === 1 ? 'Documento cadastrado' : `${criados.length} documentos cadastrados`,
      description: arquivosComFalha > 0
        ? `${arquivosComFalha} arquivo(s) não foram enviados — abra a sub-pasta para reenviar.`
        : 'Cada pasta virou um documento com seus arquivos vinculados.',
    });
    await load();
    refreshMeta();
    if (criados.length) {
      setExpandedIds((prev) => { const n = new Set(prev); criados.forEach((id) => n.add(id)); return n; });
      // Carrega os arquivos de cada documento criado para que a sub-pasta
      // já apareça com o conteúdo ao ser exibida.
      await Promise.all(criados.map((id) => loadDocFiles(id)));
    }
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

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    // Pasta solta dentro do modal: lê recursivamente os arquivos de dentro dela.
    if (dragHasFolder(dt) === true) {
      const { folders, looseFiles } = await readDroppedEntries(dt);
      const todos = [...folders.flatMap((p) => p.files), ...looseFiles];
      if (!todos.length) return;
      // Uma única pasta e nome ainda vazio → nome do documento vem da pasta.
      if (folders.length === 1 && !form.nome.trim()) {
        setForm((prev) => ({ ...prev, nome: folders[0].nome.slice(0, 255) }));
      }
      addPendingFiles(todos);
      return;
    }
    const files = dt.files;
    if (!files || !files.length) return;
    addPendingFiles(files);
  };

  // ── Sub-pasta ─────────────────────────────────────────────────────────────
  const loadDocFiles = async (docId: string) => {
    setFilesLoading((s) => ({ ...s, [docId]: true }));
    try {
      const files = await erpService.listDocumentFiles(docId);
      setFilesStore((s) => ({ ...s, [docId]: files }));
    } catch (e: any) {
      toast({ title: 'Erro ao carregar arquivos', description: e?.message, variant: 'destructive' });
    } finally {
      setFilesLoading((s) => ({ ...s, [docId]: false }));
    }
  };

  const toggleExpand = (doc: ErpDocument) => {
    const next = new Set(expandedIds);
    if (next.has(doc.id)) {
      next.delete(doc.id);
    } else {
      next.add(doc.id);
      if (!filesStore[doc.id] && !filesLoading[doc.id]) loadDocFiles(doc.id);
    }
    setExpandedIds(next);
  };

  // Ao buscar na aba Documentos, abre automaticamente as sub-pastas que tenham
  // algum arquivo casando com o termo — assim o arquivo encontrado fica visível
  // sem precisar clicar na linha.
  useEffect(() => {
    const term = qDebounced.trim().toLowerCase();
    if (!term) return;
    const toOpen = items.filter(
      (d) => (d.arquivosCount || 0) > 1
        && (d.arquivosNomes || []).some((n) => (n || '').toLowerCase().includes(term)),
    );
    if (!toOpen.length) return;
    setExpandedIds((prev) => {
      const missing = toOpen.filter((d) => !prev.has(d.id));
      if (!missing.length) return prev;
      const next = new Set(prev);
      missing.forEach((d) => next.add(d.id));
      return next;
    });
    toOpen.forEach((d) => { if (!filesStore[d.id] && !filesLoading[d.id]) loadDocFiles(d.id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, items]);

  // Recarrega a listagem (o backend pode normalizar a sub-pasta após cada
  // alteração de arquivo: 1 arquivo vira vinculado simples, 2+ viram sub-pasta).
  const refreshDoc = async (docId: string) => {
    try {
      const files = await erpService.listDocumentFiles(docId);
      setFilesStore((s) => ({ ...s, [docId]: files }));
    } catch { /* silencioso: a listagem geral já é recarregada abaixo */ }
    await load();
  };

  const addFileToDoc = async (docId: string, file: File) => {
    setSubUploading((s) => ({ ...s, [docId]: true }));
    try {
      const created = await erpService.uploadDocumentFile(docId, file);
      setFilesStore((s) => ({ ...s, [docId]: [created, ...(s[docId] || [])] }));
      await refreshDoc(docId);
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
      await refreshDoc(doc.id);
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
    const files = e.dataTransfer.files;
    if (files && files.length) Array.from(files).forEach((f) => addFileToDoc(docId, f));
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

      // Regra de negócio:
      //  - Com exatamente 1 arquivo (criação OU edição) → ele vira/substitui o
      //    arquivo vinculado do documento (fluxo simples, sem sub-pasta).
      //  - Com 2+ arquivos → sub-pasta, com cada arquivo individual.
      //  - selectedFile (botão "Substituir arquivo") também troca o principal.
      const singleFile = pendingFiles.length === 1 ? pendingFiles[0] : null;

      if (singleFile) {
        const up = await uploadDocumentFile(singleFile);
        arquivoUrl = up.url;
        arquivoNome = singleFile.name;
        arquivoTamanho = up.size;
        arquivoTipo = singleFile.type || null;
      } else if (selectedFile) {
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

      // 2) Sub-pasta apenas quando houver 2+ arquivos.
      //    Com 1 arquivo, ele já virou o arquivo vinculado principal.
      const subFiles = singleFile ? [] : pendingFiles;
      const subCount = subFiles.length;
      if (docId && subCount > 1) {
        setUploadProgress({ done: 0, total: subCount });
        let done = 0;
        for (const f of subFiles) {
          try {
            await erpService.uploadDocumentFile(docId, f);
          } catch (e: any) {
            toast({ title: `Falha ao enviar "${f.name}"`, description: e?.message || 'Arquivo ignorado.', variant: 'destructive' });
          }
          done += 1;
          setUploadProgress({ done, total: subCount });
        }
      }

      toast({
        title: 'Documento salvo',
        description: subCount > 1
          ? `${nome} salvo e sub-pasta gerada com ${subCount} arquivo(s).`
          : singleFile
            ? `${nome}${editing ? ' atualizado' : ''} · arquivo "${singleFile.name}" vinculado.`
            : `${nome} foi salvo com sucesso.`,
      });
      setModalOpen(false);
      setPendingFiles([]);
      setUploadProgress(null);
      setFolderOrigin(null);
      await load();
      refreshMeta();

      // Abre a sub-pasta do documento recém-criado para mostrar os arquivos enviados.
      if (!editing?.id && docId && subCount > 1) {
        const newDocId = docId as string;
        setExpandedIds((prev) => { const n = new Set(prev); n.add(newDocId); return n; });
        loadDocFiles(newDocId);
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
    <div
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 relative"
      onDragEnter={handlePageDragEnter}
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {/* Área de soltar pasta(s) — aparece ao arrastar uma pasta para a aba */}
      {pageDrag && (
        <div className="fixed inset-0 z-40 bg-indigo-600/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none p-4">
          <div className="rounded-2xl border-2 border-dashed border-indigo-400 bg-white/95 px-6 py-5 shadow-xl text-center max-w-md">
            <FolderArchive className="h-9 w-9 mx-auto text-indigo-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800">Solte a(s) pasta(s) para cadastrar</p>
            <p className="text-xs text-slate-500 mt-1">
              <strong>1 pasta</strong> → o nome do documento já vem preenchido com o nome dela.{' '}
              <strong>2+ pastas</strong> → informe só o tipo: cada pasta vira um documento.
            </p>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-indigo-500" /> Documentos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Arquive e organize documentos de qualquer tipo — com pré-visualização e download.
            Arraste uma <strong>pasta</strong> aqui para cadastrar automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Importar pasta(s): mesma regra do arraste, via seletor do sistema. */}
          <input
            id="erp-doc-folder-input"
            type="file"
            multiple
            className="hidden"
            ref={(el) => {
              // webkitdirectory não existe nos tipos do JSX — só via atributo.
              if (el && !el.hasAttribute('webkitdirectory')) {
                el.setAttribute('webkitdirectory', '');
                el.setAttribute('directory', '');
              }
            }}
            onChange={handleFolderInputChange}
          />
          <Button variant="outline" onClick={() => document.getElementById('erp-doc-folder-input')?.click()}>
            <FolderArchive className="h-4 w-4" /> Importar pasta
          </Button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_240px_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, numeração, empresa, tipo ou arquivo (inclusive dentro de sub-pastas)…"
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
          <table className="w-full text-sm table-fixed">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left px-3 py-3 font-medium w-[22%]">Documento</th>
                <th className="text-left px-3 py-3 font-medium w-[10%]">Tipo</th>
                <th className="text-left px-3 py-3 font-medium w-[10%] hidden lg:table-cell">Numeração</th>
                <th className="text-left px-3 py-3 font-medium w-[14%] hidden md:table-cell">Empresa Emissora</th>
                <th className="text-left px-3 py-3 font-medium w-[16%]">Arquivo</th>
                <th className="text-left px-3 py-3 font-medium w-[10%] hidden sm:table-cell">Data</th>
                <th className="text-right px-3 py-3 font-medium w-[18%]">Ações</th>
              </tr>
            </thead>
              <tbody>
                {items.map((d) => {
                  const ext = fileExtension(d.arquivoNome);
                  const canEditFile = !!d.arquivoUrl && (SPREADSHEET_EXTS.includes(ext) || OFFICE_DOC_EXTS.includes(ext));
                  const isExpanded = expandedIds.has(d.id);
                  const subFiles = visibleSubFiles(d.id);
                  // Sub-pasta existe apenas com 2+ arquivos próprios. Documento com
                  // arquivo vinculado (1 arquivo) é registro comum — sem sub-pasta.
                  const isSub = (d.arquivosCount || 0) > 1;
                  const qNorm = qDebounced.trim().toLowerCase();
                  // Arquivos da sub-pasta que casaram com a busca geral.
                  const matchedSubNames = qNorm && isSub
                    ? (d.arquivosNomes || []).filter((n) => (n || '').toLowerCase().includes(qNorm))
                    : [];
                  return (
                    <React.Fragment key={d.id}>
                    <tr
                      className={`border-t border-slate-100 ${isSub ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'}`}
                      onClick={isSub ? () => toggleExpand(d) : undefined}
                      title={isSub ? (isExpanded ? 'Clique para recolher a sub-pasta' : 'Clique para ver os arquivos da sub-pasta') : undefined}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className={`h-4 w-4 flex-shrink-0 ${isSub ? 'text-indigo-400' : 'text-indigo-500'}`} />
                          <span className="truncate font-medium" title={d.nome}>{d.nome}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {d.tipo
                          ? <Badge variant="outline" className="max-w-full truncate">{d.tipo}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground hidden lg:table-cell">
                        <span className="truncate block" title={d.numeracao}>{d.numeracao || '—'}</span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground hidden md:table-cell">
                        <span className="truncate block" title={d.empresaEmissora}>{d.empresaEmissora || '—'}</span>
                      </td>
                      <td className="px-3 py-3">
                        {isSub ? (
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FolderArchive className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                              <span className="text-xs font-medium text-indigo-700">Sub-pasta</span>
                              {isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />}
                            </div>
                            {matchedSubNames.length > 0 && (
                              <p className="text-[11px] text-indigo-600 truncate mt-0.5" title={matchedSubNames.join(' · ')}>
                                {matchedSubNames.length === 1
                                  ? matchedSubNames[0]
                                  : `${matchedSubNames[0]} +${matchedSubNames.length - 1}`}
                              </p>
                            )}
                          </div>
                        ) : d.arquivoNome ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            <span className="text-xs truncate" title={d.arquivoNome}>{d.arquivoNome}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell text-xs whitespace-nowrap">{fmtDate(d.createdAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                          {!isSub && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizar" disabled={!d.arquivoUrl}
                              onClick={() => setPreviewDoc(d)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {!isSub && canEditFile && (
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              title={SPREADSHEET_EXTS.includes(ext) ? 'Editar planilha' : 'Editar documento'}
                              onClick={() => handleEditFile(d)}
                            >
                              <FileEdit className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {!isSub && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Baixar" disabled={!d.arquivoUrl}
                              onClick={() => handleDownload(d)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar documento" onClick={() => openEdit(d)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Excluir documento"
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(d)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {isSub && isExpanded && (
                      <tr key={`${d.id}-sub`} className="border-t border-slate-100 bg-indigo-50/20">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="rounded-xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
                            {/* Cabeçalho da sub-pasta */}
                            <div className="flex items-center justify-between gap-3 px-3 py-2 bg-indigo-50/70 border-b border-indigo-100">
                              <div className="flex items-center gap-2 min-w-0">
                                <FolderArchive className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                                <span className="text-sm font-semibold truncate" title={d.nome}>
                                  Arquivos de {d.nome}
                                </span>
                              </div>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" title="Fechar sub-pasta"
                                onClick={() => { const n = new Set(expandedIds); n.delete(d.id); setExpandedIds(n); }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Barra de ferramentas */}
                            <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-50/70 border-b border-slate-100">
                              <div className="relative flex-1 min-w-[180px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  value={fileSearch[d.id] || ''}
                                  onChange={(e) => setFileSearch((s) => ({ ...s, [d.id]: e.target.value }))}
                                  placeholder="Buscar arquivo por nome..."
                                  className="pl-9 h-9"
                                />
                              </div>
                              <select
                                value={fileTipoFilter[d.id] || 'all'}
                                onChange={(e) => setFileTipoFilter((s) => ({ ...s, [d.id]: e.target.value }))}
                                className="h-9 px-3 rounded-md border bg-white text-sm"
                              >
                                {SUB_FILTER_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9"
                                disabled={!!subUploading[d.id]}
                                onClick={(e) => { e.stopPropagation(); document.getElementById(`erp-doc-sub-input-${d.id}`)?.click(); }}
                              >
                                {subUploading[d.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                                {subUploading[d.id] ? 'Enviando…' : 'Adicionar'}
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

                            {/* Lista de arquivos (ordenada por data, mais recentes primeiro) */}
                            {filesLoading[d.id] ? (
                              <div className="p-6 text-center text-muted-foreground">
                                <Loader2 className="h-5 w-5 mx-auto animate-spin" /> Carregando arquivos…
                              </div>
                            ) : subFiles.length === 0 ? (
                              <div className="p-6 text-center text-muted-foreground text-sm">
                                {(filesStore[d.id] || []).length === 0
                                  ? 'Ainda não há arquivos nesta sub-pasta — use “Adicionar” ou arraste um aqui embaixo.'
                                  : 'Nenhum arquivo corresponde a esta busca e filtro.'}
                              </div>
                            ) : (
                              <ul className="divide-y divide-slate-100">
                                {subFiles.map((f) => {
                                  const fKind = getPreviewKind(f.arquivoNome, f.arquivoTipo);
                                  const fAbs = toAbsoluteUrl(f.arquivoUrl);
                                  return (
                                    <li key={f.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50/70">
                                      <span className="flex-shrink-0">{subFileIcon(fKind)}</span>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate" title={f.arquivoNome}>{f.arquivoNome}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                          {previewKindLabels[fKind]} · {formatFileSize(f.arquivoTamanho)} · {fmtDate(f.createdAt)}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir em nova aba"
                                          disabled={!fAbs}
                                          onClick={() => fAbs && window.open(fAbs, '_blank', 'noopener,noreferrer')}>
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Visualizar" onClick={() => openFilePreview(d, f)}>
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Baixar"
                                          onClick={() => downloadFileFromUrl(f.arquivoUrl, f.arquivoNome).catch(() => {})}>
                                          <Download className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost" size="icon" title="Remover arquivo"
                                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                          onClick={() => handleRemoveDocFile(d, f)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}

                            {/* Zona de arraste (rodapé) */}
                            <div
                              className={`border-t border-dashed px-3 py-3 text-center text-xs transition-colors cursor-pointer ${
                                subDragActive[d.id] ? 'border-indigo-400 bg-indigo-50/70 text-indigo-700' : 'border-slate-200 text-muted-foreground hover:border-indigo-300 hover:bg-slate-50/60'
                              }`}
                              onDragEnter={onSubDragEnter(d.id)}
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!subDragActive[d.id]) setSubDragActive((s) => ({ ...s, [d.id]: true })); }}
                              onDragLeave={onSubDragLeave(d.id)}
                              onDrop={onSubDrop(d.id)}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <UploadCloud className="h-3.5 w-3.5" />
                                {subDragActive[d.id] ? 'Solte aqui para adicionar à sub-pasta' : 'Arraste e solte arquivos aqui para adicionar à sub-pasta'}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
        )}

        <div className="px-3">
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
      <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o && !saving) { setPendingFiles([]); setFolderOrigin(null); } }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar documento' : 'Novo documento'}</DialogTitle>
          </DialogHeader>

          {folderOrigin && !editing && (
            <div className="flex items-start gap-2.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5">
              <FolderArchive className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 text-xs text-indigo-900">
                <p className="font-semibold">Pasta arrastada: {folderOrigin}</p>
                <p className="text-indigo-700/90 mt-0.5">
                  O nome do documento e os arquivos já foram preenchidos — confira o tipo e conclua o cadastro.
                </p>
              </div>
            </div>
          )}

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

            {/* Arquivos do documento: 1 arquivo = vinculado · 2+ = sub-pasta */}
            <div className="rounded-xl border p-4 space-y-3 bg-slate-50/60">
              <div className="flex items-center justify-between gap-2">
                <Label className="mb-0">Arquivos do documento</Label>
                {pendingFiles.length > 0 && (
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-0.5">
                    {pendingFiles.length === 1
                      ? '1 arquivo · vinculado'
                      : `${pendingFiles.length} arquivos · sub-pasta`}
                  </span>
                )}
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

              <div
                className={`flex flex-col items-center justify-center gap-1 py-6 rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-indigo-400 bg-indigo-100 text-indigo-700'
                    : 'border-slate-300 text-muted-foreground hover:border-indigo-300 hover:bg-white'
                }`}
                onClick={() => document.getElementById('erp-doc-file-input')?.click()}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <UploadCloud className="h-6 w-6" />
                <p className="text-sm font-medium">
                  {dragActive ? 'Solte os arquivos aqui' : 'Arraste e solte os arquivos aqui'}
                </p>
                <p className="text-xs opacity-80">
                  {pendingFiles.length === 1
                    ? editing
                      ? 'Este arquivo substituirá o arquivo vinculado atual'
                      : 'Este arquivo será vinculado ao documento'
                    : pendingFiles.length > 1
                      ? `${pendingFiles.length} arquivos formarão uma sub-pasta`
                      : 'ou clique para selecionar · 1 arquivo = vinculado · 2+ = sub-pasta'}
                </p>
              </div>

              {pendingFiles.length > 0 && (
                <div className="rounded-lg border bg-white overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
                    <p className="text-xs font-medium text-muted-foreground">
                      {pendingFiles.length === 1
                        ? editing
                          ? 'Arquivo que substituirá o atual'
                          : 'Arquivo a ser vinculado'
                        : `Arquivos da sub-pasta (${pendingFiles.length})`}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                      onClick={(e) => { e.stopPropagation(); setPendingFiles([]); }}
                    >
                      Limpar todos
                    </Button>
                  </div>
                  <ul className="divide-y">
                    {pendingFiles.map((f, i) => (
                      <li key={`${f.name}|${f.size}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{f.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); removePendingFile(i); }}
                          title="Remover arquivo"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pendingFiles.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); document.getElementById('erp-doc-file-input')?.click(); }}
                >
                  <UploadCloud className="h-4 w-4" />
                  Adicionar mais arquivos
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setModalOpen(false); setPendingFiles([]); setFolderOrigin(null); }} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {saving
                ? uploadProgress
                  ? `Enviando ${uploadProgress.done}/${uploadProgress.total}…`
                  : 'Salvando…'
                : editing
                  ? 'Salvar alterações'
                  : pendingFiles.length > 1
                    ? `Cadastrar documento · sub-pasta com ${pendingFiles.length} arquivos`
                    : pendingFiles.length === 1
                      ? 'Cadastrar documento com arquivo'
                      : 'Cadastrar documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cadastro em lote — 2+ pastas soltas na aba Documentos */}
      <Dialog
        open={folderModalOpen}
        onOpenChange={(o) => { if (!o && !folderSaving) { setFolderModalOpen(false); setFolderQueue([]); } }}
      >
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderArchive className="h-5 w-5 text-indigo-500" />
              Cadastrar {folderQueue.length} pasta{folderQueue.length === 1 ? '' : 's'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-1 pr-1">
            <p className="text-sm text-muted-foreground">
              Cada pasta vira um documento: o <strong>nome</strong> vem do nome da pasta e a{' '}
              <strong>numeração</strong> é gerada automaticamente. Informe apenas o <strong>tipo</strong>,
              que será o mesmo para todas.
            </p>

            <div className="space-y-2">
              <Label>Tipo dos documentos *</Label>
              <Input
                list="erp-doc-tipos-lote"
                value={folderTipo}
                onChange={(e) => setFolderTipo(e.target.value)}
                placeholder="Ex: Orçamento"
                disabled={folderSaving}
              />
              <datalist id="erp-doc-tipos-lote">
                {tipoOptions.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b">
                <span className="text-xs font-semibold text-slate-700">Pastas selecionadas</span>
                <span className="text-xs text-muted-foreground">
                  {folderQueue.reduce((s, f) => s + f.files.length, 0)} arquivo(s) no total
                </span>
              </div>
              <ul className="divide-y max-h-64 overflow-y-auto">
                {folderQueue.map((pasta, i) => (
                  <li key={`${pasta.nome}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FolderArchive className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" title={pasta.nome}>{pasta.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {pasta.files.length === 1
                            ? '1 arquivo · vinculado'
                            : `${pasta.files.length} arquivos · sub-pasta`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0"
                      title="Remover da lista" disabled={folderSaving}
                      onClick={() => setFolderQueue((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              disabled={folderSaving}
              onClick={() => { setFolderModalOpen(false); setFolderQueue([]); }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveFolderBatch}
              disabled={folderSaving || !folderTipo.trim() || folderQueue.length === 0}
            >
              {folderSaving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Plus className="h-4 w-4" />}
              {folderSaving
                ? (folderProgress ? `Cadastrando ${folderProgress.done}/${folderProgress.total}…` : 'Cadastrando…')
                : `Cadastrar ${folderQueue.length} documento${folderQueue.length === 1 ? '' : 's'}`}
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