
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePolling } from './usePolling';
import { routesService } from '@/services/routes';
import { API_CONFIG } from '@/services/config';

export type PointCategory = 'obra' | 'evento';
export type OperationType = 'entrega' | 'recolhimento' | 'manutencao';

export interface RoutePoint {
  id: string;
  address: string;
  cep?: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
  completedAt?: string | null;
  customerName?: string;
  restroomsQty?: number;
  cleaningsQty?: number;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  observation?: string;
  pointCategory?: PointCategory;
  operationType?: OperationType;
  recolhidoQty?: number;
  autoRemoved?: boolean;
  sanitarioNumbers?: string[];
  sanitarioRecolhidos?: string[];
  name?: string;
  stopType?: string;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  points: RoutePoint[];
  totalDistance: number;
  estimatedTime: string;
  optimizedOrder: string[];
  optimizationMode?: 'fixed' | 'optimized';
  status: 'active' | 'inactive' | 'completed';
  createdAt: string;
  polyline?: string;
}

export const useRoutes = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  // Guard pra evitar setState após unmount (race em polling + efeito inicial)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadRoutes = useCallback(async () => {
    try {
      if (mountedRef.current) setLoading(true);
      const data = await routesService.getRoutes();
      if (mountedRef.current) setRoutes(data);
    } catch (error) {
      console.error('Error loading routes:', error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const getAddressByCep = async (cep: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}/geocoding/cep/${cep}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        throw new Error('Erro ao buscar endereço por CEP');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting address by CEP:', error);
      throw error;
    }
  };

  // ✅ CORRIGIDO: Otimização inteligente com ID correto
  const optimizeRoute = async (allPoints: RoutePoint[], routeId?: string) => {
    try {
      console.log('🎯 [USE ROUTES] ========================================');
      console.log('🎯 [USE ROUTES] Iniciando otimização de rota');
      console.log(`🎯 [USE ROUTES] Route ID: ${routeId || 'NOVA ROTA'}`);
      console.log(`🎯 [USE ROUTES] Pontos para otimizar: ${allPoints.length}`);

      if (allPoints.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }

      let optimizationResult = null;

      // ✅ TENTATIVA 1: Otimização inteligente (SOMENTE se existe routeId válido)
      if (routeId && routeId !== 'NOVA ROTA') {
        console.log('🧠 [USE ROUTES] Tentando otimização inteligente...');
        console.log(`🧠 [USE ROUTES] URL: ${API_CONFIG.BASE_URL}/routes/${routeId}/optimize-intelligent`);
        
        try {
          const token = localStorage.getItem('auth_token');
          const response = await fetch(`${API_CONFIG.BASE_URL}/routes/${routeId}/optimize-intelligent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              points: allPoints.map((point, index) => ({
                id: point.id,
                address: point.address,
                cep: point.cep,
                lat: point.lat,
                lng: point.lng,
                order: index,
                type: point.type,
                completed: point.completed ?? false,
                completedAt: point.completedAt ?? null,
              })),
            }),
          });

          console.log(`📡 [USE ROUTES] Resposta da otimização inteligente: ${response.status}`);

          if (response.ok) {
            const intelligentData = await response.json();
            console.log('✅ [USE ROUTES] Otimização inteligente bem-sucedida');
            console.log('📊 [USE ROUTES] Dados recebidos:', intelligentData);
            
            optimizationResult = {
              optimizedOrder: intelligentData.optimizedOrder,
              totalDistance: intelligentData.totalDistance,
              estimatedTime: intelligentData.estimatedTime,
              polyline: intelligentData.polyline,
              points: intelligentData.points.map((p: any, index: number) => ({
                id: p.id,
                address: p.address,
                cep: p.cep || '',
                lat: p.lat,
                lng: p.lng,
                order: index,
                type: p.type,
                completed: p.completed ?? false,
                completedAt: p.completedAt ?? null,
              })),
            };
          } else {
            const errorData = await response.json();
            console.log('⚠️ [USE ROUTES] Otimização inteligente falhou:', errorData);
            
            // ✅ SE RETORNOU useTraditional, continuar para fallback
            if (errorData.useTraditional) {
              console.log('🔄 [USE ROUTES] Backend solicitou usar otimização tradicional');
            }
          }
        } catch (error) {
          console.log('⚠️ [USE ROUTES] Erro na otimização inteligente:', error);
        }
      } else {
        console.log('🆕 [USE ROUTES] Nova rota - pulando otimização inteligente');
      }

      // ✅ FALLBACK: Otimização tradicional
      if (!optimizationResult) {
        console.log('🔄 [USE ROUTES] Usando otimização tradicional');
        console.log(`🔄 [USE ROUTES] URL: ${API_CONFIG.BASE_URL}/geocoding/optimize`);
        
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_CONFIG.BASE_URL}/geocoding/optimize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            points: allPoints.map((point, index) => ({
              id: point.id,
              address: point.address,
              cep: point.cep,
              lat: point.lat,
              lng: point.lng,
              order: index,
              type: point.type,
              completed: point.completed ?? false,
              completedAt: point.completedAt ?? null,
            })),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [USE ROUTES] Erro na otimização tradicional:', errorText);
          throw new Error('Erro na otimização da rota');
        }

        const optimizedData = await response.json();
        console.log('✅ [USE ROUTES] Otimização tradicional bem-sucedida');
        console.log('📊 [USE ROUTES] Dados recebidos:', optimizedData);
        
        optimizationResult = {
          optimizedOrder: optimizedData.optimizedOrder,
          totalDistance: optimizedData.totalDistance,
          estimatedTime: optimizedData.estimatedTime,
          polyline: optimizedData.polyline,
          points: optimizedData.points.map((p: any, index: number) => ({
            id: p.id,
            address: p.address,
            cep: p.cep || '',
            lat: p.lat,
            lng: p.lng,
            order: index,
            type: p.type,
            completed: p.completed ?? false,
            completedAt: p.completedAt ?? null,
          })),
        };
      }

      console.log('✅ [USE ROUTES] Otimização concluída com sucesso');
      console.log('🎯 [USE ROUTES] ========================================');
      return optimizationResult;

    } catch (error) {
      console.error('❌ [USE ROUTES] Erro na otimização:', error);
      throw error;
    }
  };

  const createRoute = async (routeData: Omit<Route, 'id' | 'createdAt'>) => {
    try {
      const newRoute = await routesService.createRoute(routeData);
      await loadRoutes();
      return newRoute;
    } catch (error) {
      console.error('Error creating route:', error);
      throw error;
    }
  };

  const updateRoute = async (id: string, routeData: Partial<Route>) => {
    try {
      const updatedRoute = await routesService.updateRoute(id, routeData);
      await loadRoutes();
      return updatedRoute;
    } catch (error) {
      console.error('Error updating route:', error);
      throw error;
    }
  };

  const deleteRoute = async (id: string) => {
    try {
      await routesService.deleteRoute(id);
      await loadRoutes();
    } catch (error) {
      console.error('Error deleting route:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);
  usePolling(loadRoutes, 20000);

  return {
    routes,
    loading,
    loadRoutes,
    getAddressByCep,
    optimizeRoute,
    createRoute,
    updateRoute,
    deleteRoute
  };
};
