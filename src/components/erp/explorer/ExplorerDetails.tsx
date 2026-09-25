import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown, ChevronRight, FileText, Folder, FolderArchive, FolderPlus,
  Pencil, RefreshCw, Trash2,
} from 'lucide-react';
import type { ErpDocument, ErpFolder } from '@/services/erp';
import { formatFileSize } from '@/utils/documentFiles';
import { fmtDate } from './format';
import type { ExplorerEntry } from './types';

/** Props comuns às duas views de conteúdo (grade e detalhes). */
export interface ExplorerBaseProps {
  entries: ExplorerEntry[];
  selectedIds: Set<string>;
  loading: boolean;
  hasFilters: boolean;
  onItemClick: (entry: ExplorerEntry, e: React.MouseEvent, index: number) => void;
  onItemContextMenu: (e: React.MouseEvent, entry: ExplorerEntry) => void;
  onItemDragStart: (e: React.DragEvent, entry: ExplorerEntry) => void;
  /** Id da pasta sob o cursor durante arraste de documentos (highlight). */
  dropId: string | null;
  onItemDragOver: (entry: ExplorerEntry, e: React.DragEvent) => void;
  onItemDragLeave: (entry: ExplorerEntry, e: React.DragEvent) => void;
  onItemDrop: (entry: ExplorerEntry, e: React.DragEvent) => void;
  /** Ações de pasta (botões hover + menu de contexto). */
  onFolderNewSub: (folder: ErpFolder) => void;
  onFolderRename: (folder: ErpFolder) => void;
  onFolderDelete: (folder: ErpFolder) => void;
}

interface Props extends ExplorerBaseProps {
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  /** Botões de ação da linha do documento (reaproveita os da página). */
  renderDocActions?: (doc: ErpDocument) => React.ReactNode;
}

const EmptyState: React.FC<{ loading: boolean; hasFilters: boolean }> = ({ loading, hasFilters }) => (
  <div className="p-16 text-center text-muted-foreground">
    {loading
      ? <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
      : <FolderArchive className="h-10 w-10 mx-auto mb-3 opacity-40" />}
    <p className="mt-1">
      {loading
        ? 'Carregando documentos…'
        : hasFilters
          ? 'Nenhum documento encontrado com esses filtros.'
          : 'Nenhuma pasta ou documento aqui. Clique em “Novo” ou arraste arquivos/pastas para dentro.'}
    </p>
  </div>
);

