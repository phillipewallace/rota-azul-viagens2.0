import { useVirtualizer } from "@tanstack/react-virtual";
import { Fragment, type RefObject, type ReactNode } from "react";
import { TableCell, TableRow } from "@/components/ui/table";

interface VirtualRowsProps<T> {
  /** Ref do elemento scroll-parent (deve ter altura fixa, ex.: max-h-[70vh] overflow-auto). */
  scrollRef: RefObject<HTMLElement>;
  items: T[];
  /** Quantas colunas a tabela tem (para os tr's de espaçamento). */
  colSpan: number;
  /** Altura estimada de cada linha em px (use a média real). */
  estimateSize?: number;
  /** Linhas extras renderizadas fora da viewport. */
  overscan?: number;
  /** Abaixo deste limite, renderiza tudo normalmente (sem virtualização). */
  threshold?: number;
  /** Função que extrai a key estável da linha. */
  getKey: (item: T, index: number) => string | number;
  /** Renderiza a TableRow para um item. */
  renderRow: (item: T, index: number) => ReactNode;
}

/**
 * Virtualização para corpo de <Table>. Insere dois TableRow "spacer" no topo e
 * fundo com a altura agregada das linhas fora da viewport, e renderiza apenas
 * as linhas visíveis. Mantém o layout natural da <table> (sem position:absolute).
 *
 * Requisitos:
 *  - O scroll-parent deve ter altura fixa (ex.: max-h-[70vh] overflow-auto).
 *  - Use apenas para listas grandes (acima do `threshold`); abaixo, é overhead inútil.
 */
export function VirtualRows<T>({
  scrollRef,
  items,
  colSpan,
  estimateSize = 52,
  overscan = 8,
  threshold = 50,
  getKey,
  renderRow,
}: VirtualRowsProps<T>) {
  const shouldVirtualize = items.length > threshold;

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? items.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const renderAllRows = () => (
    <>
      {items.map((item, i) => (
        <Fragment key={getKey(item, i)}>{renderRow(item, i)}</Fragment>
      ))}
    </>
  );

  if (!shouldVirtualize || !scrollRef.current) {
    return renderAllRows();
  }

  const virtualItems = virtualizer.getVirtualItems();

  if (virtualItems.length === 0 && items.length > 0) {
    return renderAllRows();
  }

  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0);

  return (
    <>
      {paddingTop > 0 && (
        <TableRow aria-hidden className="border-0 hover:bg-transparent">
          <TableCell colSpan={colSpan} style={{ height: paddingTop, padding: 0 }} />
        </TableRow>
      )}
      {virtualItems.map((v) => {
        const item = items[v.index];
        return (
          <Fragment key={getKey(item, v.index)}>{renderRow(item, v.index)}</Fragment>
        );
      })}
      {paddingBottom > 0 && (
        <TableRow aria-hidden className="border-0 hover:bg-transparent">
          <TableCell colSpan={colSpan} style={{ height: paddingBottom, padding: 0 }} />
        </TableRow>
      )}
    </>
  );
}
