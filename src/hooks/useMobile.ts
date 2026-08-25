
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    points: Array<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      order: number;
      type: 'origin' | 'destination' | 'waypoint';
      completed: boolean;
    }>;
  };
  location?: {
    lat: number;
    lng: number;
  };
}

export const useMobile = () => {
  const queryClient = useQueryClient();

  const getTruckByPlate = async (plate: string): Promise<TruckMobileData> => {
    console.log('🔍 [MOBILE] Buscando caminhão por placa:', plate);
    console.log('🔍 [MOBILE] URL:', `${API_BASE_URL}/mobile/truck/${plate}`);
    
    const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'omit',
    });
    
    console.log('📡 [MOBILE] Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ [MOBILE] Erro:', errorData);
      throw new Error('Caminhão não encontrado');
    }
    
    const data = await response.json();
    console.log('✅ [MOBILE] Dados do caminhão recebidos:', data);
    return data;
  };

  const updateTruckLocationMutation = useMutation({
    mutationFn: async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
      console.log('📍 [MOBILE] Atualizando localização do caminhão:', { truckId, lat, lng });
      
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
        console.error('❌ [MOBILE] Erro ao atualizar localização:', errorData);
        throw new Error('Erro ao atualizar localização');
      }
      
      const result = await response.json();
      console.log('✅ [MOBILE] Localização atualizada com sucesso');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['tracking'] });
    },
  });

  const updateRoutePointMutation = useMutation({
    mutationFn: async (payload: {
      truckId: string;
      pointId: string;
      completed?: boolean;
      recolhidoQty?: number;
      autoRemoved?: boolean;
      operationType?: string;
      observation?: string;
      sanitarioNumbers?: string[];
      sanitarioRecolhidos?: string[];
    }) => {
      const { truckId, pointId, ...body } = payload;
      const token = localStorage.getItem('auth_token') || '';
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/route/point/${pointId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'omit',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Erro ao atualizar ponto da rota');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  const finishRouteMutation = useMutation({
    mutationFn: async (truckId: string) => {
      console.log('🏁 [MOBILE] Finalizando rota do caminhão:', truckId);
      
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
        console.error('❌ [MOBILE] Erro ao finalizar rota:', errorData);
        throw new Error('Erro ao finalizar rota');
      }
      
      const result = await response.json();
      console.log('✅ [MOBILE] Rota finalizada com sucesso');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['tracking'] });
    },
  });

  return {
    getTruckByPlate,
    updateTruckLocation: updateTruckLocationMutation.mutateAsync,
    updateRoutePoint: updateRoutePointMutation.mutateAsync,
    finishRoute: finishRouteMutation.mutateAsync,
    isUpdatingLocation: updateTruckLocationMutation.isPending,
    isUpdatingRoute: updateRoutePointMutation.isPending,
    isFinishingRoute: finishRouteMutation.isPending,
  };
};
