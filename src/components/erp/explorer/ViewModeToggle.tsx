import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';
import type { IconSize, ViewMode } from './types';

interface Props {
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  iconSize: IconSize;
  onIconSize: (s: IconSize) => void;
  /** 'sm' = botões compactos (barra de status). */
  size?: 'sm' | 'md';
}

/** Os 4 tamanhos, desenhados como quadradinhos crescentes (igual ao Windows). */
const SIZES: Array<{ value: IconSize; label: string; cells: number }> = [
  { value: 'sm', label: 'Ícones pequenos', cells: 2 },
  { value: 'md', label: 'Ícones médios', cells: 3 },
  { value: 'lg', label: 'Ícones grandes', cells: 4 },
  { value: 'xl', label: 'Ícones muito grandes', cells: 5 },
];

/** Controle "Exibir": alterna lista/grade e, na grade, o tamanho dos ícones. */
const ViewModeToggle: React.FC<Props> = ({
  viewMode, onViewMode, iconSize, onIconSize, size = 'md',
}) => {
  const btn = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  const box = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div
      className="flex items-center rounded-md border bg-white p-0.5"
      role="group"
      aria-label="Modo de visualização"
    >
      <Button
        size="icon" variant={viewMode === 'details' ? 'secondary' : 'ghost'}
        className={btn} title="Detalhes (lista)" aria-pressed={viewMode === 'details'}
        onClick={() => onViewMode('details')}
      >
        <List className={box} />
      </Button>
      <Button
        size="icon" variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
        className={btn} title="Ícones" aria-pressed={viewMode === 'grid'}
        onClick={() => onViewMode('grid')}
      >
        <LayoutGrid className={box} />
      </Button>

      {/* Os 4 quadradinhos só fazem sentido na grade. */}
      {viewMode === 'grid' && (
        <>
          <span className="h-4 w-px bg-slate-200 mx-0.5" aria-hidden />
          {SIZES.map((s) => (
            <Button
              key={s.value}
              size="icon"
              variant={iconSize === s.value ? 'secondary' : 'ghost'}
              className={btn} title={s.label} aria-pressed={iconSize === s.value}
              onClick={() => onIconSize(s.value)}
            >
              <span
                aria-hidden
                className="grid gap-[1.5px]"
                style={{ gridTemplateColumns: `repeat(${s.cells}, 1fr)` }}
              >
                {Array.from({ length: s.cells * s.cells }).map((_, i) => (
                  <span
                    key={i}
                    className={`block rounded-[1px] ${iconSize === s.value ? 'bg-indigo-600' : 'bg-slate-400'}`}
                    style={{ width: 1.5 + s.cells, height: 1.5 + s.cells }}
                  />
                ))}
              </span>
            </Button>
          ))}
        </>
      )}
    </div>
  );
};

export default ViewModeToggle;