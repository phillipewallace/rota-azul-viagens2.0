/**
 * Barra de paginação reutilizável para listas com paginação server-side.
 *
 * Uso típico:
 *   <PaginationBar
 *     page={page} pageSize={pageSize} total={total}
 *     onPageChange={setPage} onPageSizeChange={setPageSize}
 *   />
 *
 * Não faz fetch — apenas emite eventos. Fica escondida quando `total`
 * cabe em uma única página (a menos que `alwaysShow` seja passado).
 */
import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { totalPages } from '@/lib/pagination';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Opções do seletor de tamanho. */
  pageSizeOptions?: number[];
  /** Mostrar mesmo quando cabe em 1 página. */
  alwaysShow?: boolean;
  className?: string;
}

export const PaginationBar: React.FC<Props> = ({
  page, pageSize, total,
  onPageChange, onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200],
  alwaysShow = false,
  className = '',
}) => {
  const pages = totalPages(total, pageSize);
  if (!alwaysShow && pages <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < pages;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 py-2 ${className}`}>
      <div className="text-xs text-muted-foreground tabular-nums">
        {total === 0 ? 'Nenhum registro' : <>Mostrando <b>{from}</b>–<b>{to}</b> de <b>{total}</b></>}
      </div>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            Por página
            <select
              value={pageSize}
              onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
              className="h-8 rounded-md border border-input bg-background px-1.5 text-xs"
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-8 w-8 p-0"
            disabled={!canPrev} onClick={() => onPageChange(1)} title="Primeira">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0"
            disabled={!canPrev} onClick={() => onPageChange(page - 1)} title="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-xs px-2 tabular-nums">
            Página <b>{page}</b> de <b>{pages}</b>
          </span>

          <Button size="sm" variant="outline" className="h-8 w-8 p-0"
            disabled={!canNext} onClick={() => onPageChange(page + 1)} title="Próxima">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0"
            disabled={!canNext} onClick={() => onPageChange(pages)} title="Última">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaginationBar;
