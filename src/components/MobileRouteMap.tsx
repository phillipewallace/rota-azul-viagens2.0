
import React, { useEffect, useRef, useState } from 'react';
import { googleMapsService } from '@/services/googleMaps';

interface MobileRouteMapProps {
  route: {
    points: Array<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      order: number;
      type: 'origin' | 'destination' | 'waypoint';
      completed?: boolean;
    }>;
  };
}

const MobileRouteMap: React.FC<MobileRouteMapProps> = ({ route }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    const initializeMap = async () => {
      if (!mapContainer.current || !route.points?.length || isInitializing) {
        console.log('❌ [MOBILE MAP] Condições insuficientes para inicializar');
        return;
      }

      try {
        setIsInitializing(true);
        setMapError(null);
        console.log('🗺️ [MOBILE MAP] Inicializando mapa mobile...');
        
        // Aguardar inicialização do Google Maps
        await googleMapsService.initialize();
        
        if (!window.google || !window.google.maps) {
          throw new Error('Google Maps API não carregou corretamente');
        }

        const validPoints = route.points
          .filter(point => point.lat && point.lng && typeof point.lat === 'number' && typeof point.lng === 'number')
          .sort((a, b) => a.order - b.order);

        console.log('📍 [MOBILE MAP] Pontos válidos:', validPoints.length);

        if (validPoints.length === 0) {
          throw new Error('Nenhum ponto válido encontrado');
        }

        // Calcular centro do mapa
        const centerLat = validPoints.reduce((sum, point) => sum + point.lat, 0) / validPoints.length;
        const centerLng = validPoints.reduce((sum, point) => sum + point.lng, 0) / validPoints.length;

        console.log('🎯 [MOBILE MAP] Centro do mapa:', { lat: centerLat, lng: centerLng });

        // Criar instância do mapa
        map.current = new window.google.maps.Map(mapContainer.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 12,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          zoomControl: true,
          mapTypeId: 'roadmap',
        });

        // Adicionar marcadores
        validPoints.forEach((point, index) => {
          new window.google.maps.Marker({
            position: { lat: point.lat, lng: point.lng },
            map: map.current,
            title: point.address,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: point.completed ? 8 : 10,
              fillColor: point.completed ? '#22c55e' : point.type === 'origin' ? '#3b82f6' : '#f59e0b',
              fillOpacity: point.completed ? 0.7 : 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            },
            label: {
              text: (index + 1).toString(),
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'
            }
          });
        });

        // Desenhar rota se tiver mais de um ponto
        if (validPoints.length > 1) {
          await drawRoute(validPoints);
        }

        setMapLoaded(true);
        console.log('✅ [MOBILE MAP] Mapa inicializado com sucesso');
        
      } catch (error) {
        console.error('❌ [MOBILE MAP] Erro ao inicializar mapa:', error);
        setMapError(error instanceof Error ? error.message : 'Erro desconhecido');
      } finally {
        setIsInitializing(false);
      }
    };

    const drawRoute = async (points: any[]) => {
      if (!map.current || points.length < 2) return;

      try {
        const directionsService = new window.google.maps.DirectionsService();
        const directionsRenderer = new window.google.maps.DirectionsRenderer({
          map: map.current,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#3b82f6',
            strokeWeight: 4,
            strokeOpacity: 0.8
          }
        });

        const origin = points[0];
        const destination = points[points.length - 1];
        const waypoints = points.slice(1, -1).map((point: any) => ({
          location: new window.google.maps.LatLng(point.lat, point.lng),
          stopover: true
        }));

        return new Promise((resolve, reject) => {
          directionsService.route({
            origin: new window.google.maps.LatLng(origin.lat, origin.lng),
            destination: new window.google.maps.LatLng(destination.lat, destination.lng),
            waypoints: waypoints,
            travelMode: window.google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false
          }, (result: any, status: string) => {
            if (status === 'OK') {
              directionsRenderer.setDirections(result);
              console.log('✅ [MOBILE MAP] Rota desenhada');
              resolve(result);
            } else {
              console.error('❌ [MOBILE MAP] Erro ao desenhar rota:', status);
              reject(new Error(`Erro ao desenhar rota: ${status}`));
            }
          });
        });
      } catch (error) {
        console.error('❌ [MOBILE MAP] Erro ao desenhar rota:', error);
      }
    };

    // Limpar mapa existente antes de inicializar novo
    if (map.current) {
      map.current = null;
    }
    
    setMapLoaded(false);
    initializeMap();

    // Cleanup
    return () => {
      if (map.current) {
        map.current = null;
      }
    };
  }, [route.points, isInitializing]);

  if (!route.points?.length) {
    return (
      <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Nenhuma rota disponível</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 bg-gray-200 rounded-lg overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-100">
          <div className="text-center text-red-600">
            <p className="font-semibold">Erro ao carregar mapa</p>
            <p className="text-sm">{mapError}</p>
          </div>
        </div>
      )}
      
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm">Carregando mapa...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileRouteMap;
