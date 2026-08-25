import { cn } from "@/lib/utils";

interface ListSkeletonProps {
  rows?: number;
  /** Mostra um "avatar"/ícone à esquerda em cada linha. */
  showAvatar?: boolean;
  className?: string;
}

/**
 * Skeleton consistente pra listas e tabelas.
 * Usa `bg-muted` + animação pulse padrão do Tailwind.
 */
export function ListSkeleton({ rows = 5, showAvatar = false, className }: ListSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      aria-busy="true"
      className={cn("space-y-3 animate-in fade-in duration-200", className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3"
        >
          {showAvatar && (
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse shrink-0" />
          )}
          <div className="flex-1 space-y-2 min-w-0">
            <div
              className="h-3 rounded bg-muted animate-pulse"
              style={{ width: `${55 + ((i * 17) % 35)}%` }}
            />
            <div
              className="h-2.5 rounded bg-muted/70 animate-pulse"
              style={{ width: `${35 + ((i * 11) % 25)}%` }}
            />
          </div>
          <div className="h-7 w-16 rounded-md bg-muted animate-pulse shrink-0" />
        </div>
      ))}
      <span className="sr-only">Carregando conteúdo…</span>
    </div>
  );
}
