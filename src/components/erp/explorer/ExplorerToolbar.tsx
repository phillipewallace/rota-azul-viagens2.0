import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowDownAZ, ArrowUpAZ, ChevronDown, FilePlus2, FolderPlus,
  Loader2, RefreshCw, Trash2, UploadCloud,
} from 'lucide-react';

import type { SortKey } from './types';

interface Props {
  /** Botão primário "Novo" — cria documento OU pasta no local atual. */
  onNewDoc: () => void;
  onNewFolder: () => void;
  /** Importar arquivo/pasta do sistema (reaproveita os inputs ocultos da página). */
  onImportFiles: () => void;
  onImportFolder: () => void;
  onRefresh: () => void;
  /** Ações que só aparecem com itens selecionados (estilo Explorer). */
  selectedCount: number;
  onMoveSelected: () => void;
  onDeleteSelected: () => void;
  /** Ordenação e visualização. */
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey, dir: 'asc' | 'desc') => void;
  loading?: boolean;
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'nome', label: 'Nome' },
  { key: 'data', label: 'Data de modificação' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'empresa', label: 'Empresa emissora' },
];

/** Command bar estilo Windows 11: Novo ▾ · Importar · Ordenar ▾ · Exibir ▾ · Atualizar. */
const ExplorerToolbar: React.FC<Props> = ({
  onNewDoc, onNewFolder, onImportFiles, onImportFolder, onRefresh,
  selectedCount, onMoveSelected, onDeleteSelected,
  sortKey, sortDir, onSort, loading,
}) => (
  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <FilePlus2 className="h-4 w-4 mr-1.5" /> Novo <ChevronDown className="h-3.5 w-3.5 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={onNewDoc}>
          <FilePlus2 className="h-4 w-4 mr-2 text-indigo-600" /> Novo documento
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNewFolder}>
          <FolderPlus className="h-4 w-4 mr-2 text-indigo-600" /> Nova pasta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onImportFiles}>
          <UploadCloud className="h-4 w-4 mr-2 text-slate-500" /> Importar arquivos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onImportFolder}>
          <UploadCloud className="h-4 w-4 mr-2 text-slate-500" /> Importar pasta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <Button size="sm" variant="ghost" className="h-8" onClick={onRefresh} title="Atualizar (F5)">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
    </Button>

    {selectedCount > 0 && (
      <>
        <div className="h-5 w-px bg-slate-200 mx-0.5" />
        <span className="text-xs text-slate-600 tabular-nums px-1">
          {selectedCount} selecionado{selectedCount === 1 ? '' : 's'}
        </span>
        <Button size="sm" variant="ghost" className="h-8" onClick={onMoveSelected} title="Mover para…">
          <FolderPlus className="h-4 w-4 mr-1.5 text-indigo-500" /> Mover para…
        </Button>
        <Button
          size="sm" variant="ghost"
          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onDeleteSelected}
        >
          <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
        </Button>
      </>
    )}

    <div className="flex-1" />

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8">
          Ordenar <ChevronDown className="h-3.5 w-3.5 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {SORT_OPTIONS.map((o) => (
          <div key={o.key}>
            <DropdownMenuItem onClick={() => onSort(o.key, 'asc')}>
              <ArrowDownAZ className="h-4 w-4 mr-2 text-slate-500" />
              {o.label} (A→Z / recentes)
              {sortKey === o.key && sortDir === 'asc' && <span className="ml-auto text-indigo-600">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSort(o.key, 'desc')}>
              <ArrowUpAZ className="h-4 w-4 mr-2 text-slate-500" />
              {o.label} (Z→A / antigos)
              {sortKey === o.key && sortDir === 'desc' && <span className="ml-auto text-indigo-600">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export default ExplorerToolbar;

