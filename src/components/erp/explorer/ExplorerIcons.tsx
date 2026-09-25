import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Folder, FolderArchive, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { getPreviewKind } from '@/utils/documentFiles';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { SPREADSHEET_EXTS, OFFICE_DOC_EXTS } from '@/utils/spreadsheetConvert';
import { fmtDate } from './format';
import type { ExplorerBaseProps } from './ExplorerDetails';

const fileExtension = (name?: string | null) => (name ? name.split('.').pop()!.toLowerCase() : '');

/** Visualização em Ícones/Grade estilo Explorer (pastas primeiro). */
const ExplorerIcons: React.FC<ExplorerBaseProps> = ({
  entries, selectedIds, loading, hasFilters,
  onItemClick, onItemOpen, onItemContextMenu, onItemDragStart,
  dropId, onItemDragOver, onItemDragLeave, onItemDrop,
  onFolderNewSub, onFolderRename, onFolderDelete,
}) => {
  if (!entries.length) {
    return (
      <div className="p-16 text-center text-muted-foreground">
        <FolderArchive className={`h-10 w-10 mx-auto mb-3 opacity-40 ${loading ? 'animate-spin' : ''}`} />
        <p className="mt-1">
          {loading
            ? 'Carregando documentos…'
            : hasFilters
              ? 'Nenhum documento encontrado com esses filtros.'
              : 'Nenhuma pasta ou documento aqui. Clique em “Novo” ou arraste arquivos/pastas para dentro.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
      {entries.map((entry, idx) => {
        const isSel = selectedIds.has(entry.id);

        if (entry.kind === 'folder') {
          const f = entry.folder;
          const isDrop = dropId === f.id;
          return (
            <div
              key={f.id}
              data-exp-row
              onClick={(e) => onItemClick(entry, e, idx)}
              onDoubleClick={() => onItemOpen(entry)}
              onContextMenu={(e) => onItemContextMenu(e, entry)}
              onDragOver={(e) => onItemDragOver(entry, e)}
              onDragLeave={(e) => onItemDragLeave(entry, e)}
              onDrop={(e) => onItemDrop(entry, e)}
              className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center cursor-pointer transition-colors
                ${isSel
                  ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300'
                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'}
                ${isDrop ? 'ring-2 ring-indigo-500 border-indigo-400' : ''}`}
              title={`Abrir "${f.nome}" — ou arraste documentos aqui para movê-los`}
            >
              <div className="h-16 w-16 flex items-center justify-center rounded-lg bg-indigo-50/60">
                <Folder className="h-10 w-10 text-indigo-500" />
              </div>
              <p className="text-xs font-medium truncate w-full" title={f.nome}>{f.nome}</p>
              <p className="text-[10px] text-muted-foreground">
                {f.documentosCount || 0} doc{(f.documentosCount || 0) === 1 ? '' : 's'}
                {f.subpastasCount ? ` · ${f.subpastasCount} sub` : ''}
              </p>
              <span className="hidden group-hover:flex absolute top-1.5 right-1.5 items-center gap-0.5">
                <button
                  type="button"
                  title="Nova subpasta"
                  className="h-6 w-6 rounded bg-white/90 border shadow-sm flex items-center justify-center hover:bg-white"
                  onClick={(e) => { e.stopPropagation(); onFolderNewSub(f); }}
                >
                  <FolderPlus className="h-3.5 w-3.5 text-indigo-600" />
                </button>
                <button
                  type="button"
                  title="Renomear pasta"
                  className="h-6 w-6 rounded bg-white/90 border shadow-sm flex items-center justify-center hover:bg-white"
                  onClick={(e) => { e.stopPropagation(); onFolderRename(f); }}
                >
                  <Pencil className="h-3.5 w-3.5 text-slate-600" />
                </button>
                <button
                  type="button"
                  title="Excluir pasta"
                  className="h-6 w-6 rounded bg-white/90 border shadow-sm flex items-center justify-center hover:bg-white text-red-600"
                  onClick={(e) => { e.stopPropagation(); onFolderDelete(f); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          );
        }

        const d = entry.doc;
        const isSub = (d.arquivosCount || 0) > 1;
        const kind = getPreviewKind(d.arquivoNome, d.arquivoTipo);
        const thumb = !isSub && kind === 'image' && d.arquivoUrl
          ? toAbsoluteUrl(d.arquivoUrl)
          : null;
        const editable = !!d.arquivoUrl
          && (SPREADSHEET_EXTS.includes(fileExtension(d.arquivoNome))
            || OFFICE_DOC_EXTS.includes(fileExtension(d.arquivoNome)));

        return (
          <div
            key={d.id}
            data-exp-row
            draggable
            onDragStart={(e) => onItemDragStart(e, entry)}
            onClick={(e) => onItemClick(entry, e, idx)}
            onDoubleClick={() => onItemOpen(entry)}
            onContextMenu={(e) => onItemContextMenu(e, entry)}
            className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center cursor-pointer transition-colors
              ${isSel
                ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300'
                : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'}`}
            title={`${d.nome}${d.tipo ? ` · ${d.tipo}` : ''} — duplo clique para abrir`}
          >
            <div className="h-16 w-16 flex items-center justify-center overflow-hidden rounded-lg bg-slate-50">
              {thumb ? (
                <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : isSub ? (
                <FolderArchive className="h-9 w-9 text-indigo-500" />
              ) : (
                <span className="[&>svg]:h-9 [&>svg]:w-9 flex items-center justify-center text-[10px] font-bold text-slate-400">
                  {kind === 'pdf' ? 'PDF' : kind === 'office' ? 'XLS' : kind === 'image' ? 'IMG' : 'FILE'}
                </span>
              )}
            </div>
            <p className="text-xs font-medium truncate w-full" title={d.nome}>{d.nome}</p>
            <p className="text-[10px] text-muted-foreground">{fmtDate(d.updatedAt || d.createdAt)}</p>
            {isSub && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {d.arquivosCount} arquivos
              </Badge>
            )}
            {editable && (
              <span
                className="absolute top-1.5 right-1.5 rounded bg-emerald-50 px-1 text-[9px] font-semibold text-emerald-700 border border-emerald-200 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Editável no sistema (Excel/Office)"
              >
                EDITAR
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ExplorerIcons;
