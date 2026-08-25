
import { useState, useEffect, useCallback } from 'react';
import { useMobile } from './useMobile';
import type { TruckMobileData } from './useMobile';

interface RouteSync {
  lastRouteUpdate: string | null;
  hasRouteChanged: boolean;
  isChecking: boolean;
  newRouteData: TruckMobileData | null;
}

export const useRouteSync = (truckData: TruckMobileData | null) => {
  const [syncState, setSyncState] = useState<RouteSync>({
    lastRouteUpdate: null,
    hasRouteChanged: false,
    isChecking: false,
    newRouteData: null
  });
  
  const { getTruckByPlate } = useMobile();

  // ✅ MELHORADO: Verificação inteligente de mudanças
  const hasSignificantRouteChanges = useCallback((oldRoute: any, newRoute: any) => {
    if (!oldRoute || !newRoute) return true;
    
    // Verificar se é apenas atualização de timestamp vs mudança estrutural
    const oldPointIds = new Set(oldRoute.points?.map((p: any) => p.id) || []);
    const newPointIds = new Set(newRoute.points?.map((p: any) => p.id) || []);
    
    // Mudança no número de pontos
    if (oldRoute.points?.length !== newRoute.points?.length) {
      console.log(`🔍 [ROUTE SYNC] Mudança estrutural: pontos ${oldRoute.points?.length} → ${newRoute.points?.length}`);
      return true;
    }
    
    // Pontos adicionados ou removidos
    const hasNewPoints = newRoute.points?.some((p: any) => !oldPointIds.has(p.id));
    const hasRemovedPoints = oldRoute.points?.some((p: any) => !newPointIds.has(p.id));
    
    if (hasNewPoints || hasRemovedPoints) {
      console.log(`🔍 [ROUTE SYNC] Mudança estrutural: pontos alterados`);
      return true;
    }
    
    // Mudança na ordem dos pontos
    const oldOrder = oldRoute.points?.map((p: any) => p.id).join(',') || '';
    const newOrder = newRoute.points?.map((p: any) => p.id).join(',') || '';
    
    if (oldOrder !== newOrder) {
      console.log(`🔍 [ROUTE SYNC] Mudança estrutural: reordenação dos pontos`);
      return true;
    }
    
    // ✅ NOVO: Verificar mudanças nos endereços, tipo de operação ou categoria
    const fieldChanges = newRoute.points?.some((newPoint: any) => {
      const oldPoint = oldRoute.points?.find((p: any) => p.id === newPoint.id);
      if (!oldPoint) return false;
      return (
        oldPoint.address !== newPoint.address ||
        oldPoint.operation_type !== newPoint.operation_type ||
        oldPoint.point_category !== newPoint.point_category ||
        oldPoint.recolhido_qty !== newPoint.recolhido_qty
      );
    });

    if (fieldChanges) {
      console.log(`🔍 [ROUTE SYNC] Mudança estrutural: campos operacionais alterados`);
      return true;
    }

    // ✅ IGNORAR: Apenas mudanças de completed/completedAt (progresso local)
    console.log(`🔍 [ROUTE SYNC] Apenas mudanças de progresso - mantendo estado local`);
    return false;
  }, []);

  const checkForRouteUpdates = useCallback(async () => {
    if (!truckData?.plate || !truckData.currentRoute) {
      console.log('🔄 [ROUTE SYNC] Sem dados para verificar atualizações');
      return;
    }

    try {
      setSyncState(prev => ({ ...prev, isChecking: true }));
      
      console.log(`🔄 [ROUTE SYNC] Verificando atualizações para ${truckData.plate}`);
      
      // ✅ MELHORADO: Cache local para evitar verificações desnecessárias
      const cacheKey = `route-sync-${truckData.plate}`;
      const lastCheck = localStorage.getItem(cacheKey);
      const now = Date.now();
      
      // Verificar apenas a cada 10 segundos
      if (lastCheck && (now - parseInt(lastCheck)) < 10000) {
        console.log('🔄 [ROUTE SYNC] Cache válido, pulando verificação');
        return;
      }
      
      const updatedTruckData = await getTruckByPlate(truckData.plate);
      
      // Atualizar cache
      localStorage.setItem(cacheKey, now.toString());
      
      if (updatedTruckData.currentRoute?.lastUpdated) {
        const currentLastUpdate = truckData.currentRoute.lastUpdated;
        const newLastUpdate = updatedTruckData.currentRoute.lastUpdated;
        
        console.log(`📅 [ROUTE SYNC] Comparando timestamps:`);
        console.log(`📅 [ROUTE SYNC] Local: ${currentLastUpdate}`);
        console.log(`📅 [ROUTE SYNC] Servidor: ${newLastUpdate}`);
        
        // Verificar se houve atualização no servidor
        if (currentLastUpdate && newLastUpdate && newLastUpdate > currentLastUpdate) {
          console.log('🔄 [ROUTE SYNC] Atualização detectada no servidor');
          
          // ✅ VERIFICAR SE SÃO MUDANÇAS SIGNIFICATIVAS
          const hasRealChanges = hasSignificantRouteChanges(
            truckData.currentRoute, 
            updatedTruckData.currentRoute
          );
          
          if (hasRealChanges) {
            console.log('🔄 [ROUTE SYNC] ✅ Mudanças estruturais detectadas - notificando usuário');
            
            setSyncState(prev => ({
              ...prev,
              lastRouteUpdate: newLastUpdate,
              hasRouteChanged: true,
              newRouteData: updatedTruckData
            }));
          } else {
            console.log('🔄 [ROUTE SYNC] ℹ️ Apenas mudanças de progresso - mantendo estado local');
            
            // ✅ MESCLAR: Manter progresso local, atualizar estrutura se necessário
            const mergedRoute = {
              ...updatedTruckData.currentRoute,
              lastUpdated: newLastUpdate,
              points: updatedTruckData.currentRoute.points.map((serverPoint: any) => {
                const localPoint = truckData.currentRoute!.points.find(p => p.id === serverPoint.id);
                
                // Manter progresso local se existir
                if (localPoint) {
                  return {
                    ...serverPoint,
                    completed: localPoint.completed,
                    completedAt: localPoint.completedAt
                  };
                }
                
                return serverPoint;
              })
            };
            
            // Atualizar silenciosamente sem notificação
            setSyncState(prev => ({
              ...prev,
              lastRouteUpdate: newLastUpdate,
              newRouteData: {
                ...updatedTruckData,
                currentRoute: mergedRoute
              }
            }));
          }
        } else {
          console.log('🔄 [ROUTE SYNC] ℹ️ Nenhuma atualização no servidor');
        }
      }
      
    } catch (error) {
      console.error('❌ [ROUTE SYNC] Erro ao verificar atualizações:', error);
    } finally {
      setSyncState(prev => ({ ...prev, isChecking: false }));
    }
  }, [truckData?.plate, truckData?.currentRoute, getTruckByPlate, hasSignificantRouteChanges]);

  // ✅ OTIMIZADO: Verificação automática menos frequente
  useEffect(() => {
    if (!truckData?.currentRoute) return;
    
    // Verificar a cada 20 segundos quando app está ativo (sincronização quase em tempo real)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkForRouteUpdates();
      }
    }, 20000); // 20 segundos
    
    // Verificar quando app volta a ficar visível
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(checkForRouteUpdates, 1000); // Delay de 1s
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForRouteUpdates]);

  const acceptRouteUpdate = useCallback((newData: TruckMobileData) => {
    console.log(`✅ [ROUTE SYNC] Aceitando atualização da rota (preservando pontos concluídos)`);

    // Proteger pontos já concluídos: manter completed/completedAt locais
    let merged = newData;
    if (newData?.currentRoute && truckData?.currentRoute) {
      merged = {
        ...newData,
        currentRoute: {
          ...newData.currentRoute,
          points: newData.currentRoute.points.map((serverPoint: any) => {
            const localPoint = truckData.currentRoute!.points.find(p => p.id === serverPoint.id);
            if (localPoint?.completed) {
              return {
                ...serverPoint,
                completed: true,
                completedAt: localPoint.completedAt,
              };
            }
            return serverPoint;
          }),
        },
      };
    }

    setSyncState(prev => ({
      ...prev,
      hasRouteChanged: false,
      newRouteData: null,
    }));

    return merged;
  }, [truckData]);

  const dismissRouteUpdate = useCallback(() => {
    console.log(`❌ [ROUTE SYNC] Dispensando atualização da rota`);
    
    setSyncState(prev => ({ 
      ...prev, 
      hasRouteChanged: false,
      newRouteData: null
    }));
  }, []);

  return {
    ...syncState,
    checkForRouteUpdates,
    acceptRouteUpdate,
    dismissRouteUpdate
  };
};
