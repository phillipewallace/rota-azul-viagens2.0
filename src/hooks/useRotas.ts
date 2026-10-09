import { useState, useEffect, useCallback, useRef } from 'react';
import { rotasService } from '@/services/rotas';
import { Rota, Ponto, RotaStatus } from '@/types/rota';

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

  // --- Rotas ---

  const createRoute = useCallback(async (data: { name: string; status?: RotaStatus }) => {
    const newRoute = await rotasService.createRoute(data);
    await loadRoutes();
    return newRoute;
  }, [loadRoutes]);

  const updateRoute = useCallback(async (id: string, data: Partial<Rota>) => {
    const updated = await rotasService.updateRoute(id, data);
    await loadRoutes();
    return updated;
  }, [loadRoutes]);

  const deleteRoute = useCallback(async (id: string) => {
    await rotasService.deleteRoute(id);
    await loadRoutes();
  }, [loadRoutes]);

  const moveRoute = useCallback(async (id: string, direction: 'up' | 'down') => {
    const updated = await rotasService.moveRoute(id, direction);
    setRoutes(updated);
    return updated;
  }, []);

  const reorderRoutes = useCallback(async (rotaIds: string[]) => {
    const updated = await rotasService.reorderRoutes(rotaIds);
    setRoutes(updated);
    return updated;
  }, []);

  /**
   * Importação em lote vinda do Excel: cada item = { name, pontos[] }.
   * Recarrega a lista e retorna as rotas criadas.
   */
  const importRotas = useCallback(async (
    items: { name: string; status?: RotaStatus; pontos: Array<Partial<Ponto>> }[],
  ) => {
    const created = await rotasService.importRotas(items);
    await loadRoutes();
    return created;
  }, [loadRoutes]);

  // --- Pontos (dentro de uma rota) ---

  const addPonto = useCallback(async (rotaId: string, pontoData: Omit<Ponto, 'id'>) => {
    const newPonto = await rotasService.addPonto(rotaId, pontoData);
    await loadRoutes();
    return newPonto;
  }, [loadRoutes]);

  const updatePonto = useCallback(async (rotaId: string, pontoId: string, pontoData: Partial<Ponto>) => {
    const updated = await rotasService.updatePonto(rotaId, pontoId, pontoData);
    await loadRoutes();
    return updated;
  }, [loadRoutes]);

  const deletePonto = useCallback(async (rotaId: string, pontoId: string) => {
    await rotasService.deletePonto(rotaId, pontoId);
    await loadRoutes();
  }, [loadRoutes]);

  const movePonto = useCallback(async (rotaId: string, pontoId: string, direction: 'up' | 'down') => {
    await rotasService.movePonto(rotaId, pontoId, direction);
    await loadRoutes();
  }, [loadRoutes]);

  // --- Consultas ---

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
    importRotas,
    addPonto,
    updatePonto,
    deletePonto,
    movePonto,
    getRouteById,
    getRoutesByStatus,
    getActiveRoutes,
    getCompletedRoutes,
    getPendingRoutes,
  };
};