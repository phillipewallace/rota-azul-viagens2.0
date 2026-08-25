import { useState, useEffect, useCallback, useRef } from 'react';
import { trafficService } from '@/services/traffic';
import { API_CONFIG } from '@/services/config';

interface TruckLocation {
  lat: number;
  lng: number;
  timestamp: Date;
  speed?: number;
  heading?: number;
}

interface TrackingData {
  truckId: string;
  currentLocation: TruckLocation | null;
  nextDestination: {
    address: string;
    lat: number;
    lng: number;
    eta: string;
    distance: string;
    duration: string;
    durationInTraffic: string;
  } | null;
  route: {
    totalDistance: string;
    totalDuration: string;
    totalDurationInTraffic: string;
    completedPoints: number;
    remainingPoints: number;
  } | null;
}

export const useRealTimeTracking = (truckId: string | null, routePoints: any[] = []) => {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // [fix] watchId em ref evita stale closures e múltiplos handles acumulados
  const watchIdRef = useRef<number | null>(null);

  const updateLocation = useCallback(async (position: GeolocationPosition) => {
    if (!truckId) return;

    const newLocation: TruckLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: new Date(),
      speed: position.coords.speed || undefined,
      heading: position.coords.heading || undefined,
    };

    try {
      // [fix] usa BASE_URL configurada (produção/dev), não localhost hardcoded
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}/trucks/${truckId}/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lat: newLocation.lat, lng: newLocation.lng }),
      });

      if (!response.ok) {
        console.error('Failed to update truck location:', response.status);
      }

      let nextDestination = null;
      let routeInfo = null;

      if (routePoints && routePoints.length > 0) {
        const sortedPoints = [...routePoints].sort((a, b) => (a.order || 0) - (b.order || 0));
        const nextPoint = sortedPoints.find(p => !p.completed);

        if (nextPoint && nextPoint.lat && nextPoint.lng) {
          const trafficInfo = await trafficService.getTrafficInfo(
            { lat: newLocation.lat, lng: newLocation.lng, address: 'Localização atual' },
            { lat: nextPoint.lat, lng: nextPoint.lng, address: nextPoint.address }
          );

          if (trafficInfo && trafficInfo.status === 'OK') {
            nextDestination = {
              address: nextPoint.address,
              lat: nextPoint.lat,
              lng: nextPoint.lng,
              eta: trafficInfo.durationInTraffic,
              distance: trafficInfo.distance,
              duration: trafficInfo.duration,
              durationInTraffic: trafficInfo.durationInTraffic,
            };
          }
        }

        const remainingPoints = sortedPoints.filter(p => !p.completed);
        if (remainingPoints.length > 0 && remainingPoints.every(p => p.lat && p.lng)) {
          const routeTrafficInfo = await trafficService.getRouteTrafficInfo(
            [{ lat: newLocation.lat, lng: newLocation.lng, address: 'Atual' }, ...remainingPoints]
          );

          if (routeTrafficInfo) {
            routeInfo = {
              totalDistance: routeTrafficInfo.totalDistance,
              totalDuration: routeTrafficInfo.totalDuration,
              totalDurationInTraffic: routeTrafficInfo.totalDurationInTraffic,
              completedPoints: sortedPoints.length - remainingPoints.length,
              remainingPoints: remainingPoints.length,
            };
          }
        }
      }

      setTrackingData({
        truckId,
        currentLocation: newLocation,
        nextDestination,
        route: routeInfo,
      });
      setError(null);
    } catch (err) {
      console.error('Erro ao atualizar rastreamento:', err);
      setError('Erro ao atualizar localização');
    }
  }, [truckId, routePoints]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setTrackingData(null);
    setLoading(false);
    setError(null);
  }, []);

  const startTracking = useCallback(() => {
    if (!truckId || watchIdRef.current !== null) return;

    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      setLoading(false);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        updateLocation(position);
        setLoading(false);
        setIsTracking(true);
      },
      (err) => {
        console.error('Erro GPS:', err);
        setError(`Erro ao obter localização GPS: ${err.message}`);
        setLoading(false);
        setIsTracking(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    watchIdRef.current = id;
  }, [truckId, updateLocation]);

  // Auto-start e cleanup único por truckId — evita acúmulo de handles
  useEffect(() => {
    if (!truckId) return;
    startTracking();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truckId]);

  return {
    trackingData,
    isTracking,
    loading,
    error,
    startTracking,
    stopTracking,
  };
};