/** Visualização em Detalhes: tabela com colunas estilo Explorer (pastas primeiro). */
const ExplorerDetails: React.FC<Props> = ({
  entries, selectedIds, loading, hasFilters,
  onItemClick, onItemContextMenu, onItemDragStart,
  dropId, onItemDragOver, onItemDragLeave, onItemDrop,
  onFolderNewSub, onFolderRename, onFolderDelete,
  sortKey, sortDir, onSort,
  renderDocActions,
}) => {
  if (!entries.length) return <EmptyState loading={loading} hasFilters={hasFilters} />;

  const sortIcon = (key: string) =>
    sortKey !== key ? null
      : sortDir === 'asc' ? <ChevronDown className="h-3 w-3 inline ml-1" />
        : <ChevronRight className="h-3 w-3 inline ml-1" />;

  const th = (label: string, key: string, cls: string) => (
    <th className={`text-left px-3 py-2.5 font-medium cursor-pointer select-none hover:text-indigo-600 ${cls}`} onClick={() => onSort(key)} title={`Ordenar por ${label.toLowerCase()}`}>
      {label}{sortIcon(key)}
    </th>
  );

  return (
    <table className="w-full text-sm table-fixed">
      <thead className="bg-slate-50 text-slate-700">
        <tr>
          {th('Nome', 'nome', 'w-[26%]')}
          {th('Modificado', 'data', 'w-[11%] hidden sm:table-cell')}
          {th('Tipo', 'tipo', 'w-[11%]')}
          {th('Tamanho', 'tamanho', 'w-[9%] hidden lg:table-cell')}
          <th className="text-left px-3 py-2.5 font-medium w-[16%] hidden md:table-cell">Arquivo</th>
          <th className="text-left px-3 py-2.5 font-medium w-[11%] hidden lg:table-cell">Numeração</th>
          {th('Empresa Emissora', 'empresa', 'w-[14%] hidden xl:table-cell')}
          <th className="text-right px-3 py-2.5 font-medium w-[14%]">Ações</th>
        </tr>
      </thead>
      <tbody>

        {entries.map((entry, idx) => {
          const isSel = selectedIds.has(entry.id);

          // ── Pasta ────────────────────────────────────────────────────────
          if (entry.kind === 'folder') {
            const f = entry.folder;
            const isDrop = dropId === f.id;
            return (
              <tr
                key={f.id}
                data-exp-row
                className={`border-t border-slate-100 cursor-pointer ${isSel ? 'bg-indigo-100/70 ring-1 ring-inset ring-indigo-300' : 'hover:bg-slate-50/60'} ${isDrop ? 'outline outline-2 -outline-offset-2 outline-indigo-400' : ''}`}
                onClick={(e) => onItemClick(entry, e, idx)}
                onContextMenu={(e) => onItemContextMenu(e, entry)}
                onDragOver={(e) => onItemDragOver(entry, e)}
                onDragLeave={(e) => onItemDragLeave(entry, e)}
                onDrop={(e) => onItemDrop(entry, e)}
                title={`Abrir "${f.nome}" — ou arraste documentos aqui para movê-los`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Folder className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                    <span className="truncate font-medium" title={f.nome}>{f.nome}</span>
                    {f.subpastasCount != null && f.subpastasCount > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">· {f.subpastasCount} sub</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell whitespace-nowrap">{fmtDate(f.createdAt)}</td>
                <td className="px-3 py-2.5"><Badge variant="outline" className="text-slate-600">Pasta de arquivos</Badge></td>
                <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">—</td>
                <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">—</td>
                <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">—</td>
                <td className="px-3 py-2.5 text-muted-foreground hidden xl:table-cell">—</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Nova subpasta" onClick={() => onFolderNewSub(f)}>
                      <FolderPlus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Renomear pasta" onClick={() => onFolderRename(f)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Excluir pasta (conteúdo vai para a anterior)"
                      onClick={() => onFolderDelete(f)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          }


          // ── Documento ────────────────────────────────────────────────────
          const d = entry.doc;

          return (
            <tr
              key={d.id}
              data-exp-row
              className={`border-t border-slate-100 cursor-pointer ${isSel ? 'bg-indigo-100/70 ring-1 ring-inset ring-indigo-300' : 'hover:bg-slate-50/60'}`}
              onClick={(e) => onItemClick(entry, e, idx)}
              onContextMenu={(e) => onItemContextMenu(e, entry)}
              draggable
              onDragStart={(e) => onItemDragStart(e, entry)}
              title="Clique para abrir · arraste para mover"
            >
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 flex-shrink-0 text-indigo-500" />
                  <span className="truncate font-medium" title={d.nome}>{d.nome}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell whitespace-nowrap">{fmtDate(d.updatedAt || d.createdAt)}</td>
              <td className="px-3 py-2.5">
                {d.tipo
                  ? <Badge variant="outline" className="max-w-full truncate">{d.tipo}</Badge>
                  : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                {d.arquivoTamanho != null ? formatFileSize(d.arquivoTamanho) : '—'}
              </td>
              <td className="px-3 py-2.5 hidden md:table-cell">
                {d.arquivoNome ? (
                  <span className="text-xs truncate block" title={d.arquivoNome}>{d.arquivoNome}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                <span className="truncate block" title={d.numeracao}>{d.numeracao || '—'}</span>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground hidden xl:table-cell">
                <span className="truncate block" title={d.empresaEmissora}>{d.empresaEmissora || '—'}</span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                  {renderDocActions?.(d)}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default ExplorerDetails;
