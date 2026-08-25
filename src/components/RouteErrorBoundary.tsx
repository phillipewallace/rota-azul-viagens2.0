import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "./ErrorBoundary";

/**
 * Error Boundary com escopo de rota.
 * Isola falhas de uma página para não derrubar a app inteira,
 * e reseta automaticamente ao navegar para outra rota.
 */
export default function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <ErrorBoundary
      key={location.pathname}
      fallback={(error, reset) => (
        <RouteErrorFallback error={error} reset={reset} pathname={location.pathname} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

function RouteErrorFallback({
  error,
  reset,
  pathname,
}: {
  error: Error;
  reset: () => void;
  pathname: string;
}) {
  const isDev = import.meta.env.DEV;

  // Reseta automaticamente quando o usuário navega para outra rota.
  useEffect(() => {
    return () => reset();
  }, [pathname, reset]);

  return (
    <section
      role="alert"
      aria-live="assertive"
      className="min-h-[60vh] w-full grid place-items-center px-4 py-10 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-2xl border bg-card text-card-foreground shadow-sm p-6 sm:p-7 space-y-5">
        <div className="flex items-start gap-3.5">
          <div
            aria-hidden
            className="shrink-0 h-10 w-10 rounded-xl bg-destructive/10 text-destructive grid place-items-center"
          >
            <AlertTriangle className="h-[18px] w-[18px]" />
          </div>
          <div className="space-y-1 min-w-0">
            <h2 className="text-base font-semibold tracking-tight leading-tight">
              Não foi possível carregar esta página
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ocorreu um erro ao renderizar este conteúdo. As demais áreas continuam funcionando.
            </p>
          </div>
        </div>

        {isDev && (
          <pre className="max-h-32 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground font-mono">
            {error.message}
          </pre>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="outline"
            className="min-h-10 transition-colors duration-200"
            onClick={() => window.history.back()}
          >
            Voltar
          </Button>
          <Button
            className="min-h-10 transition-colors duration-200"
            onClick={reset}
          >
            <RotateCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    </section>
  );
}
