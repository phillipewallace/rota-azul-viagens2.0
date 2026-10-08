/**
 * Mapa Google Maps da página de detalhe de uma Rota.
 * Geocodifica o endereço de cada Ponto (com cache em módulo), exibe marcadores
 * numerados 1..N com o nome da empresa e, quando há 2+ pontos, desenha a rota
 * (mesmo padrão do RouteMapPreview do projeto).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Rota } from '@/types/rota';
import { googleMapsService } from '@/services/googleMaps';
import { MapPin, ExternalLink, Loader2, MapPinned } from 'lucide-react';

interface ErpRotaMapProps {
  rota: Rota;
}

interface GeoPoint {
  lat: number;
  lng: number;
}

/** Cache de geocoding em módulo: endereço normalizado -> coordenadas. */
const geocodeCache = new Map<string, GeoPoint | null>();

const normalizeAddress = (address: string): string =>
  address.trim().toLowerCase().replace(/\s+/g, ' ');

async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const key = normalizeAddress(address);
  if (!key) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;

  try {
    const geocoder = new window.google.maps.Geocoder();
    const result = await geocoder.geocode({ address });
    const location = result.results?.[0]?.geometry?.location;
    if (location) {
      const point: GeoPoint = { lat: location.lat(), lng: location.lng() };
      geocodeCache.set(key, point);
      return point;
    }
    geocodeCache.set(key, null);
    return null;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

/** Escapa HTML para injetar com segurança no InfoWindow. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type MapState = 'loading' | 'ready' | 'error' | 'empty';

const ErpRotaMap: React.FC<ErpRotaMapProps> = ({ rota }) => {

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [state, setState] = useState<MapState>('loading');
  const [failedCount, setFailedCount] = useState(0);

  const addresses = rota.pontos.map((p) => p.address).filter((a) => a.trim() !== '');
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    addresses[0] || rota.name
  )}`;

  const cleanup = () => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (rendererRef.current) {
      rendererRef.current.setMap(null);
      rendererRef.current = null;
    }
    mapInstance.current = null;
  };

  const drawRoute = (geoPoints: GeoPoint[]) => {
    try {
      const directionsService = new window.google.maps.DirectionsService();
      rendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapInstance.current,
        suppressMarkers: true, // mantém os marcadores numerados próprios
        polylineOptions: { strokeColor: '#0f766e', strokeWeight: 4, strokeOpacity: 0.85 },
      });

      const origin = geoPoints[0];
      const destination = geoPoints[geoPoints.length - 1];
      const waypoints = geoPoints.slice(1, -1).map((p) => ({
        location: new window.google.maps.LatLng(p.lat, p.lng),
        stopover: true,
      }));

      directionsService.route(
        {
          origin: new window.google.maps.LatLng(origin.lat, origin.lng),
          destination: new window.google.maps.LatLng(destination.lat, destination.lng),
          waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        },
        (result: any, status: string) => {
          if (status === 'OK' && rendererRef.current) {
            rendererRef.current.setDirections(result);
          } else {
            console.warn('Não foi possível desenhar a rota no mapa:', status);
          }
        }
      );
    } catch (error) {
      console.warn('Erro ao desenhar rota no mapa:', error);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      cleanup();

      if (addresses.length === 0) {
        setState('empty');
        return;
      }
      if (!mapContainer.current) return;
      setState('loading');

      try {
        await googleMapsService.initialize();
        if (!window.google?.maps || cancelled || !mapContainer.current) return;

        // Geocodifica os endereços (cache evita refazer a chamada ao voltar)
        const points: (GeoPoint | null)[] = [];
        for (const address of addresses) {
          points.push(await geocodeAddress(address));
          if (cancelled) return;
        }

        const geocoded = rota.pontos
          .map((ponto, index) => ({ ponto, index, geo: points[index] }))
          .filter((entry): entry is { ponto: Rota['pontos'][number]; index: number; geo: GeoPoint } =>
            entry.geo !== null);

        if (geocoded.length === 0) {
          setState('error');
          return;
        }

        setFailedCount(rota.pontos.length - geocoded.length);

        // Centro = média dos pontos geocodificados
        const center = {
          lat: geocoded.reduce((sum, g) => sum + g.geo.lat, 0) / geocoded.length,
          lng: geocoded.reduce((sum, g) => sum + g.geo.lng, 0) / geocoded.length,
        };

        mapInstance.current = new window.google.maps.Map(mapContainer.current, {
          center,
          zoom: geocoded.length === 1 ? 15 : 12,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          zoomControl: true,
          gestureHandling: 'cooperative',
        });

        // Marcadores numerados na ordem da rota
        markersRef.current = geocoded.map(({ ponto, index, geo }) => {
          const marker = new window.google.maps.Marker({
            position: geo,
            map: mapInstance.current,
            label: { text: String(index + 1), color: '#ffffff', fontWeight: 'bold', fontSize: '12px' },
            title: ponto.company,
          });
          const info = new window.google.maps.InfoWindow({
            content: `<div style="font-family:sans-serif;font-size:12px;padding:2px 4px;">
              <strong>${index + 1}. ${escapeHtml(ponto.company)}</strong><br/>
              ${escapeHtml(ponto.address)}
            </div>`,
          });
          marker.addListener('click', () => info.open(mapInstance.current, marker));
          return marker;
        });

        setState('ready');

        // Desenha a rota quando há 2+ pontos geocodificados
        if (geocoded.length >= 2) {
          drawRoute(geocoded.map((g) => g.geo));
        }
      } catch (error) {
        console.error('Erro ao inicializar mapa da rota:', error);
        if (!cancelled) setState('error');
      }
    };

    initialize();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota.id, rota.updatedAt]);


  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-700">
          <MapPinned className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Mapa da rota</span>
        </div>
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          Abrir no Google Maps <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="relative h-72 md:h-80 bg-slate-100">
        <div ref={mapContainer} className="w-full h-full" />

        {state === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-slate-500">Carregando mapa...</span>
          </div>
        )}

        {state === 'empty' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
            <MapPin className="h-8 w-8 text-slate-300" />
            <span className="text-sm text-slate-500">
              Adicione pontos com endereço para ver o mapa
            </span>
          </div>
        )}

        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-slate-50">
            <MapPin className="h-8 w-8 text-slate-300" />
            <span className="text-sm text-slate-500 text-center px-4">
              Não foi possível localizar os endereços no mapa.
            </span>
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary hover:underline"
            >
              Abrir no Google Maps
            </a>
          </div>
        )}
      </div>

      {state === 'ready' && failedCount > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700">
          {failedCount} ponto{failedCount > 1 ? 's' : ''} não foi
          {failedCount > 1 ? 'ram' : ''} localizado{failedCount > 1 ? 's' : ''} no mapa (endereço
          não encontrado).
        </div>
      )}
    </div>
  );
};

export default ErpRotaMap;
