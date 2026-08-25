/**
 * Rastreamento em background — "Ativo apenas em movimento"
 * Usa @capacitor-community/background-geolocation quando disponível.
 *
 * Para builds nativos, instalar:
 *   npm i @capacitor-community/background-geolocation
 *   npx cap sync android
 *
 * E permissões no AndroidManifest.xml:
 *   ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION,
 *   FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION
 */
import { API_BASE_URL } from './config';

let watcherId: string | null = null;
let fallbackWatchId: number | null = null;
let fallbackInterval: any = null;

async function loadPlugin(): Promise<any | null> {
  try {
    const pkg = ['@capacitor-community', 'background-geolocation'].join('/');
    const mod: any = await import(/* @vite-ignore */ pkg);
    return mod.BackgroundGeolocation;
  } catch {
    return null;
  }
}

async function postLocation(routeId: string, truckId: string | null, lat: number, lng: number, speed?: number) {
  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('auth-token') || '';
    await fetch(`${API_BASE_URL}/tracking/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        routeId,
        truckId: truckId || undefined,
        lat,
        lng,
        speed: speed ?? null,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.warn('[BG-LOC] Envio falhou:', e);
  }
}

async function startFallback(routeId: string, truckId: string | null): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.warn('[BG-LOC] navigator.geolocation indisponível');
    return false;
  }
  try {
    fallbackWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        postLocation(routeId, truckId, pos.coords.latitude, pos.coords.longitude, pos.coords.speed ?? undefined);
      },
      (err) => console.warn('[BG-LOC fallback] erro:', err?.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    console.log('[BG-LOC] Fallback foreground geolocation ativo');
    return true;
  } catch (e) {
    console.warn('[BG-LOC] Fallback falhou:', e);
    return false;
  }
}

export async function startBackgroundTracking(routeId: string, truckId?: string): Promise<boolean> {
  const tId = truckId || null;
  const BG = await loadPlugin();
  if (!BG) {
    console.log('[BG-LOC] Plugin nativo ausente — usando fallback navigator.geolocation');
    return startFallback(routeId, tId);
  }
  try {
    watcherId = await BG.addWatcher(
      {
        backgroundMessage: 'Rastreamento ativo — não feche o app até finalizar a rota.',
        backgroundTitle: '🚛 Rota em andamento',
        requestPermissions: true,
        stale: false,
        distanceFilter: 30,
      },
      (loc: any, err: any) => {
        if (err) {
          console.warn('[BG-LOC] erro:', err);
          return;
        }
        if (!loc) return;
        // Sempre envia (motorista pode estar parado em cliente)
        postLocation(routeId, tId, loc.latitude, loc.longitude, loc.speed);
      }
    );
    console.log('[BG-LOC] Iniciado, watcher:', watcherId);
    return true;
  } catch (e) {
    console.error('[BG-LOC] Falha ao iniciar plugin nativo, tentando fallback:', e);
    return startFallback(routeId, tId);
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  if (fallbackWatchId !== null && typeof navigator !== 'undefined') {
    try { navigator.geolocation.clearWatch(fallbackWatchId); } catch {}
    fallbackWatchId = null;
  }
  if (fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval = null; }
  if (!watcherId) return;
  const BG = await loadPlugin();
  if (BG) {
    try { await BG.removeWatcher({ id: watcherId }); } catch (e) { console.warn('[BG-LOC] erro ao parar:', e); }
  }
  watcherId = null;
}
