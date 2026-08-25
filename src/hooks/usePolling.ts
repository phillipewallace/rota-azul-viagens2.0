import { useEffect, useRef } from 'react';

/**
 * Chama `fn` em intervalos enquanto o documento está visível.
 * Usado para sincronizar dados entre múltiplos usuários (poll leve).
 */
export function usePolling(fn: () => void | Promise<void>, intervalMs = 15000, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let timer: any = null;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        try { void fnRef.current(); } catch { /* ignore */ }
      }
    };
    timer = setInterval(tick, intervalMs);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs, enabled]);
}
