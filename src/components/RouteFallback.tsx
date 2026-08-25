/**
 * Fallback minimalista para lazy-load de rotas.
 * Em vez de um spinner que ocupa a tela inteira (parece que o app
 * saiu do ar), renderizamos um esqueleto discreto que insinua o
 * conteúdo. A TopProgressBar (App.tsx) cuida do feedback de carga.
 */
export default function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="w-full px-4 py-6 space-y-4 animate-in fade-in duration-200"
    >
      <div className="h-6 w-40 rounded-md skeleton-shimmer" />
      <div className="grid gap-3">
        <div className="h-24 rounded-xl skeleton-shimmer" />
        <div className="h-24 rounded-xl skeleton-shimmer" />
        <div className="h-24 rounded-xl skeleton-shimmer opacity-70" />
      </div>
      <span className="sr-only">Carregando conteúdo da página</span>
    </div>
  );
}
