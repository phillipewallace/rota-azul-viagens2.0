import React from 'react';
import ViewModeToggle from './ViewModeToggle';
import type { IconSize, ViewMode } from './types';

interface Props {
  /** Total de itens visíveis (pastas + documentos) na página atual. */
  totalDocs: number;
  /** Pastas filhas exibidas no conteúdo atual (não paginadas). */
  folderCount: number;
  selectedCount: number;
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  iconSize: IconSize;
  onIconSize: (s: IconSize) => void;
}

/** Barra de status estilo Explorer: "X itens · Y selecionados" + exibir à direita. */
const ExplorerStatusBar: React.FC<Props> = ({
  totalDocs, folderCount, selectedCount, viewMode, onViewMode, iconSize, onIconSize,
}) => {
  const total = totalDocs + folderCount;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-1.5 text-xs text-slate-600">
      <span className="tabular-nums truncate">
        {selectedCount > 0
          ? <>{selectedCount} de {total} item{total === 1 ? '' : 's'} selecionado{selectedCount === 1 ? '' : 's'}</>
          : <>{total} item{total === 1 ? '' : 's'}</>}
        {folderCount > 0 && selectedCount === 0 && (
          <span className="text-slate-400"> · {folderCount} pasta{folderCount === 1 ? '' : 's'}</span>
        )}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden sm:inline text-slate-400">Exibir</span>
        <ViewModeToggle
          size="sm"
          viewMode={viewMode}
          onViewMode={onViewMode}
          iconSize={iconSize}
          onIconSize={onIconSize}
        />
      </div>
    </div>
  );
};

export default ExplorerStatusBar;
