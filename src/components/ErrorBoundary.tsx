import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  /** Fallback customizado opcional. Recebe o erro e um reset. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("react.error_boundary", {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return <DefaultErrorFallback error={error} onReset={this.reset} />;
  }
}

function DefaultErrorFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const isDev = import.meta.env.DEV;

  return (
    <main
      role="alert"
      aria-live="assertive"
      className="min-h-[100dvh] grid place-items-center bg-gradient-to-b from-background to-muted/40 px-4 py-12"
    >
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div
              aria-hidden
              className="shrink-0 h-11 w-11 rounded-xl bg-destructive/10 text-destructive grid place-items-center"
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <h1 className="text-lg font-semibold tracking-tight leading-tight">
                Algo deu errado
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Encontramos um erro inesperado ao carregar esta tela. Você pode
                tentar novamente ou voltar ao início.
              </p>
            </div>
          </div>

          {isDev && (
            <pre className="max-h-40 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground font-mono">
              {error.message}
            </pre>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              className="min-h-11 transition-colors duration-200"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              <Home className="h-4 w-4" />
              Início
            </Button>
            <Button
              className="min-h-11 transition-colors duration-200"
              onClick={onReset}
            >
              <RotateCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
