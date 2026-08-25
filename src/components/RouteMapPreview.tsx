
import React, { useEffect, useRef } from 'react';
import { googleMapsService } from '@/services/googleMaps';

interface RouteMapPreviewProps {
  route: any;
}

const RouteMapPreview: React.FC<RouteMapPreviewProps> = ({ route }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);

  useEffect(() => {
    initializeMap();
    return () => cleanup();
  }, [route]);

  const cleanup = () => {
    if (directionsRenderer.current) {
      directionsRenderer.current.setMap(null);
      directionsRenderer.current = null;
    }
    if (mapInstance.current) {
      mapInstance.current = null;
    }
  };

  const initializeMap = async () => {
    if (!mapContainer.current || !route?.points?.length) return;

    try {
      await googleMapsService.initialize();

      if (!window.google?.maps) {
        console.error('Google Maps não carregado');
        return;
      }

      // Calculate center from route points
      const validPoints = route.points.filter((p: any) => p.lat && p.lng);
      if (validPoints.length === 0) return;

      const center = {
        lat: validPoints.reduce((sum: number, p: any) => sum + p.lat, 0) / validPoints.length,
        lng: validPoints.reduce((sum: number, p: any) => sum + p.lng, 0) / validPoints.length
      };

      mapInstance.current = new window.google.maps.Map(mapContainer.current, {
        center,
        zoom: 12,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative'
      });

      await drawRoute();
    } catch (error) {
      console.error('Erro ao inicializar mapa de preview:', error);
    }
  };

  const drawRoute = async () => {
    if (!mapInstance.current || !route?.points?.length || route.points.length < 2) {
      console.warn('⚠️ [ROUTE PREVIEW] drawRoute: condições não atendidas', {
        hasMap: !!mapInstance.current,
        pointsCount: route?.points?.length,
        minPoints: 2
      });
      return;
    }

    try {
      console.log('🗺️ [ROUTE PREVIEW] ========================================');
      console.log('🗺️ [ROUTE PREVIEW] DESENHANDO ROTA NO PREVIEW');
      console.log('📊 [ROUTE PREVIEW] Pontos recebidos:', route.points.length);
      
      route.points.forEach((p: any, i: number) => {
        console.log(`📍 [ROUTE PREVIEW] Ponto ${i}:`, {
          order: p.order,
          lat: p.lat,
          lng: p.lng,
          address: p.address?.substring(0, 30) + '...'
        });
      });

      const sortedPoints = route.points
        .filter((p: any) => {
          const isValid = p.lat && p.lng && 
                         typeof p.lat === 'number' && 
                         typeof p.lng === 'number' &&
                         !isNaN(p.lat) && !isNaN(p.lng) &&
                         p.lat !== 0 && p.lng !== 0;
          
          if (!isValid) {
            console.warn('⚠️ [ROUTE PREVIEW] Ponto filtrado (inválido):', {
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              reason: !p.lat ? 'sem lat' : !p.lng ? 'sem lng' : 
                     typeof p.lat !== 'number' ? 'lat não é número' : 
                     typeof p.lng !== 'number' ? 'lng não é número' :
                     isNaN(p.lat) ? 'lat é NaN' : isNaN(p.lng) ? 'lng é NaN' :
                     p.lat === 0 ? 'lat = 0' : 'lng = 0'
            });
          }
          
          return isValid;
        })
        .sort((a: any, b: any) => a.order - b.order);

      console.log(`✅ [ROUTE PREVIEW] Pontos válidos após filtro: ${sortedPoints.length}`);

      if (sortedPoints.length < 2) {
        console.error('❌ [ROUTE PREVIEW] Menos de 2 pontos válidos após filtro!');
        return;
      }

      const directionsService = new window.google.maps.DirectionsService();
      directionsRenderer.current = new window.google.maps.DirectionsRenderer({
        map: mapInstance.current,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 4,
          strokeOpacity: 0.8
        }
      });

      const origin = sortedPoints[0];
      const destination = sortedPoints[sortedPoints.length - 1];
      const waypoints = sortedPoints.slice(1, -1);
      
      console.log('🎯 [ROUTE PREVIEW] Configuração da rota:', {
        origin: { lat: origin.lat, lng: origin.lng, address: origin.address?.substring(0, 30) + '...' },
        destination: { lat: destination.lat, lng: destination.lng, address: destination.address?.substring(0, 30) + '...' },
        waypointsCount: waypoints.length,
        waypoints: waypoints.map((w: any) => ({ 
          lat: w.lat, 
          lng: w.lng, 
          address: w.address?.substring(0, 30) + '...'
        }))
      });

      directionsService.route({
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        waypoints: waypoints.map((point: any) => ({
          location: new window.google.maps.LatLng(point.lat, point.lng),
          stopover: true
        })),
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false
      }, (result: any, status: string) => {
        if (status === 'OK' && directionsRenderer.current) {
          directionsRenderer.current.setDirections(result);
          console.log('✅ [ROUTE PREVIEW] Rota desenhada com sucesso');
        } else {
          console.error('❌ [ROUTE PREVIEW] Erro ao desenhar rota:', status);
        }
        console.log('🗺️ [ROUTE PREVIEW] ========================================');
      });

    } catch (error) {
      console.error('❌ [ROUTE PREVIEW] Erro ao desenhar rota:', error);
      console.log('🗺️ [ROUTE PREVIEW] ========================================');
    }
  };

  return (
    <div className="w-full h-80 bg-gray-100 rounded-lg border overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};

export default RouteMapPreview;
