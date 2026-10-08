import { useState, useEffect, useCallback, useRef } from 'react';
import { rotasService } from '@/services/rotas';
import { Rota, RotaStatus } from '@/types/rota';

export const useRotas = () => {
  const [routes, setRoutes] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadRoutes();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadRoutes = useCallback(async () => {
    try {
      if (mountedRef.current) setLoading(true);
      setError(null);
      const data = await rotasService.getRoutes();
      if (mountedRef.current) {
        setRoutes(data);
      }
    } catch (err: any) {
      console.error('Error loading routes:', err);
      if (mountedRef.current) {
        setError(err.message || 'Erro ao carregar rotas');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const createRoute = useCallback(async (rotaData: Omit<Rota, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newRoute = await rotasService.createRoute(rotaData);
      await loadRoutes();
      return newRoute;
    } catch (err: any) {
      console.error('Error creating route:', err);
      throw err;
    }
  }, [loadRoutes]);

  const updateRoute = useCallback(async (id: string, rotaData: Partial<Rota>) => {
    try {
      const updated = await rotasService.updateRoute(id, rotaData);
      await loadRoutes();
      return updated;
    } catch (err: any) {
      console.error('Error updating route:', err);
      throw err;
    }
  }, [loadRoutes]);

  const deleteRoute = useCallback(async (id: string) => {
    try {
      await rotasService.deleteRoute(id);
      await loadRoutes();
    } catch (err: any) {
      console.error('Error deleting route:', err);
      throw err;
    }
  }, [loadRoutes]);

  const moveRoute = useCallback(async (id: string, direction: 'up' | 'down') => {
    try {
      const updated = await rotasService.moveRoute(id, direction);
      setRoutes(updated);
      return updated;
    } catch (err: any) {
      console.error('Error moving route:', err);
      throw err;
    }
  }, []);

  const reorderRoutes = useCallback(async (rotaIds: string[]) => {
    try {
      const activeRoutes = routes.filter(r => rotaIds.includes(r.id));
      await rotasService.reorderRoutes(activeRoutes);
      await loadRoutes();
    } catch (err: any) {
      console.error('Error reordering routes:', err);
      throw err;
    }
  }, [routes]);

  const getRouteById = useCallback((id: string) => {
    return routes.find(r => r.id === id) || null;
  }, [routes]);

  const getRoutesByStatus = useCallback((status: RotaStatus[]) => {
    return routes.filter(r => status.includes(r.status));
  }, [routes]);

  const getActiveRoutes = useCallback(() => {
    return routes.filter(r => r.status === 'ativa');
  }, [routes]);

  const getCompletedRoutes = useCallback(() => {
    return routes.filter(r => r.status === 'concluida');
  }, [routes]);

  const getPendingRoutes = useCallback(() => {
    return routes.filter(r => r.status === 'inativa');
  }, [routes]);

  return {
    routes,
    loading,
    error,
    loadRoutes,
    createRoute,
    updateRoute,
    deleteRoute,
    moveRoute,
    reorderRoutes,
    getRouteById,
    getRoutesByStatus,
    getActiveRoutes,
    getCompletedRoutes,
    getPendingRoutes,
  };
};
