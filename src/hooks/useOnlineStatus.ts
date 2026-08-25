import { useEffect, useState } from "react";

/**
 * Reage a mudanças de conectividade do dispositivo.
 * Usa `navigator.onLine` + eventos `online`/`offline`.
 *
 * Em apps mobile (Capacitor), o WebView dispara esses eventos quando
 * o aparelho perde/recupera rede — incluindo modo avião e perda de Wi-Fi.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return isOnline;
}
