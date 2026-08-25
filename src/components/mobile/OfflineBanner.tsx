import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Banner discreto que aparece no topo quando o dispositivo perde conexão.
 * Usa tokens semânticos (dark-mode safe) e respeita safe-area.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 safe-area-top bg-destructive text-destructive-foreground shadow-md animate-in slide-in-from-top duration-200"
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        <span>Sem conexão · as ações serão enviadas quando voltar online</span>
      </div>
    </div>
  );
}
