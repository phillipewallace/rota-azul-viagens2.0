import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/PageMeta";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  const isAppFuncionarios = location.pathname.startsWith('/app-funcionarios');

  return (
    <>
      <PageMeta title="Página não encontrada" noindex />
    <main className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-background to-muted/40 px-6 py-12">
      <div className="w-full max-w-md text-center space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div
          aria-hidden
          className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"
        >
          <Compass className="h-8 w-8" strokeWidth={1.75} />
        </div>

        <div className="space-y-2">
          <p className="text-6xl font-bold tracking-tight text-foreground tabular-nums">
            404
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Página não encontrada
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O endereço{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-foreground">
              {location.pathname}
            </code>{" "}
            não existe ou foi movido.
          </p>
        </div>

        <Button asChild className="min-h-11 transition-all duration-200">
          <Link to={isAppFuncionarios ? "/app-funcionarios" : "/"}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao início
          </Link>
        </Button>
      </div>
    </main>
    </>
  );
};

export default NotFound;
