import { type ComponentType, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Variante visual: 'default' (info), 'error' (problema), 'success' (sucesso). */
  variant?: "default" | "error" | "success";
  /** Padding compacto pra empty inline em cards pequenos. */
  compact?: boolean;
  className?: string;
}

/**
 * Estado vazio/erro/sucesso reutilizável.
 * Usa tokens semânticos — dark mode funciona de graça.
 *
 * Substitui o padrão repetido:
 *   <div className="text-center py-12 text-muted-foreground">
 *     <Icon className="h-12 w-12 mx-auto mb-3 opacity-40" />
 *     <p>Nenhum X</p>
 *   </div>
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  compact = false,
  className,
}: EmptyStateProps) {
  const tone = {
    default: "bg-muted/40 text-muted-foreground",
    error: "bg-destructive/10 text-destructive",
    success: "bg-success/10 text-success",
  }[variant];

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center animate-in fade-in duration-200",
        compact ? "py-8 px-4 gap-3" : "py-14 px-6 gap-4",
        className,
      )}
    >
      {Icon && (
        <div
          aria-hidden
          className={cn(
            "flex items-center justify-center rounded-2xl",
            compact ? "h-12 w-12" : "h-14 w-14",
            tone,
          )}
        >
          <Icon className={cn(compact ? "h-6 w-6" : "h-7 w-7")} strokeWidth={1.75} />
        </div>
      )}
      <div className="space-y-1 max-w-sm">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
