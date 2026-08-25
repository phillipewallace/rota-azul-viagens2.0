
import { useState, useCallback } from 'react';
import { API_BASE_URL } from '@/services/config';

export interface TruckMobileData {
  id: string;
  name: string;
  plate: string;
  status: string;
  driver?: string;
  currentRoute?: {
    id: string;
    name: string;
    description?: string;
    points: Array<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      order: number;
      type: 'origin' | 'destination' | 'waypoint';
      completed: boolean;
      completedAt?: string;
      // ✅ CAMPOS OPERACIONAIS
      name?: string;
      customerName?: string;
      restroomsQty?: number;
      cleaningsQty?: number;
      contactName?: string;
      contactPhone?: string;
      notes?: string;
      observation?: string;
      cep?: string;
      stopType?: string;
    }>;
    lastUpdated?: string;
  };
  location?: {
    lat: number;
    lng: number;
  };
  lastUpdated?: string;
}

export const useMobile = () => {
  // Cache otimizado para evitar requisições desnecessárias
  const [requestCache, setRequestCache] = useState<Map<string, { data: any; timestamp: number }>>(new Map());
  const CACHE_DURATION = 30000; // 30 segundos de cache

  const getCachedOrFetch = useCallback(async (key: string, fetchFn: () => Promise<any>) => {
    const cached = requestCache.get(key);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }
    
    const data = await fetchFn();
    
    setRequestCache(prev => {
      const newCache = new Map(prev);
      newCache.set(key, { data, timestamp: now });
      return newCache;
    });
    
    return data;
  }, [requestCache]);

  const getTruckByPlate = useCallback(async (plate: string): Promise<TruckMobileData> => {
    return getCachedOrFetch(`truck-${plate}`, async () => {
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error('Caminhão não encontrado');
      }
      
      const data = await response.json();
      return data;
    });
  }, [getCachedOrFetch]);

  const updateTruckLocation = useCallback(async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
    const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/location`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'omit',
      body: JSON.stringify({ lat, lng }),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error('Erro ao atualizar localização');
    }
    
    const result = await response.json();
    
    // Limpar cache relacionado de forma eficiente
    setRequestCache(prev => {
      const newCache = new Map(prev);
      for (const key of newCache.keys()) {
        if (key.includes(truckId)) {
          newCache.delete(key);
        }
      }
      return newCache;
    });
    
    return result;
  }, []);

  const updateRoutePoint = useCallback(async (params: {
    truckId: string;
    pointId: string;
    completed: boolean;
    recolhidoQty?: number;
    autoRemoved?: boolean;
    operationType?: string;
    observation?: string;
    sanitarioNumbers?: string[];
    sanitarioRecolhidos?: string[];
  }) => {
    const { truckId, pointId, ...rest } = params;
    const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/route/point/${pointId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'omit',
      body: JSON.stringify(rest),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error('Erro ao atualizar ponto da rota');
    }
    
    const result = await response.json();
    
    // Limpar cache relacionado
    setRequestCache(prev => {
      const newCache = new Map(prev);
      for (const key of newCache.keys()) {
        if (key.includes(truckId)) {
          newCache.delete(key);
        }
      }
      return newCache;
    });
    
    return result;
  }, []);

  const finishRoute = useCallback(async (truckId: string) => {
    const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/finish-route`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'omit',
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error('Erro ao finalizar rota');
    }
    
    const result = await response.json();
    
    // Limpar todo o cache após finalizar rota
    setRequestCache(new Map());
    
    return result;
  }, []);

  const reorderStops = useCallback(async (routeId: string, reorderedPoints: Array<{ pointId: string; order: number }>) => {
    const response = await fetch(`${API_BASE_URL}/mobile/route/${routeId}/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'omit',
      body: JSON.stringify({ points: reorderedPoints })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error('Erro ao reordenar paradas');
    }

    const result = await response.json();
    
    // Limpar cache relacionado
    setRequestCache(new Map());
    
    return result;
  }, []);

  /**
   * Adicionar parada extra à rota
   * Aceita coordenadas lat/lng opcionais para precisão de localização
   * Inclui campos operacionais: banheiros, limpezas, contato, observações
   */
  const addExtraStop = useCallback(async (
    routeId: string, 
    truckId: string, 
    stopData: {
      name: string;
      stopType: string;
      location: string;
      lat?: number;
      lng?: number;
      insertBeforeId?: string;
      // Novos campos operacionais
      restroomsQty?: number;
      cleaningsQty?: number;
      contactName?: string;
      contactPhone?: string;
      notes?: string;
    }
  ) => {
    // Construir URL completa para debug
    const apiUrl = `${API_BASE_URL}/mobile/route/${routeId}/extra-stop`;
    
    console.log('📍 [useMobile] =============== ADICIONANDO PARADA EXTRA ===============');
    console.log('📍 [useMobile] API_BASE_URL:', API_BASE_URL);
    console.log('📍 [useMobile] URL completa:', apiUrl);
    console.log('📍 [useMobile] RouteId:', routeId);
    console.log('📍 [useMobile] TruckId:', truckId);
    console.log('📍 [useMobile] Dados:', JSON.stringify(stopData, null, 2));

    const payload = {
      name: stopData.name,
      stopType: stopData.stopType,
      location: stopData.location,
      lat: stopData.lat,
      lng: stopData.lng,
      insertBeforeId: stopData.insertBeforeId,
      truckId,
      source: 'MOTORISTA',
      // Novos campos operacionais
      restroomsQty: stopData.restroomsQty,
      cleaningsQty: stopData.cleaningsQty,
      contactName: stopData.contactName,
      contactPhone: stopData.contactPhone,
      notes: stopData.notes
    };

    console.log('📍 [useMobile] Payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
        body: JSON.stringify(payload)
      });

      console.log('📍 [useMobile] Response status:', response.status);
      console.log('📍 [useMobile] Response ok:', response.ok);

      if (!response.ok) {
        let errorMessage = 'Erro ao adicionar parada extra';
        
        // Tentar obter detalhes do erro
        const responseText = await response.text();
        console.error('❌ [useMobile] Response text:', responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorData.details || errorData.message || errorMessage;
          console.error('❌ [useMobile] Erro parseado:', errorData);
        } catch {
          if (responseText) errorMessage = responseText;
        }
        
        // Adicionar info da URL no erro para debug
        if (response.status === 404) {
          errorMessage = `Rota não encontrada: ${apiUrl} (Status: ${response.status})`;
        }
        
        console.error('❌ [useMobile] Erro final:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ [useMobile] Parada extra adicionada com sucesso:', result);
      
      // Limpar cache relacionado
      setRequestCache(new Map());
      
      return result;
    } catch (error: any) {
      console.error('❌ [useMobile] Exceção ao chamar API:', error);
      console.error('❌ [useMobile] URL tentada:', apiUrl);
      throw error;
    }
  }, []);

  return {
    getTruckByPlate,
    updateTruckLocation,
    updateRoutePoint,
    finishRoute,
    reorderStops,
    addExtraStop,
    clearCache: () => setRequestCache(new Map())
  };
};
