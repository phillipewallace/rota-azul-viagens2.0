/**
 * Sidebar do Explorer de Documentos — árvore de pastas.
 *
 * - Nó raiz "Documentos" = documentos sem pasta (folder_id NULL).
 * - Cada pasta pode ter subpastas (expansão/recolhimento).
 * - Botões no hover: nova subpasta, renomear, excluir.
 * - Arrastar documentos internos (dataTransfer 'application/x-erp-docs')
 *   para uma pasta move os documentos selecionados para ela.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { erpService, type ErpFolder } from '@/services/erp';
import { useToast } from '@/hooks/use-toast';
import { confirmDialog } from '@/lib/confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, FolderPlus, Pencil, Trash2, Loader2,
} from 'lucide-react';

/** MIME interno usado para arrastar documentos da lista até a árvore. */
export const DOC_DRAG_MIME = 'application/x-erp-docs';

interface Props {
  folders: ErpFolder[];
  /** 'root' = raiz (documentos sem pasta) ou o id de uma pasta. */
  current: string;
  onSelect: (id: string) => void;
  /** Chamado após qualquer mutação de pasta (recarrega a árvore). */
  onChanged: () => void;
  /** Move documentos (ids) para a pasta destino (null = raiz). */
  onMoveDocs: (folderId: string | null, docIds: string[]) => void;
}

interface NameDialog {
  mode: 'create' | 'rename';
  parentId?: string | null;
  folder?: ErpFolder;
  nome: string;
}

