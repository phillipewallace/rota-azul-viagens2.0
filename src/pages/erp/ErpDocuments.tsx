/**
 * ERP Ã¢â€ â€™ Documentos
 * Central de documentos: nome, empresa emissora, numeraÃ§Ã£o, tipo e arquivo
 * vinculado (qualquer tipo/extensÃ£o). PrÃ©-visualizaÃ§Ã£o, download, busca e filtros.
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
import { erpService, type ErpCompany, type ErpDocument, type ErpDocumentFile, type ErpFolder } from '@/services/erp';
import { uploadDocumentFile } from '@/utils/documentUpload';
import { confirmDialog } from '@/lib/confirm';
import PaginationBar from '@/components/PaginationBar';
import DocumentPreviewDialog from '@/components/erp/DocumentPreviewDialog';
import FolderTree from '@/components/erp/FolderTree';
import ExplorerAddressBar from '@/components/erp/explorer/ExplorerAddressBar';
import ExplorerToolbar from '@/components/erp/explorer/ExplorerToolbar';
import ExplorerStatusBar from '@/components/erp/explorer/ExplorerStatusBar';
import ExplorerContextMenu, { type CtxMenuItem } from '@/components/erp/explorer/ExplorerContextMenu';
import ExplorerDetails from '@/components/erp/explorer/ExplorerDetails';
import ExplorerIcons from '@/components/erp/explorer/ExplorerIcons';
import FolderNameDialog, { type FolderNameState } from '@/components/erp/explorer/FolderNameDialog';
import { DOC_DRAG_MIME, ICON_SIZES, VIEW_MODES, type CtxTarget, type ExplorerEntry, type IconSize, type SortKey, type ViewMode } from '@/components/erp/explorer/types';
import { formatFileSize, getPreviewKind, downloadFileFromUrl, previewKindLabels, type PreviewKind } from '@/utils/documentFiles';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { SPREADSHEET_EXTS, OFFICE_DOC_EXTS } from '@/utils/spreadsheetConvert';
import {
  Plus, Search, RefreshCw, Trash2, Pencil, Eye, Download, FolderOpen, X,
  FileText, Filter, UploadCloud, FileQuestion, FileEdit, ChevronDown, ChevronRight,
  FolderArchive, Loader2, FileImage, FileVideo, FileAudio, FileArchive, FileSpreadsheet, FileType, ExternalLink,
  LayoutGrid, List, ChevronUp, FolderInput, Folder,
} from 'lucide-react';

/** LÃª uma preferÃªncia da view do Explorer, validando contra as opÃ§Ãµes vÃ¡lidas. */
function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(`erp-docs-${key}`);
    return (allowed as readonly string[]).includes(raw as T) ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Grava a preferÃªncia da view. Falhas de storage (modo privado) nÃ£o quebram a UI. */
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(`erp-docs-${key}`, value);
  } catch { /* preferÃªncia apenas nesta sessÃ£o */ }
}

const TIPO_SUGGESTIONS = [
  'Contrato', 'OrÃ§amento', 'Ordem de ServiÃ§o', 'Nota Fiscal', 'Recibo', 'Boleto',
  'AlvarÃ¡', 'LicenÃ§a', 'Laudo', 'Manual', 'Certificado', 'ProcuraÃ§Ã£o',
  'Contrato Social', 'CNPJ', 'Seguro', 'Outros',
];

// Filtro prÃ³prio de cada sub-pasta (por tipo de arquivo).
const SUB_FILTER_TYPES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Imagem' },
  { value: 'office', label: 'Office / Planilha' },
  { value: 'text', label: 'Texto' },
  { value: 'video', label: 'VÃ­deo' },
  { value: 'audio', label: 'Ãudio' },
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

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : 'Ã¢â‚¬â€');

// Ã¢â€â‚¬Ã¢â€â‚¬ Arrastar arquivos e pastas do sistema de arquivos Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
/**
 * Nó da árvore arrastada do sistema de arquivos.
 * `arquivo` preenchido = folha; `arquivo` nulo = pasta (tem `filhos`).
 */
interface DroppedNode {
  nome: string;
  arquivo: File | null;
  filhos: DroppedNode[];
}

const isPasta = (n: DroppedNode): boolean => n.arquivo === null;

/** Lê o arquivo de uma entrada de arquivo do sistema de arquivos. */
function readFileEntry(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file((file) => resolve(file), () => resolve(null));
  });
}

/** Lê os filhos diretos de uma pasta arrastada (o leitor devolve em lotes de ~100). */
async function readDirectoryChildren(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const children: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries((es) => resolve(es), () => resolve([]));
    });
    if (!batch.length) break;
    children.push(...batch);
  }
  return children;
}

/**
 * Lê a árvore de uma entrada arrastada PRESERVANDO a hierarquia de pastas —
 * é essa estrutura que vira a árvore de pastas do explorer (Financeiro › 2025 › …).
 */
async function readEntryTree(entry: FileSystemEntry): Promise<DroppedNode | null> {
  if (entry.isFile) {
    const arquivo = await readFileEntry(entry as FileSystemFileEntry);
    return arquivo ? { nome: entry.name, arquivo, filhos: [] } : null;
  }
  if (!entry.isDirectory) return null;
  const children = await readDirectoryChildren(entry as FileSystemDirectoryEntry);
  const filhos = (await Promise.all(children.map((c) => readEntryTree(c)))).filter(
    (n): n is DroppedNode => n !== null
  );
  return { nome: entry.name, arquivo: null, filhos };
}

/** Espalha os arquivos de uma subárvore, atravessando as subpastas. */
const flattenFiles = (node: DroppedNode): File[] =>
  (node.arquivo ? [node.arquivo] : node.filhos.flatMap(flattenFiles));

/** Conta as pastas de uma subárvore (a própria inclusive). */
const countPastas = (node: DroppedNode): number =>
  (isPasta(node) ? 1 : 0) + node.filhos.reduce((s, f) => s + countPastas(f), 0);

/**
 * Conta quantos DOCUMENTOS a subárvore vai gerar: uma pasta só vira documento
 * se tiver arquivos diretamente dentro dela (subpastas geram os seus).
 */
const countDocsNaArvore = (node: DroppedNode): number => {
  if (!isPasta(node)) return 0;
  const diretos = node.filhos.filter((f) => !isPasta(f)).length;
  return (diretos > 0 ? 1 : 0) + node.filhos.reduce((s, f) => s + countDocsNaArvore(f), 0);
};

/** Total de documentos que as raízes da fila vão gerar (para o diálogo). */
const countDocsDaFila = (nos: DroppedNode[]): number =>
  nos.reduce((s, n) => s + countDocsNaArvore(n), 0);

/** Total de pastas + arquivos de uma subárvore (mostrar no diálogo). */
const countNodes = (node: DroppedNode): { pastas: number; arquivos: number } => {
  if (!isPasta(node)) return { pastas: 0, arquivos: 1 };
  const sub = node.filhos.reduce(
    (acc, f) => {
      const r = countNodes(f);
      return { pastas: acc.pastas + r.pastas, arquivos: acc.arquivos + r.arquivos };
    },
    { pastas: 0, arquivos: 0 }
  );
  return { pastas: sub.pastas + 1, arquivos: sub.arquivos };
};

/**
 * Separa o que foi solto em raízes de pasta (com a árvore inteira) e arquivos soltos.
 * Cada raiz de pasta arrastada vira uma pasta real no destino, com as subpastas dentro.
 */
async function readDroppedEntries(dt: DataTransfer): Promise<{ folders: DroppedNode[]; looseFiles: File[] }> {
  const entries: FileSystemEntry[] = [];
  for (const it of Array.from(dt.items || [])) {
    if (it.kind !== 'file') continue;
    const entry = typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null;
    if (entry) entries.push(entry);
  }
  // Navegador sem FileSystem API → trata tudo como arquivos soltos.
  if (!entries.length) return { folders: [], looseFiles: Array.from(dt.files || []) };

  const folders: DroppedNode[] = [];
  const looseFiles: File[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      const node = await readEntryTree(entry);
      if (node) folders.push(node);
    } else {
      const arquivo = await readFileEntry(entry as FileSystemFileEntry);
      if (arquivo) looseFiles.push(arquivo);
    }
  }
  return { folders, looseFiles };
}

/** Detecta se o arraste contÃ©m pasta (null = navegador nÃ£o informa durante o arraste). */
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