const FolderTree: React.FC<Props> = ({ folders, current, onSelect, onChanged, onMoveDocs }) => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [nameDlg, setNameDlg] = useState<NameDialog | null>(null);
  const [saving, setSaving] = useState(false);
  /** Id da pasta sob o cursor durante um arraste ('root' = raiz). */
  const [dropId, setDropId] = useState<string | null>(null);

  // Filhos agrupados por pai (null = raiz), ordenados A→Z.
  const childrenOf = useMemo(() => {
    const m = new Map<string | null, ErpFolder[]>();
    for (const f of folders) {
      const k: string | null = f.parentId || null;
      const arr = m.get(k) || [];
      arr.push(f);
      m.set(k, arr);
    }
    m.forEach((arr) => arr.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    return m;
  }, [folders]);

  const toggle = (id: string) => setExpanded((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  /**
   * Abre automaticamente todos os ancestrais da pasta atual, para o usuário
   * sempre ver onde está na hierarquia (comportamento do Explorer do Windows).
   * Só adiciona — nunca recolhe o que o usuário abriu manualmente.
   */
  useEffect(() => {
    if (!current || current === 'root') return;
    const byId = new Map(folders.map((f) => [f.id, f]));
    const chain: string[] = [];
    let node = byId.get(current);
    // Sobe até a raiz guardando o caminho (protege contra ciclo acidental).
    while (node && chain.length < 50) {
      chain.push(node.id);
      node = node.parentId ? byId.get(node.parentId) : undefined;
    }
    if (!chain.length) return;
    // Só os ANCESTRAIS entram no auto-aberto. A própria pasta atual não é
    // forçada, para o usuário poder recolhê-la pela setinha sem que o
    // efeito reabra na próxima atualização da lista.
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      chain.slice(1).forEach((id) => { if (!next.has(id)) { next.add(id); changed = true; } });
      return changed ? next : prev;
    });
  }, [current, folders]);

  /** Garante a pasta aberta (usado ao clicar no nome dela). */
  const expandOnly = (id: string) => setExpanded((p) => {
    if (p.has(id)) return p;
    const n = new Set(p);
    n.add(id);
    return n;
  });

  const submitName = async () => {
    if (!nameDlg) return;
    const nome = nameDlg.nome.trim();
    if (!nome) return;
    setSaving(true);
    try {
      if (nameDlg.mode === 'create') {
        await erpService.createFolder({ nome, parentId: nameDlg.parentId ?? null });
        // Abre o pai recém-criado para o usuário ver a pasta nova.
        if (nameDlg.parentId) setExpanded((p) => new Set(p).add(nameDlg.parentId as string));
      } else if (nameDlg.folder) {
        await erpService.updateFolder(nameDlg.folder.id, { nome });
      }
      setNameDlg(null);
      onChanged();
    } catch (e: any) {
      toast({
        title: 'Erro na pasta',
        description: e?.message || 'Tente um nome diferente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const removeFolder = async (f: ErpFolder) => {
    const ok = await confirmDialog({
      title: `Excluir a pasta "${f.nome}"?`,
      description:
        'Nada é perdido: documentos e subpastas passam para a pasta anterior (ou para a raiz).',
      confirmLabel: 'Excluir pasta',
      destructive: true,
    });
    if (!ok) return;
    try {
      const r = await erpService.deleteFolder(f.id);
      toast({
        title: 'Pasta excluída',
        description: `${r.documentosMovidos} documento(s) e ${r.subpastasMovidas} subpasta(s) movidos para a pasta anterior.`,
      });
      if (current === f.id) onSelect('root');
      onChanged();
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' });
    }
  };

  // ── Drag & drop de documentos da lista até a árvore ────────────────────────
  const dragHasDocs = (dt: DataTransfer | null) =>
    !!dt && Array.from(dt.types || []).includes(DOC_DRAG_MIME);

  const nodeDragOver = (id: string | null) => (e: React.DragEvent) => {
    if (!dragHasDocs(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    setDropId((prev) => (prev === id ? prev : id));
  };

  const nodeDragLeave = (id: string | null) => (e: React.DragEvent) => {
    e.stopPropagation();
    setDropId((prev) => (prev === id ? null : prev));
  };

  const nodeDrop = (id: string | null) => (e: React.DragEvent) => {
    if (!dragHasDocs(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    setDropId(null);
    try {
      const raw = e.dataTransfer.getData(DOC_DRAG_MIME);
      const ids: string[] = JSON.parse(raw);
      if (Array.isArray(ids) && ids.length) onMoveDocs(id, ids);
    } catch { /* arraste não nosso — ignora */ }
  };

  const toggleStyle = (id: string) =>
    dropId === id ? 'bg-indigo-100 ring-2 ring-indigo-400' : '';

  const renderNode = (folder: ErpFolder, depth: number): React.ReactNode => {
    const kids = childrenOf.get(folder.id) || [];
    // Só o estado `expanded` decide: a setinha fecha mesmo com a pasta ativa.
    const isOpen = expanded.has(folder.id);
    const isActive = current === folder.id;
    return (
      <div key={folder.id}>
        <div
          className={`group/fnode flex items-center gap-1 rounded-md pr-1 cursor-pointer text-sm min-w-0
            ${isActive ? 'bg-indigo-100 text-indigo-900 font-medium' : 'hover:bg-slate-100'}
            ${toggleStyle(folder.id)}`}
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => { onSelect(folder.id); expandOnly(folder.id); }}
          onDragOver={nodeDragOver(folder.id)}
          onDragLeave={nodeDragLeave(folder.id)}
          onDrop={nodeDrop(folder.id)}
          title={`Abrir "${folder.nome}" e mostrar as subpastas — ou arraste documentos aqui para movê-los`}
        >
          <button
            type="button"
            className="p-0.5 rounded hover:bg-white/70 flex-shrink-0"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(folder.id); }}
            title={isOpen ? 'Recolher subpastas' : 'Expandir subpastas'}
            aria-label={isOpen ? 'Recolher' : 'Expandir'}
            aria-expanded={isOpen}
          >
            {kids.length > 0 ? (
              isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            ) : <span className="inline-block w-3.5" />}
          </button>
          {isOpen && kids.length > 0
            ? <FolderOpen className="h-4 w-4 text-indigo-500 flex-shrink-0" />
            : <Folder className="h-4 w-4 text-indigo-500 flex-shrink-0" />}
          <span className="truncate flex-1 min-w-0">{folder.nome}</span>
          {folder.documentosCount != null && folder.documentosCount > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">{folder.documentosCount}</span>
          )}
          <span className="hidden group-hover/fnode:flex items-center gap-0.5 flex-shrink-0">
            <Button
              variant="ghost" size="icon" className="h-6 w-6" title="Nova subpasta"
              onClick={(e) => { e.stopPropagation(); setNameDlg({ mode: 'create', parentId: folder.id, nome: '' }); }}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-6 w-6" title="Renomear pasta"
              onClick={(e) => { e.stopPropagation(); setNameDlg({ mode: 'rename', folder, nome: folder.nome }); }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
              title="Excluir pasta (conteúdo vai para a anterior)"
              onClick={(e) => { e.stopPropagation(); removeFolder(folder); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </span>
        </div>
        {isOpen && kids.map((k) => renderNode(k, depth + 1))}
      </div>
    );
  };

  const rootKids = childrenOf.get(null) || [];

  return (
    <Card className="p-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-1 pb-2 mb-1 border-b">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pastas</span>
        <Button
          variant="ghost" size="sm" className="h-7 px-2 text-xs"
          title="Nova pasta na raiz"
          onClick={() => setNameDlg({ mode: 'create', parentId: null, nome: '' })}
        >
          <FolderPlus className="h-3.5 w-3.5 mr-1" /> Nova pasta
        </Button>
      </div>

      {/* Raiz: documentos sem pasta */}
      <div
        className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer text-sm min-w-0
          ${current === 'root' ? 'bg-indigo-100 text-indigo-900 font-medium' : 'hover:bg-slate-100'}
          ${toggleStyle('root')}`}
        onClick={() => onSelect('root')}
        onDragOver={nodeDragOver('root')}
        onDragLeave={nodeDragLeave('root')}
        onDrop={nodeDrop('root')}
        title="Documentos sem pasta — ou arraste documentos aqui para tirá-los de uma pasta"
      >
        <FolderOpen className="h-4 w-4 text-indigo-600 flex-shrink-0" />
        <span className="truncate">Documentos</span>
      </div>

      <div className="mt-0.5 max-h-[55vh] lg:max-h-[calc(100vh-260px)] overflow-y-auto pr-0.5">
        {folders.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-3 leading-relaxed">
            Nenhuma pasta ainda. Clique em <b>Nova pasta</b> para começar a organizar.
          </p>
        ) : rootKids.map((f) => renderNode(f, 0))}
      </div>

      {/* Dialog criar/renomear */}
      <Dialog open={!!nameDlg} onOpenChange={(o) => { if (!o) setNameDlg(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{nameDlg?.mode === 'create' ? 'Nova pasta' : 'Renomear pasta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label>Nome</Label>
            <Input
              autoFocus
              value={nameDlg?.nome || ''}
              onChange={(e) => setNameDlg((d) => (d ? { ...d, nome: e.target.value } : d))}
              placeholder="Ex: Contratos 2026"
              onKeyDown={(e) => { if (e.key === 'Enter') submitName(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNameDlg(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={submitName} disabled={saving || !(nameDlg?.nome || '').trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FolderTree;