/** NumeraÃ§Ã£o automÃ¡tica do cadastro em lote (o nome do documento vem da pasta). */
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

  // Sub-pasta: mÃºltiplos arquivos por documento (estado por doc-id).
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ Explorer: pastas, navegaÃƒÂ§ÃƒÂ£o, visualizaÃƒÂ§ÃƒÂ£o, seleÃƒÂ§ÃƒÂ£o e ordenaÃƒÂ§ÃƒÂ£o Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [folders, setFolders] = useState<ErpFolder[]>([]);
  /** 'root' = documentos sem pasta; senÃ£o o id da pasta aberta. */
  const [currentFolder, setCurrentFolder] = useState<string>('root');
  const [viewMode, setViewMode] = useState<ViewMode>(readPref('view', VIEW_MODES, 'details'));
  const [iconSize, setIconSize] = useState<IconSize>(readPref('icons', ICON_SIZES, 'md'));
  const [sortKey, setSortKey] = useState<string>('data');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Menu de contexto: posiÃ§Ã£o + alvo (documentos, pasta, Ã¡rea vazia). */
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target: CtxTarget } | null>(null);
  /** HistÃ³rico de navegaÃ§Ã£o estilo Explorer (voltar/avanÃ§ar). */
  const [navHistory, setNavHistory] = useState<string[]>(['root']);
  const [navIdx, setNavIdx] = useState(0);
  /** Dialog criar/renomear pasta (toolbar, Ã¡rvore, F2, menu de contexto). */
  const [folderNameDlg, setFolderNameDlg] = useState<FolderNameState | null>(null);
  const [folderNameSaving, setFolderNameSaving] = useState(false);
  /** Pasta sob o cursor durante arraste de documentos na Ã¡rea de conteÃºdo. */
  const [contentDropId, setContentDropId] = useState<string | null>(null);
  /** Dialog "Mover paraÃ¢â‚¬Â¦" Ã¢â‚¬â€ ids dos documentos a mover (null = fechado). */
  const [moveDlgIds, setMoveDlgIds] = useState<string[] | null>(null);
  const [moveSaving, setMoveSaving] = useState(false);
  // Nome da pasta que originou o cadastro simples (mostrado como dica no modal).
  const [folderOrigin, setFolderOrigin] = useState<string | null>(null);
  // Cadastro em lote: 2+ pastas soltas de uma vez Ã¢â€ â€™ pergunta somente o tipo.
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderQueue, setFolderQueue] = useState<DroppedNode[]>([]);
  const [folderTipo, setFolderTipo] = useState('');
  const [folderEmpresa, setFolderEmpresa] = useState('');
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderProgress, setFolderProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setPage(1); }, [tipoFilter, empresaFilter, qDebounced, pageSize, currentFolder, sortKey, sortDir]);

  // PreferÃªncia de visualizaÃ§Ã£o (grade x detalhes) + tamanho dos Ã­cones.
  // Lidas no useState inicial (evita o "pisca" e o retorno indevido para lista
  // quando a pÃ¡gina Ã© recarregada) e gravadas a cada mudanÃ§a.
  const changeView = (m: ViewMode) => {
    setViewMode(m);
    writePref('view', m);
  };
  const changeIconSize = (s: IconSize) => {
    setIconSize(s);
    writePref('icons', s);
  };

  const loadFolders = useCallback(async () => {
    try {
      setFolders(await erpService.listFolders());
    } catch { /* sidebar degrada para sÃ³-raiz em caso de erro */ }
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    setLoading(true);
    try {
      const paged = await erpService.listDocuments({
        // Com termo de busca, varre TODAS as pastas (como antes do explorer);
        // sem busca, lista apenas a pasta aberta.
        search: qDebounced || undefined,
        folderId: qDebounced.trim() ? undefined : currentFolder,
        tipo: tipoFilter === 'all' ? undefined : tipoFilter,
        empresa: empresaFilter === 'all' ? undefined : empresaFilter,
        sort: sortKey,
        dir: sortDir,
        page,
        pageSize,
      });
      if (id !== reqRef.current) return;
      setItems(paged.data || []);
      setTotal(paged.total || 0);
      setSelectedIds((prev) => {
        if (!prev.size) return prev;
        const visible = new Set((paged.data || []).map((d: ErpDocument) => d.id));
        const next = new Set([...prev].filter((x) => visible.has(x)));
        return next.size === prev.size ? prev : next;
      });
    } catch (e: any) {
      if (id === reqRef.current) toast({ title: 'Erro ao carregar documentos', description: e?.message, variant: 'destructive' });
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [qDebounced, currentFolder, tipoFilter, empresaFilter, sortKey, sortDir, page, pageSize, toast]);

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
    // Impede que o navegador navegue/abra o arquivo quando o usuÃ¡rio soltar
    // fora da dropzone do modal (comportamento padrÃ£o de drag-and-drop).
    const preventDefault = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  useEffect(() => { load(); }, [load]);

  // OpÃ§Ãµes Ãºnicas para os filtros e datalists do formulÃ¡rio.
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

  // Ã¢â€â‚¬ Arrastar pasta(s) para a aba Documentos Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Com um modal aberto (ou prÃƒÂ©-visualizaÃƒÂ§ÃƒÂ£o), o arraste pertence ao modal Ã¢â‚¬â€
  // os eventos React sobem pela Ã¡rvore mesmo com portal, entÃ£o ignoramos aqui.
  const arrasteNaAbaDesativado = () => modalOpen || folderModalOpen || !!previewDoc;

  const handlePageDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (arrasteNaAbaDesativado()) return;
    e.preventDefault();
    dragDepth.current += 1;
    if (Array.from(e.dataTransfer.types).includes('Files')) setPageDrag(true);
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

  /**
   * Solta pasta(s) na aba. Cada raiz arrastada vira uma PASTA real na pasta atual,
   * recriando a hierarquia inteira (subpastas dentro de subpastas) e cadastrando
   * cada arquivo como documento dentro da pasta onde ele estava.
   */
  const handlePageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (arrasteNaAbaDesativado()) return;
    e.preventDefault();
    dragDepth.current = 0;
    setPageDrag(false);
    if (!e.dataTransfer) return;
    // Arraste interno de documentos (seleção → árvore): quem cuida disso é o
    // FolderTree; se soltou fora dele, não faz nada (evita toast enganoso).
    if (Array.from(e.dataTransfer.types).includes(DOC_DRAG_MIME)) return;
    const { folders, looseFiles } = await readDroppedEntries(e.dataTransfer);
    // Só entram raízes com conteúdo em algum nível da árvore.
    const comConteudo = folders.filter((f) => flattenFiles(f).length > 0);
    if (!comConteudo.length && !looseFiles.length) {
      toast({ title: 'Nenhum arquivo encontrado', description: 'Selecione arquivos ou pastas com conteúdo.', variant: 'destructive' });
      return;
    }
    openFolderBatch(comConteudo, looseFiles);
  };

  /** 1 pasta → cadastro rápido: cria a árvore de pastas direto, sem perguntar nada. */
  const openFolderSingle = (pasta: DroppedNode) => {
    setFolderTipo('');
    setFolderEmpresa('');
    setFolderProgress(null);
    setFolderQueue([pasta]);
    setFolderModalOpen(true);
  };

  /** Botão "Importar pasta": mesma regra do arraste, via seletor do sistema.
   *  Usa webkitRelativePath para remontar a hierarquia ("Pasta/Sub/Sub2/a.pdf"). */
  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    openFolderBatch([], files);
  };

  /**
   * Reconstrói a árvore de pastas a partir dos arquivos com webkitRelativePath.
   * Cada segmento do caminho vira uma pasta; o arquivo vira uma folha.
   */
  const buildTreeFromPaths = (files: File[]): DroppedNode[] => {
    const raizes = new Map<string, DroppedNode>();
    for (const f of files) {
      const partes = (f.webkitRelativePath || f.name).split('/').filter(Boolean);
      if (partes.length <= 1) {
        // Arquivo solto (sem caminho) entra na raiz como folha.
        const chave = ` ${f.name}|${f.size}`;
        raizes.set(chave, { nome: f.name, arquivo: f, filhos: [] });
        continue;
      }
      const raizNome = partes[0];
      let atual = raizes.get(raizNome);
      if (!atual) {
        atual = { nome: raizNome, arquivo: null, filhos: [] };
        raizes.set(raizNome, atual);
      }
      // Desce pelos segmentos intermediários criando as pastas.
      let cursor: DroppedNode = atual;
      for (const seg of partes.slice(1, -1)) {
        let filho = cursor.filhos.find((c) => c.nome === seg && isPasta(c));
        if (!filho) {
          filho = { nome: seg, arquivo: null, filhos: [] };
          cursor.filhos.push(filho);
        }
        cursor = filho;
      }
      cursor.filhos.push({ nome: f.name, arquivo: f, filhos: [] });
    }
    // Arquivos soltos (chave com espaço inicial) não são pastas: vira uma lista só.
    const soltos = Array.from(raizes.entries())
      .filter(([k]) => k.startsWith(' '))
      .map(([, v]) => v);
    const arvores = Array.from(raizes.entries())
      .filter(([k]) => !k.startsWith(' '))
      .map(([, v]) => v);
    return [...arvores, ...soltos];
  };

  const openFolderBatch = (pastas: DroppedNode[], soltos: File[] = []) => {
    // 1 pasta com arquivos no nível raiz = cadastro rápido (sem diálogo).
    const arvores = soltos.length ? buildTreeFromPaths([...soltos]) : pastas;
    if (arvores.length === 1 && !isPasta(arvores[0])) {
      // Só arquivos soltos no total: mantém o cadastro normal de documento.
      const todos = flattenFiles(arvores[0]);
      if (todos.length === 1) {
        setEditing(null);
        setForm({ ...EMPTY_FORM, nome: arvores[0].nome.slice(0, 255) });
        setSelectedFile(null);
        setRemoveFile(false);
        setDragActive(false);
        setPendingFiles(todos);
        setUploadProgress(null);
        setFolderOrigin(null);
        setModalOpen(true);
        return;
      }
    }
    setFolderQueue(arvores);
    setFolderTipo('');
    setFolderEmpresa('');
    setFolderProgress(null);
    setFolderModalOpen(true);
  };

  /**
   * Cadastra a arvore arrastada recriando a HIERARQUIA: cada pasta vira uma pasta
   * real (com as subpastas dentro) e um documento com os arquivos que estavam
   * diretamente nela. Financeiro > 2025 > Jan > arquivo.xlsx vira
   * Documentos > Financeiro > 2025 > Jan > documento(arquivo.xlsx).
   */
  const handleSaveFolderBatch = async () => {
    const tipo = folderTipo.trim();
    const empresa = folderEmpresa.trim();
    if (!tipo) {
      return toast({ title: 'Tipo obrigatorio', description: 'Informe o tipo dos documentos.', variant: 'destructive' });
    }
    const raizes = folderQueue.filter((n) => isPasta(n) && flattenFiles(n).length > 0);
    if (!raizes.length) {
      return toast({ title: 'Nada para cadastrar', description: 'As pastas soltas nao contem arquivos.', variant: 'destructive' });
    }
    const totalDocs = raizes.reduce((s, n) => s + countDocsNaArvore(n), 0);
    if (!totalDocs) {
      return toast({ title: 'Nada para cadastrar', description: 'Nenhuma pasta contem arquivos.', variant: 'destructive' });
    }
    setFolderSaving(true);
    setFolderProgress({ done: 0, total: totalDocs });
    const pastaBase = currentFolder === 'root' ? null : currentFolder;
    const criados: string[] = [];
    let pastasCriadas = 0;
    let arquivosComFalha = 0;
    let done = 0;

    /** Cadastra 1 documento a partir dos arquivos diretos de uma pasta da arvore. */
    const cadastrarDoc = async (pastaNome: string, arquivos: File[], folderId: string | null) => {
      // 1 arquivo: vai como arquivo principal do documento.
      const unico = arquivos.length === 1 ? arquivos[0] : null;
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
        nome: pastaNome.slice(0, 255),
        tipo,
        numeracao: numeracaoAleatoria(),
        empresaEmissora: empresa || null,
        folderId,
        arquivoUrl,
        arquivoNome,
        arquivoTamanho,
        arquivoTipo,
      });
      criados.push(created.id);
      // 2+ arquivos: ficam na sub-pasta do documento.
      if (!unico) {
        for (const f of arquivos) {
          try {
            await erpService.uploadDocumentFile(created.id, f);
          } catch {
            arquivosComFalha += 1;
          }
        }
      }
    };

    /**
     * Percorre a subarvore criando as pastas reais na ordem (pai antes dos filhos)
     * e cadastrando os documentos de cada pasta que tenha arquivos diretos.
     */
    const percorrer = async (node: DroppedNode, parentId: string | null): Promise<void> => {
      const subpastas = node.filhos.filter(isPasta);
      const arquivosDiretos = node.filhos
        .filter((f) => !isPasta(f))
        .map((f) => f.arquivo)
        .filter((f): f is File => !!f);
      // A pasta raiz arrastada entra DENTRO da pasta aberta na aba.
      let folderId = parentId;
      try {
        const folder = await erpService.createFolder({ nome: node.nome.slice(0, 255), parentId });
        folderId = folder.id;
        pastasCriadas += 1;
      } catch (err: any) {
        toast({
          title: 'Falha ao criar a pasta "' + node.nome + '"',
          description: err?.message || 'Pasta ignorada.',
          variant: 'destructive',
        });
        return;
      }
      if (arquivosDiretos.length) {
        try {
          await cadastrarDoc(node.nome, arquivosDiretos, folderId);
        } catch (err: any) {
          toast({
            title: 'Falha ao cadastrar "' + node.nome + '"',
            description: err?.message || 'Documento ignorado.',
            variant: 'destructive',
          });
        }
        done += 1;
        setFolderProgress({ done, total: totalDocs });
      }
      for (const sub of subpastas) await percorrer(sub, folderId);
    };

    for (const raiz of raizes) {
      try {
        await percorrer(raiz, pastaBase);
      } catch (err: any) {
        toast({
          title: 'Falha ao importar "' + raiz.nome + '"',
          description: err?.message || 'Pasta ignorada.',
          variant: 'destructive',
        });
      }
    }

    setFolderSaving(false);
    setFolderProgress(null);
    setFolderModalOpen(false);
    setFolderQueue([]);
    toast({
      title: criados.length === 1 ? 'Documento cadastrado' : criados.length + ' documentos cadastrados',
      description: (pastasCriadas > 0 ? pastasCriadas + ' pasta(s) criadas na hierarquia. ' : '')
        + (arquivosComFalha > 0
          ? arquivosComFalha + ' arquivo(s) nao foram enviados - reenvie pela sub-pasta.'
          : 'Cada pasta virou um documento com seus arquivos.'),
    });
    await load();
    refreshMeta();
    await loadFolders();
    if (criados.length) {
      setExpandedIds((prev) => { const n = new Set(prev); criados.forEach((id) => n.add(id)); return n; });
      await Promise.all(criados.map((id) => loadDocFiles(id)));
    }
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬ Drag & drop de arquivo para dentro do modal Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
    // SÃ³ desativa quando o ponteiro realmente sai da dropzone (nÃ£o ao passar
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
    // Pasta solta dentro do modal: lÃª recursivamente os arquivos de dentro dela.
    if (dragHasFolder(dt) === true) {
      const { folders, looseFiles } = await readDroppedEntries(dt);
      const todos = [...folders.flatMap(flattenFiles), ...looseFiles];
      if (!todos.length) return;
      // Uma ÃƒÂºnica pasta e nome ainda vazio Ã¢â€ â€™ nome do documento vem da pasta.
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ Sub-pasta Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
  // algum arquivo casando com o termo Ã¢â‚¬â€ assim o arquivo encontrado fica visÃƒÂ­vel
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

  // Recarrega a listagem (o backend pode normalizar a sub-pasta apÃ³s cada
  // alteraÃ§Ã£o de arquivo: 1 arquivo vira vinculado simples, 2+ viram sub-pasta).
  const refreshDoc = async (docId: string) => {
    try {
      const files = await erpService.listDocumentFiles(docId);
      setFilesStore((s) => ({ ...s, [docId]: files }));
    } catch { /* silencioso: a listagem geral jÃ¡ Ã© recarregada abaixo */ }
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
      description: `"${f.arquivoNome}" serÃ¡ removido da sub-pasta de "${doc.nome}".`,
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

  // Busca + filtro de tipo Ã¢â‚¬â€ prÃƒÂ³prios de cada sub-pasta (filtrados no cliente).
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
    if (!nome) return toast({ title: 'Nome obrigatÃ³rio', description: 'Informe o nome do documento.', variant: 'destructive' });
    setSaving(true);
    try {
      let arquivoUrl: string | null = !removeFile ? (editing?.arquivoUrl || null) : null;
      let arquivoNome: string | null = !removeFile ? (editing?.arquivoNome || null) : null;
      let arquivoTamanho: number | null = !removeFile ? (editing?.arquivoTamanho ?? null) : null;
      let arquivoTipo: string | null = !removeFile ? (editing?.arquivoTipo || null) : null;

      // Regra de negÃ³cio:
      //  - Com exatamente 1 arquivo (criaÃƒÂ§ÃƒÂ£o OU ediÃƒÂ§ÃƒÂ£o) Ã¢â€ â€™ ele vira/substitui o
      //    arquivo vinculado do documento (fluxo simples, sem sub-pasta).
      //  - Com 2+ arquivos Ã¢â€ â€™ o primeiro vira o arquivo vinculado principal
      //    e o restante vai para a sub-pasta.
      //  - selectedFile (botÃ£o "Substituir arquivo") tambÃ©m troca o principal.
      const singleFile = pendingFiles.length === 1 ? pendingFiles[0] : null;
      const firstPending = pendingFiles.length > 0 ? pendingFiles[0] : null;

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
      } else if (firstPending) {
        // 2+ arquivos, sem seleÃƒÂ§ÃƒÂ£o Ã¢â€ â€™ primeiro vira o principal
        const up = await uploadDocumentFile(firstPending);
        arquivoUrl = up.url;
        arquivoNome = firstPending.name;
        arquivoTamanho = up.size;
        arquivoTipo = firstPending.type || null;
      }

      const payload = {
        nome,
        tipo: form.tipo.trim() || null,
        numeracao: form.numeracao.trim() || null,
        empresaEmissora: form.empresaEmissora.trim() || null,
        observacoes: form.observacoes.trim() || null,
        // Na criaÃ§Ã£o, o documento nasce na pasta aberta no explorer.
        // Na ediÃƒÂ§ÃƒÂ£o, folderId nÃƒÂ£o ÃƒÂ© enviado Ã¢â‚¬â€ a posiÃƒÂ§ÃƒÂ£o atual ÃƒÂ© preservada
        // (mover Ã© feito por arrastar/menu "Mover paraâ€¦").
        ...(editing ? {} : { folderId: currentFolder === 'root' ? null : currentFolder }),
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
      //    Com 1 arquivo, ele jÃ¡ virou o arquivo vinculado principal.
      //    Com 2+ e sem selectedFile, o primeiro jÃ¡ foi usado como principal
      //    (firstPending), entÃ£o Remove da sub-pasta para evitar duplicaÃ§Ã£o.
      const subFiles =
        singleFile
          ? []
          : selectedFile && firstPending
            ? pendingFiles.filter((f) => f !== firstPending)
            : pendingFiles;
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
            ? `${nome}${editing ? ' atualizado' : ''} Â· arquivo "${singleFile.name}" vinculado.`
            : `${nome} foi salvo com sucesso.`,
      });
      setModalOpen(false);
      setPendingFiles([]);
      setUploadProgress(null);
      setFolderOrigin(null);
      await load();
      refreshMeta();

      // Abre a sub-pasta do documento recÃ©m-criado para mostrar os arquivos enviados.
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
    loadFolders();
  };

  const handleDelete = async (d: ErpDocument) => {
    const ok = await confirmDialog({
      title: 'Excluir documento?',
      description: `"${d.nome}" serÃ¡ removido permanentemente${d.arquivoNome ? ` junto com o arquivo "${d.arquivoNome}"` : ''}.`,
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    try {
      await erpService.deleteDocument(d.id);
      toast({ title: 'Documento excluÃ­do' });
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

  /**
   * Abre o editor do arquivo.
   * - `file` presente = arquivo dentro da sub-pasta (o editor abre sÃ³ ele);
   * - ausente = o arquivo principal do documento.
   */
  const handleEditFile = (d: ErpDocument, file?: ErpDocumentFile) => {
    const nome = file?.arquivoNome || d.arquivoNome;
    const ext = fileExtension(nome);
    const route = SPREADSHEET_EXTS.includes(ext) ? 'editar' : 'office';
    navigate(`/erp/documentos/${d.id}/${route}${file ? `?fileId=${encodeURIComponent(file.id)}` : ''}`);
  };

  /** Arquivo da sub-pasta editÃ¡vel no sistema (Excel/Word/PowerPoint). */
  const subFileEditable = (f: ErpDocumentFile) =>
    !!f.arquivoUrl
    && (SPREADSHEET_EXTS.includes(fileExtension(f.arquivoNome))
      || OFFICE_DOC_EXTS.includes(fileExtension(f.arquivoNome)));

  // Ã¢â€â‚¬Ã¢â€â‚¬ Explorer: navegaÃƒÂ§ÃƒÂ£o, ordenaÃƒÂ§ÃƒÂ£o, seleÃƒÂ§ÃƒÂ£o, menu de contexto, mover Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  const selectFolder = (id: string, opts?: { fromHistory?: boolean }) => {
    setCurrentFolder(id);
    setSelectedIds(new Set());
    setExpandedIds(new Set());
    setCtxMenu(null);
    if (!opts?.fromHistory) {
      // Corta o "avanÃ§ar" e anexa o novo destino ao histÃ³rico.
      setNavHistory((h) => [...h.slice(0, navIdx + 1), id]);
      setNavIdx((i) => i + 1);
    }
  };

  const canBack = navIdx > 0;
  const canForward = navIdx < navHistory.length - 1;
  const goBack = () => {
    if (!canBack) return;
    const i = navIdx - 1;
    setNavIdx(i);
    selectFolder(navHistory[i], { fromHistory: true });
  };
  const goForward = () => {
    if (!canForward) return;
    const i = navIdx + 1;
    setNavIdx(i);
    selectFolder(navHistory[i], { fromHistory: true });
  };
  /** Sobe um nÃƒÂ­vel (botÃƒÂ£o Ã¢â€ â€˜ / Backspace). */
  const goUp = () => {
    if (currentFolder === 'root') return;
    const parent = folderPath.length
      ? (folderPath[folderPath.length - 1].parentId || 'root')
      : 'root';
    selectFolder(parent);
  };

  /** Caminho da pasta atual (para o breadcrumb). */
  const folderPath = useMemo(() => {
    if (currentFolder === 'root') return [] as ErpFolder[];
    const byId = new Map(folders.map((f) => [f.id, f]));
    const path: ErpFolder[] = [];
    let cursor: string | null = currentFolder;
    for (let g = 0; cursor && g < 60; g += 1) {
      const f = byId.get(cursor);
      if (!f) break;
      path.unshift(f);
      cursor = f.parentId || null;
    }
    return path;
  }, [currentFolder, folders]);

  /** Pastas achatadas com profundidade (para o dialog "Mover paraâ€¦"). */
  const flatFolders = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const depthOf = (f: ErpFolder) => {
      let d = 0;
      let c: string | null = f.parentId || null;
      while (c && d < 60) { d += 1; c = byId.get(c)?.parentId || null; }
      return d;
    };
    return [...folders]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((f) => ({ f, depth: depthOf(f) }));
  }, [folders]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'nome' || key === 'tipo' || key === 'empresa' ? 'asc' : 'desc');
    }
  };

  /** Pastas filhas da pasta aberta (ou casando com a busca), ordenadas. */
  const contentFolders = useMemo(() => {
    const term = qDebounced.trim().toLowerCase();
    const parentId = currentFolder === 'root' ? null : currentFolder;
    const list = term
      ? folders.filter((f) => f.nome.toLowerCase().includes(term))
      : folders.filter((f) => (f.parentId || null) === parentId);
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') * mul);
  }, [folders, currentFolder, qDebounced, sortDir]);

  /** Entradas do conteÃºdo: pastas primeiro, depois os documentos (estilo Explorer). */
  const entries = useMemo<ExplorerEntry[]>(() => [
    ...contentFolders.map((f) => ({ kind: 'folder' as const, id: f.id, folder: f })),
    ...items.map((d) => ({ kind: 'doc' as const, id: d.id, doc: d })),
  ], [contentFolders, items]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Pastas: criar / renomear / excluir (dialog ÃƒÂºnico da pÃƒÂ¡gina) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  /** Mensagem de erro de uma rejeiÃ§Ã£o desconhecida (sem `any`). */
  const errMsg = (e: unknown) =>
    (e instanceof Error ? e.message : typeof e === 'string' ? e : 'Tente novamente.');

  const submitFolderName = async () => {
    if (!folderNameDlg) return;
    const nome = folderNameDlg.nome.trim();
    if (!nome) return;
    setFolderNameSaving(true);
    try {
      if (folderNameDlg.mode === 'create') {
        await erpService.createFolder({ nome, parentId: folderNameDlg.parentId ?? null });
        toast({ title: 'Pasta criada', description: `"${nome}" estÃ¡ pronta para uso.` });
      } else if (folderNameDlg.folderId) {
        await erpService.updateFolder(folderNameDlg.folderId, { nome });
        toast({ title: 'Pasta renomeada' });
      }
      setFolderNameDlg(null);
      await loadFolders();
    } catch (e) {
      toast({ title: 'Erro na pasta', description: errMsg(e) || 'Tente um nome diferente.', variant: 'destructive' });
    } finally {
      setFolderNameSaving(false);
    }
  };

  const newFolder = (parentId: string | null) =>
    setFolderNameDlg({ mode: 'create', parentId, nome: '' });
  const renameFolder = (f: ErpFolder) =>
    setFolderNameDlg({ mode: 'rename', folderId: f.id, nome: f.nome });

  const deleteFolder = async (f: ErpFolder) => {
    const ok = await confirmDialog({
      title: `Excluir a pasta "${f.nome}"?`,
      description: 'Nada Ã© perdido: documentos e subpastas passam para a pasta anterior (ou para a raiz).',
      confirmLabel: 'Excluir pasta',
      destructive: true,
    });
    if (!ok) return;
    try {
      const r = await erpService.deleteFolder(f.id);
      toast({
        title: 'Pasta excluÃ­da',
        description: `${r.documentosMovidos} documento(s) e ${r.subpastasMovidas} subpasta(s) movidos para a pasta anterior.`,
      });
      if (currentFolder === f.id) selectFolder('root');
      setCtxMenu(null);
      await loadFolders();
      await load();
    } catch (e) {
      toast({ title: 'Erro ao excluir', description: errMsg(e), variant: 'destructive' });
    }
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬ Drag & drop de documentos sobre pastas do conteÃƒÂºdo Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const dragHasDocs = (dt: DataTransfer | null) =>
    !!dt && Array.from(dt.types || []).includes(DOC_DRAG_MIME);

  const contentDragOver = (entry: ExplorerEntry) => (e: React.DragEvent) => {
    if (entry.kind !== 'folder' || !dragHasDocs(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setContentDropId((prev) => (prev === entry.id ? prev : entry.id));
  };
  const contentDragLeave = (entry: ExplorerEntry) => (e: React.DragEvent) => {
    e.stopPropagation();
    setContentDropId((prev) => (prev === entry.id ? null : prev));
  };
  const contentDrop = (entry: ExplorerEntry) => (e: React.DragEvent) => {
    if (entry.kind !== 'folder' || !dragHasDocs(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    setContentDropId(null);
    try {
      const ids: string[] = JSON.parse(e.dataTransfer.getData(DOC_DRAG_MIME));
      if (Array.isArray(ids) && ids.length) moveDocs(ids, entry.id);
    } catch { /* arraste nÃ£o nosso */ }
  };

  const sortIcon = (key: string) =>
    sortKey !== key ? null
      : sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline ml-1" />
        : <ChevronDown className="h-3 w-3 inline ml-1" />;

  /** Clique com Shift = intervalo (lista mista pasta+doc); Ctrl/Meta = alterna; simples = substitui.
   *  Em pastas e sub-pastas, o clique simples NAVEGA/EXPANDE (como o Explorer);
   *  com Ctrl/Shift apenas seleciona. */
  const handleEntryClick = (entry: ExplorerEntry, e: React.MouseEvent, index: number) => {
    if (ctxMenu) setCtxMenu(null);

    const plain = !e.ctrlKey && !e.metaKey && !e.shiftKey;

    // Pasta: clique simples entra. Modificadores continuam sendo para seleÃ§Ã£o.
    if (entry.kind === 'folder' && plain) {
      selectFolder(entry.folder.id);
      return;
    }

    // Sub-pasta (documento com 2+ arquivos): clique simples abre os arquivos
    // dentro dela, em vez de exigir duplo clique / abrir modal.
    if (plain && entry.kind === 'doc' && (entry.doc.arquivosCount || 0) > 1) {
      setSelectedIds(new Set([entry.id]));
      toggleExpand(entry.doc);
      return;
    }

    if (e.shiftKey) {
      const anchor = entries.findIndex((x) => selectedIds.has(x.id));
      const [from, to] = anchor >= 0 ? [Math.min(anchor, index), Math.max(anchor, index)] : [index, index];
      const range = entries.slice(from, to + 1).map((x) => x.id);
      setSelectedIds((prev) => {
        const n = new Set(anchor >= 0 ? prev : []);
        range.forEach((id) => n.add(id));
        return n;
      });
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const n = new Set(prev);
        if (n.has(entry.id)) n.delete(entry.id);
        else n.add(entry.id);
        return n;
      });
      return;
    }
    setSelectedIds(new Set([entry.id]));
  };

  /** BotÃ£o direito: seleciona o alvo (se ainda nÃ£o estiver) e abre o menu. */
  const openContextMenu = (e: React.MouseEvent, target: CtxTarget) => {
    e.preventDefault();
    e.stopPropagation();
    if (target.kind === 'docs') setSelectedIds(new Set(target.ids));
    else if (target.kind === 'folder') {
      setSelectedIds((prev) => (prev.has(target.folder.id) ? prev : new Set([target.folder.id])));
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, target });
  };

  /** Abre uma entrada: sub-pasta expande os arquivos Â· planilha/office vai pro editor Â·
   *  o resto abre a prÃ©-visualizaÃ§Ã£o (ou o modal de ediÃ§Ã£o se nÃ£o tem arquivo). */
  const handleOpen = (d: ErpDocument) => {
    const ext = fileExtension(d.arquivoNome);
    if ((d.arquivosCount || 0) > 1) {
      // Sub-pasta: expande os arquivos internos. Na grade de Ã­cones nÃ£o hÃ¡
      // tabela, entÃ£o abrimos o preview jÃ¡ filtrado pelos arquivos.
      toggleExpand(d);
      return;
    }
    if (d.arquivoUrl && (SPREADSHEET_EXTS.includes(ext) || OFFICE_DOC_EXTS.includes(ext))) {
      handleEditFile(d);
      return;
    }
    if (d.arquivoUrl) setPreviewDoc(d);
    else openEdit(d);
  };

  /** Move documentos (ids) para a pasta destino (null = raiz). */
  const moveDocs = async (ids: string[], folderId: string | null) => {
    if (!ids.length) return;
    setMoveSaving(true);
    try {
      await Promise.all(ids.map((id) => erpService.updateDocument(id, { folderId })));
      toast({
        title: ids.length === 1 ? 'Documento movido' : `${ids.length} documentos movidos`,
        description: folderId
          ? `Para "${folders.find((f) => f.id === folderId)?.nome || 'a pasta'}".`
          : 'Para a raiz (Documentos).',
      });
      setMoveDlgIds(null);
      setSelectedIds(new Set());
      setCtxMenu(null);
      await load();
      loadFolders();
    } catch (e) {
      toast({ title: 'Erro ao mover', description: errMsg(e), variant: 'destructive' });
    } finally {
      setMoveSaving(false);
    }
  };

  /** Exclui vÃ¡rios documentos em lote (mesma confirmaÃ§Ã£o do individual). */
  const handleDeleteMany = async (ids: string[]) => {
    if (!ids.length) return;
    const ok = await confirmDialog({
      title: ids.length === 1 ? 'Excluir documento?' : `Excluir ${ids.length} documentos?`,
      description: ids.length === 1
        ? 'Este documento serÃ¡ removido permanentemente, junto com seus arquivos.'
        : 'Os documentos selecionados serÃ£o removidos permanentemente, junto com seus arquivos.',
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    let falhas = 0;
    for (const id of ids) {
      try { await erpService.deleteDocument(id); } catch { falhas += 1; }
    }
    setSelectedIds(new Set());
    setCtxMenu(null);
    toast({
      title: falhas ? 'ExclusÃ£o parcial' : 'Documentos excluÃ­dos',
      description: falhas ? `${falhas} falha(s) Ã¢â‚¬â€ tente novamente.` : undefined,
      variant: falhas ? 'destructive' : undefined,
    });
    await load();
    refreshMeta();
    loadFolders();
  };

  /** Arraste de documentos: leva TODOS os selecionados (ou sÃ³ o clicado). */
  const handleDocDragStart = (e: React.DragEvent, d: ErpDocument) => {
    const ids = selectedIds.has(d.id) ? Array.from(selectedIds) : [d.id];
    if (!selectedIds.has(d.id)) setSelectedIds(new Set(ids));
    e.dataTransfer.setData(DOC_DRAG_MIME, JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬ AÃƒÂ§ÃƒÂµes compartilhadas por toolbar, menu de contexto e teclado Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  /** Recarrega documentos + contadores + Ã¡rvore de pastas. */
  const refreshAll = () => {
    load();
    refreshMeta();
    loadFolders();
  };

  /** Documentos da seleÃ§Ã£o atual (a toolbar sÃ³ move/exclui documentos). */
  const docIdsOfSelection = () => items.filter((d) => selectedIds.has(d.id)).map((d) => d.id);

  /** Exclui a seleÃ§Ã£o: pastas uma a uma (com confirmaÃ§Ã£o) + documentos em lote. */
  const deleteSelection = async () => {
    const selFolders = folders.filter((f) => selectedIds.has(f.id));
    const selDocs = items.filter((d) => selectedIds.has(d.id));
    for (const f of selFolders) await deleteFolder(f);
    if (selDocs.length) await handleDeleteMany(selDocs.map((d) => d.id));
    setSelectedIds(new Set());
  };


  /** SÃ³ documentos sÃ£o arrastÃ¡veis; a pasta Ã© destino, nÃ£o origem. */
  const handleEntryDragStart = (e: React.DragEvent, entry: ExplorerEntry) => {
    if (entry.kind !== 'doc') {
      e.preventDefault();
      return;
    }
    handleDocDragStart(e, entry.doc);
  };

  /** BotÃƒÂ£o direito numa entrada Ã¢â‚¬â€ mantÃƒÂ©m o grupo selecionado quando hÃƒÂ¡ vÃƒÂ¡rios. */
  const handleItemContextMenu = (e: React.MouseEvent, entry: ExplorerEntry) => {
    if (entry.kind === 'folder') {
      openContextMenu(e, { kind: 'folder', folder: entry.folder });
      return;
    }
    const group = selectedIds.has(entry.id)
      ? items.filter((d) => selectedIds.has(d.id)).map((d) => d.id)
      : [];
    openContextMenu(e, { kind: 'docs', ids: group.length ? group : [entry.doc.id] });
  };


  /** CabeÃ§alho + itens do menu de contexto conforme o alvo. */
  const buildCtxMenu = (): { header: React.ReactNode; items: CtxMenuItem[] } | null => {
    if (!ctxMenu) return null;
    const t = ctxMenu.target;

    if (t.kind === 'folder') {
      const f = t.folder;
      return {
        header: (
          <>
            <p className="font-medium truncate" title={f.nome}>{f.nome}</p>
            <p className="text-xs text-muted-foreground">
              {f.documentosCount || 0} documento{(f.documentosCount || 0) === 1 ? '' : 's'}
              {f.subpastasCount ? ` Â· ${f.subpastasCount} subpasta(s)` : ''}
            </p>
          </>
        ),
        items: [
          { label: 'Abrir', icon: <FolderOpen className="h-4 w-4" />, onClick: () => selectFolder(f.id) },
          { label: 'Nova subpasta', icon: <FolderInput className="h-4 w-4" />, onClick: () => newFolder(f.id) },
          { separator: true, label: '-' },
          { label: 'Renomear', icon: <Pencil className="h-4 w-4" />, onClick: () => renameFolder(f) },
          { label: 'Excluir', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => deleteFolder(f) },
        ],
      };
    }

    if (t.kind === 'docs') {
      const docs = items.filter((d) => t.ids.includes(d.id));
      const first = docs[0];
      if (!first) return null;
      const many = t.ids.length > 1;
      const ext = fileExtension(first.arquivoNome);
      const canEdit = !!first.arquivoUrl && (SPREADSHEET_EXTS.includes(ext) || OFFICE_DOC_EXTS.includes(ext));
      return {
        header: (
          <>
            <p className="font-medium truncate" title={first.nome}>{first.nome}</p>
            <p className="text-xs text-muted-foreground">
              {many
                ? `${t.ids.length} documentos selecionados`
                : previewKindLabels[getPreviewKind(first.arquivoNome, first.arquivoTipo)]}
            </p>
          </>
        ),
        items: [
          { label: 'Abrir', icon: <Eye className="h-4 w-4" />, onClick: () => handleOpen(first) },
          ...(canEdit ? [{
            label: SPREADSHEET_EXTS.includes(ext) ? 'Editar planilha' : 'Editar documento',
            icon: <FileEdit className="h-4 w-4 text-emerald-600" />,
            onClick: () => handleEditFile(first),
          }] : []),
          {
            label: 'Baixar',
            icon: <Download className="h-4 w-4" />,
            disabled: !first.arquivoUrl,
            onClick: () => handleDownload(first),
          },
          { separator: true, label: '-' },
          { label: 'Renomear / editar', icon: <Pencil className="h-4 w-4" />, onClick: () => openEdit(first) },
          {
            label: many ? `Mover ${t.ids.length} documentos paraâ€¦` : 'Mover paraâ€¦',
            icon: <FolderInput className="h-4 w-4 text-indigo-500" />,
            onClick: () => setMoveDlgIds(t.ids),
          },
          { separator: true, label: '-' },
          {
            label: many ? `Excluir ${t.ids.length} documentos` : 'Excluir',
            icon: <Trash2 className="h-4 w-4" />,
            danger: true,
            onClick: () => handleDeleteMany(t.ids),
          },
        ],
      };
    }

    // Ãrea vazia (conteÃºdo) ou raiz da Ã¡rvore: aÃ§Ãµes de pasta.
    const parentId = currentFolder === 'root' ? null : currentFolder;
    return {
      header: (
        <p className="font-medium truncate">
          {t.kind === 'treeRoot' ? 'Documentos' : folderPath[folderPath.length - 1]?.nome || 'Documentos'}
        </p>
      ),
      items: [
        { label: 'Novo documento', icon: <Plus className="h-4 w-4" />, onClick: openNew },
        { label: 'Nova pasta', icon: <FolderInput className="h-4 w-4" />, onClick: () => newFolder(parentId) },
        { separator: true, label: '-' },
        { label: 'Atualizar', icon: <RefreshCw className="h-4 w-4" />, onClick: refreshAll },
        { label: 'Selecionar tudo', icon: <List className="h-4 w-4" />, onClick: () => setSelectedIds(new Set(entries.map((x) => x.id))) },
      ],
    };
  };

  /** Nomes de arquivos da sub-pasta que casaram com a busca geral. */
  const searchMatched = (d: ErpDocument) => {
    const term = qDebounced.trim().toLowerCase();
    if (!term || (d.arquivosCount || 0) <= 1) return [];
    return (d.arquivosNomes || []).filter((n) => (n || '').toLowerCase().includes(term));
  };

  /** BotÃµes de aÃ§Ã£o da linha de um documento (reaproveitados pela view Detalhes). */
  const renderDocActions = (d: ErpDocument) => {
    const ext = fileExtension(d.arquivoNome);
    const canEditFile = !!d.arquivoUrl && (SPREADSHEET_EXTS.includes(ext) || OFFICE_DOC_EXTS.includes(ext));
    const isSub = (d.arquivosCount || 0) > 1;
    return (
      <>
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
      </>
    );
  };

  // Atalhos: Del = excluir Â· F2 = renomear Â· F5 = atualizar Â· Backspace = subir Â·
  // Ctrl+A = tudo Â· Esc = limpar seleÃ§Ã£o/menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const typing = !!tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable);
      if (typing || modalOpen || folderModalOpen || folderNameDlg || previewDoc || moveDlgIds) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(entries.map((x) => x.id)));
      } else if (e.key === 'Escape') {
        if (ctxMenu) setCtxMenu(null);
        else setSelectedIds(new Set());
      } else if (e.key === 'Delete' && selectedIds.size) {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === 'F2') {
        const f = folders.find((x) => selectedIds.has(x.id));
        if (f) { e.preventDefault(); renameFolder(f); }
      } else if (e.key === 'F5') {
        e.preventDefault();
        refreshAll();
      } else if (e.key === 'Backspace' && !selectedIds.size) {
        e.preventDefault();
        goUp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, entries, folders, ctxMenu, modalOpen, folderModalOpen, folderNameDlg, previewDoc, moveDlgIds]);

  /** Linha extra da sub-pasta (2+ arquivos) - mantida na pagina por usar o estado de arquivos. */
  const renderSubRow = (d: ErpDocument) => {
    const subFiles = visibleSubFiles(d.id);
    return (
    <tr key={`${d.id}-sub`} className="border-t border-slate-100 bg-indigo-50/20">
                        <td colSpan={8} className="px-3 py-3">
                          <div className="rounded-xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
                            {/* CabeÃ§alho da sub-pasta */}
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
                                {subUploading[d.id] ? 'Enviandoâ€¦' : 'Adicionar'}
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
                                <Loader2 className="h-5 w-5 mx-auto animate-spin" /> Carregando arquivosâ€¦
                              </div>
                            ) : subFiles.length === 0 ? (
                              <div className="p-6 text-center text-muted-foreground text-sm">
                                {(filesStore[d.id] || []).length === 0
                                  ? 'Ainda nÃƒÂ£o hÃƒÂ¡ arquivos nesta sub-pasta Ã¢â‚¬â€ use Ã¢â‚¬Å“AdicionarÃ¢â‚¬Â ou arraste um aqui embaixo.'
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
                                          {previewKindLabels[fKind]} Â· {formatFileSize(f.arquivoTamanho)} Â· {fmtDate(f.createdAt)}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir em nova aba"
                                          disabled={!fAbs}
                                          onClick={() => fAbs && window.open(fAbs, '_blank', 'noopener,noreferrer')}>
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>
                                        {subFileEditable(f) && (
                                          <Button
                                            variant="ghost" size="icon" className="h-8 w-8"
                                            title={SPREADSHEET_EXTS.includes(fileExtension(f.arquivoNome)) ? 'Editar planilha' : 'Editar documento'}
                                            onClick={() => handleEditFile(d, f)}
                                          >
                                            <FileEdit className="h-4 w-4 text-emerald-600" />
                                          </Button>
                                        )}
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

                            {/* Zona de arraste (rodapÃ©) */}
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
                                {subDragActive[d.id] ? 'Solte aqui para adicionar Ã  sub-pasta' : 'Arraste e solte arquivos aqui para adicionar Ã  sub-pasta'}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
    );
  };

  return (
    <div
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 relative"
      onDragEnter={handlePageDragEnter}
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {/* ÃƒÂrea de soltar pasta(s) Ã¢â‚¬â€ aparece ao arrastar uma pasta para a aba */}
      {pageDrag && (
        <div className="fixed inset-0 z-40 bg-indigo-600/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none p-4">
          <div className="rounded-2xl border-2 border-dashed border-indigo-400 bg-white/95 px-6 py-5 shadow-xl text-center max-w-md">
            <FolderArchive className="h-9 w-9 mx-auto text-indigo-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800">Solte a(s) pasta(s) para cadastrar</p>
            <p className="text-xs text-slate-500 mt-1">
              <strong>1 pasta</strong> Ã¢â€ â€™ o nome do documento jÃƒÂ¡ vem preenchido com o nome dela.{' '}
              <strong>2+ pastas</strong> Ã¢â€ â€™ informe sÃƒÂ³ o tipo: cada pasta vira um documento.
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
            Arquive e organize documentos de qualquer tipo Ã¢â‚¬â€ com prÃƒÂ©-visualizaÃƒÂ§ÃƒÂ£o e download.
            Arraste uma <strong>pasta</strong> aqui para cadastrar automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="erp-doc-files-input"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              if (files.length) openFolderBatch(files.map((file) => ({ nome: file.name, arquivo: file, filhos: [] })));
            }}
          />
          <Button variant="outline" onClick={() => document.getElementById('erp-doc-files-input')?.click()}>
            <UploadCloud className="h-4 w-4" /> Importar arquivos
          </Button>
          {/* Importar pasta(s): mesma regra do arraste, via seletor do sistema. */}
          <input
            id="erp-doc-folder-input"
            type="file"
            multiple
            className="hidden"
            ref={(el) => {
              // webkitdirectory nÃƒÂ£o existe nos tipos do JSX Ã¢â‚¬â€ sÃƒÂ³ via atributo.
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

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4 items-start">
        {/* Sidebar: Ã¡rvore de pastas */}
        <FolderTree
          folders={folders}
          current={currentFolder}
          onSelect={selectFolder}
          onChanged={loadFolders}
          onMoveDocs={(folderId, ids) => moveDocs(ids, folderId)}
        />

        <div className="space-y-4 min-w-0">
          {/* Barra de endereÃ§o (voltar/avanÃ§ar/subir + caminho + busca) */}
          <ExplorerAddressBar
            path={folderPath}
            canBack={canBack}
            canForward={canForward}
            canUp={currentFolder !== 'root'}
            onBack={goBack}
            onForward={goForward}
            onUp={goUp}
            onNavigate={selectFolder}
            search={q}
            onSearchChange={setQ}
            loading={loading}
          />

          {/* Command bar */}
          <ExplorerToolbar
            onNewDoc={openNew}
            onNewFolder={() => newFolder(currentFolder === 'root' ? null : currentFolder)}
            onImportFiles={() => document.getElementById('erp-doc-files-input')?.click()}
            onImportFolder={() => document.getElementById('erp-doc-folder-input')?.click()}
            onRefresh={refreshAll}
            selectedCount={selectedIds.size}
            onMoveSelected={() => setMoveDlgIds(docIdsOfSelection())}
            onDeleteSelected={() => deleteSelection()}
            sortKey={sortKey as SortKey}
            sortDir={sortDir}
            onSort={(k, d) => { setSortKey(k); setSortDir(d); }}
            loading={loading}
          />

      {/* Busca + filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_240px_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, numeraÃ§Ã£o, empresa, tipo ou arquivo (inclusive dentro de sub-pastas)â€¦"
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
          {hasFilters && <span>Filtros ativos Ã¢â‚¬â€ clique em Ã¢â‚¬Å“LimparÃ¢â‚¬Â para ver tudo.</span>}
        </p>
      </Card>

      {/* Lista */}
      <Card
        className="p-0 overflow-hidden"
        onContextMenu={(e) => {
          // SÃ³ abre o menu de "Ã¡rea vazia" fora de uma entrada/item.
          if ((e.target as HTMLElement).closest('[data-exp-row]')) return;
          openContextMenu(e, { kind: 'empty' });
        }}
      >
        {viewMode === 'grid' ? (
          <ExplorerIcons
            entries={entries}
            selectedIds={selectedIds}
            loading={loading}
            hasFilters={hasFilters}
            onItemClick={handleEntryClick}
            onItemContextMenu={handleItemContextMenu}
            onItemDragStart={handleEntryDragStart}
            dropId={contentDropId}
            onItemDragOver={contentDragOver}
            onItemDragLeave={contentDragLeave}
            onItemDrop={contentDrop}
            onFolderNewSub={(f) => newFolder(f.id)}
            onFolderRename={renameFolder}
            onFolderDelete={deleteFolder}
            iconSize={iconSize}
          />
        ) : (
          <ExplorerDetails
            entries={entries}
            selectedIds={selectedIds}
            loading={loading}
            hasFilters={hasFilters}
            onItemClick={handleEntryClick}
            onItemContextMenu={handleItemContextMenu}
            onItemDragStart={handleEntryDragStart}
            dropId={contentDropId}
            onItemDragOver={contentDragOver}
            onItemDragLeave={contentDragLeave}
            onItemDrop={contentDrop}
            onFolderNewSub={(f) => newFolder(f.id)}
            onFolderRename={renameFolder}
            onFolderDelete={deleteFolder}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            renderSubRow={renderSubRow}
            renderDocActions={renderDocActions}
            searchMatched={searchMatched}
          />
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

          {/* Barra de status: contagem + alternar Grade/Detalhes */}
          <ExplorerStatusBar
            totalDocs={items.length}
            folderCount={contentFolders.length}
            selectedCount={selectedIds.size}
            viewMode={viewMode}
            onViewMode={changeView}
            iconSize={iconSize}
            onIconSize={changeIconSize}
          />
        </div>{/* fecha coluna de conteÃºdo */}
      </div>{/* fecha grid sidebar + conteÃºdo */}

      {/* Menu de contexto (Explorer) */}
      {ctxMenu && (() => {
        const m = buildCtxMenu();
        return m ? (
          <ExplorerContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            header={m.header}
            items={m.items}
            onClose={() => setCtxMenu(null)}
          />
        ) : null;
      })()}

      {/* Dialog criar/renomear pasta (toolbar, F2 e menu de contexto) */}
      <FolderNameDialog
        state={folderNameDlg}
        parentLabel={
          folderNameDlg?.mode === 'create'
            ? folders.find((f) => f.id === folderNameDlg.parentId)?.nome || 'Documentos'
            : undefined
        }
        saving={folderNameSaving}
        onChange={(nome) => setFolderNameDlg((s) => (s ? { ...s, nome } : s))}
        onSubmit={submitFolderName}
        onClose={() => setFolderNameDlg(null)}
      />

      {/* Dialog Mover paraâ€¦ */}
      <Dialog open={!!moveDlgIds} onOpenChange={(o) => { if (!o) setMoveDlgIds(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Mover {moveDlgIds && moveDlgIds.length > 1 ? `${moveDlgIds.length} documentos` : 'documento'} paraâ€¦
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto -mx-1 space-y-0.5 py-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-100"
              onClick={() => moveDlgIds && moveDocs(moveDlgIds, null)}
              disabled={moveSaving}
            >
              <FolderOpen className="h-4 w-4 text-indigo-600 flex-shrink-0" />
              <span className="font-medium">Documentos (raiz)</span>
            </button>
            {flatFolders.length === 0 && (
              <p className="px-2.5 py-3 text-xs text-muted-foreground leading-relaxed">
                Nenhuma pasta criada ainda. Use <b>Nova pasta</b> na sidebar para criar a primeira.
              </p>
            )}
            {flatFolders.map(({ f, depth }) => (
              <button
                key={f.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-40"
                style={{ paddingLeft: 10 + depth * 16 }}
                disabled={moveSaving}
                onClick={() => moveDlgIds && moveDocs(moveDlgIds, f.id)}
                title={f.nome}
              >
                <Folder className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                <span className="truncate">{f.nome}</span>
                {f.documentosCount != null && f.documentosCount > 0 && (
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums flex-shrink-0">{f.documentosCount}</span>
                )}
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setMoveDlgIds(null)} disabled={moveSaving}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar/Editar */}
      <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o && !saving) { setPendingFiles([]); setFolderOrigin(null); } }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar documento' : 'Novo documento'}
              {!editing && (
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  SerÃ¡ salvo em:{' '}
                  <b>
                    {folderPath.length
                      ? folderPath.map((f) => f.nome).join(' / ')
                      : 'Documentos (raiz)'}
                  </b>
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {folderOrigin && !editing && (
            <div className="flex items-start gap-2.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5">
              <FolderArchive className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 text-xs text-indigo-900">
                <p className="font-semibold">Pasta arrastada: {folderOrigin}</p>
                <p className="text-indigo-700/90 mt-0.5">
                  O nome do documento e os arquivos jÃƒÂ¡ foram preenchidos Ã¢â‚¬â€ confira o tipo e conclua o cadastro.
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
                  placeholder="Ex: Contrato de locaÃƒÂ§ÃƒÂ£o Ã¢â‚¬â€ Cliente X"
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
                <Label>NumeraÃ§Ã£o</Label>
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
                <Label>ObservaÃ§Ãµes</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={2}
                  placeholder="AnotaÃ§Ãµes opcionais sobre o documento"
                />
              </div>
            </div>
{/* Arquivo vinculado (principal Ã¢â‚¬â€ apenas ao editar) */}
            {editing && editing.arquivoNome && (
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="mb-0">Arquivo vinculado {`(atual)`}</Label>
                  {removeFile && <span className="text-xs text-amber-600">SerÃ¡ desvinculado ao salvar.</span>}
                </div>
                {!removeFile && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{editing.arquivoNome}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(editing.arquivoTamanho)} Â· vinculado</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" title="PrÃ©-visualizar" onClick={() => setPreviewDoc(editing!)}>
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
                        <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)} Â· substituirÃ¡ o atual</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)} title="Remover seleÃ§Ã£o">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Arquivos do documento: 1 arquivo = vinculado Â· 2+ = sub-pasta */}
            <div className="rounded-xl border p-4 space-y-3 bg-slate-50/60">
              <div className="flex items-center justify-between gap-2">
                <Label className="mb-0">Arquivos do documento</Label>
                {pendingFiles.length > 0 && (
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-0.5">
                    {pendingFiles.length === 1
                      ? '1 arquivo Â· vinculado'
                      : `${pendingFiles.length} arquivos Â· sub-pasta`}
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
                      ? 'Este arquivo substituirÃ¡ o arquivo vinculado atual'
                      : 'Este arquivo serÃ¡ vinculado ao documento'
                    : pendingFiles.length > 1
                      ? `${pendingFiles.length} arquivos formarÃ£o uma sub-pasta`
                      : 'ou clique para selecionar Â· 1 arquivo = vinculado Â· 2+ = sub-pasta'}
                </p>
              </div>

              {pendingFiles.length > 0 && (
                <div className="rounded-lg border bg-white overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
                    <p className="text-xs font-medium text-muted-foreground">
                      {pendingFiles.length === 1
                        ? editing
                          ? 'Arquivo que substituirÃ¡ o atual'
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
                  ? `Enviando ${uploadProgress.done}/${uploadProgress.total}â€¦`
                  : 'Salvandoâ€¦'
                : editing
                  ? 'Salvar alteraÃ§Ãµes'
                  : pendingFiles.length > 1
                    ? `Cadastrar documento Â· sub-pasta com ${pendingFiles.length} arquivos`
                    : pendingFiles.length === 1
                      ? 'Cadastrar documento com arquivo'
                      : 'Cadastrar documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cadastro em lote Ã¢â‚¬â€ 2+ pastas soltas na aba Documentos */}
      <Dialog
        open={folderModalOpen}
        onOpenChange={(o) => { if (!o && !folderSaving) { setFolderModalOpen(false); setFolderQueue([]); } }}
      >
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderArchive className="h-5 w-5 text-indigo-500" />
              Importar {countDocsDaFila(folderQueue)} documento{countDocsDaFila(folderQueue) === 1 ? '' : 's'} com hierarquia
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-1 pr-1">
            <p className="text-sm text-muted-foreground">
              A hierarquia sera recriada exatamente como no Windows: cada pasta arrastada
              vira uma <strong>pasta</strong> dentro da pasta aberta, com as subpastas
              dentro dela. Cada pasta que tem arquivos gera um <strong>documento</strong>{' '}
              com o nome da pasta e a <strong>numeração</strong> automática.
              O <strong>tipo</strong> e a <strong>empresa emissora</strong> serão os mesmos para todos.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo dos documentos *</Label>
                <Input
                  list="erp-doc-tipos-lote"
                  value={folderTipo}
                  onChange={(e) => setFolderTipo(e.target.value)}
                  placeholder="Ex: OrÃ§amento"
                  disabled={folderSaving}
                />
                <datalist id="erp-doc-tipos-lote">
                  {tipoOptions.map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label>Empresa emissora</Label>
                <Input
                  list="erp-doc-empresas-lote"
                  value={folderEmpresa}
                  onChange={(e) => setFolderEmpresa(e.target.value)}
                  placeholder="Digite ou selecione"
                  disabled={folderSaving}
                />
                <datalist id="erp-doc-empresas-lote">
                  {empresaOptions.map((e) => <option key={e} value={e} />)}
                </datalist>
              </div>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b">
                <span className="text-xs font-semibold text-slate-700">O que sera criado</span>
                <span className="text-xs text-muted-foreground">
                  {countDocsDaFila(folderQueue)} documento(s) em {folderQueue.reduce((s, f) => s + countNodes(f).pastas, 0)} pasta(s)
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {folderQueue.map((raiz, i) => {
                  const tot = countNodes(raiz);
                  return (
                    <div key={raiz.nome + '-' + i} className="mb-1">
                      <div className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FolderArchive className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" title={raiz.nome}>{raiz.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {tot.pastas} pasta(s) - {tot.arquivos} arquivo(s)
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
                      </div>
                      {/* Previa da hierarquia que sera recriada dentro da pasta */}
                      <ul className="ml-4 border-l border-slate-200 pl-3 mb-2">
                        {raiz.filhos.filter(isPasta).slice(0, 12).map((sub, j) => (
                          <li key={j} className="text-xs text-slate-600 py-0.5 truncate" title={sub.nome}>
                            <Folder className="h-3 w-3 inline mr-1 text-slate-400" />
                            {sub.nome}
                            {countNodes(sub).pastas > 1 && (
                              <span className="text-slate-400"> (+{countNodes(sub).pastas - 1} subpasta(s))</span>
                            )}
                          </li>
                        ))}
                        {raiz.filhos.filter(isPasta).length > 12 && (
                          <li className="text-xs text-slate-400 py-0.5">
                            +{raiz.filhos.filter(isPasta).length - 12} outras subpastas
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
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
                ? (folderProgress ? `Cadastrando ${folderProgress.done}/${folderProgress.total}â€¦` : 'Cadastrandoâ€¦')
                : `Importar ${countDocsDaFila(folderQueue)} documento${countDocsDaFila(folderQueue) === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PrÃ©-visualizaÃ§Ã£o */}
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
