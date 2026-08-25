/**
 * MobileDriver - Tela principal do app de motoristas
 * 
 * Funcionalidades:
 * - Login por placa do veículo
 * - Exibição da rota do dia vinculada ao caminhão
 * - Visualização e execução de paradas
 * - Integração com deep links de localização (WhatsApp)
 * - Persistência de estado entre sessões
 * 
 * IMPORTANTE: Mantém compatibilidade com drag & drop da StopsList
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from 'sonner';
import { Truck, LogOut, RefreshCw, MapPin, User, List, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '@/services/config';
import { useMobile, TruckMobileData } from '@/hooks/useMobile';
import { useRouteSync } from '@/hooks/useRouteSync';
import RouteUpdateNotification from '@/components/RouteUpdateNotification';
import RouteInfoCard from '@/components/RouteInfoCard';
import RouteExecutionCard from '@/components/RouteExecutionCard';
import { sharedLocationStore } from '@/store/sharedLocationStore';
import PhotoCaptureModal from '@/components/PhotoCaptureModal';
import RecolhimentoQtyModal from '@/components/RecolhimentoQtyModal';
import SanitarioNumberModal from '@/components/SanitarioNumberModal';
import { startBackgroundTracking, stopBackgroundTracking } from '@/services/backgroundLocation';
import { flushQueue } from '@/services/photoUpload';
import { movimentarSanitarios } from '@/services/sanitarios';

interface TruckData {
  id: string;
  name: string;
  plate: string;
  model: string;
}

const MobileDriver = () => {
  const navigate = useNavigate();
  const [plateNumber, setPlateNumber] = useState('');
  const [truckData, setTruckData] = useState<TruckData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullTruckData, setFullTruckData] = useState<TruckMobileData | null>(null);

  // V2 — modais de fluxo de conclusão
  const [pendingPoint, setPendingPoint] = useState<any | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [showNumberModal, setShowNumberModal] = useState(false);

  // Persistência de estado
  const [persistedState, setPersistedState] = useState<{
    isLoggedIn: boolean;
    plateNumber: string;
    truckData: TruckData | null;
    routeProgress: any;
  } | null>(null);

  const { getTruckByPlate, updateRoutePoint, finishRoute } = useMobile();
  const { hasRouteChanged, newRouteData, acceptRouteUpdate, dismissRouteUpdate, checkForRouteUpdates } = useRouteSync(fullTruckData);

  /**
   * Listener para compartilhamento de localização via deep link
   * Quando usuário abre localização do WhatsApp com o app, redireciona para criar parada
   */
  useEffect(() => {
    const handleSharedLocation = () => {
      if (isLoggedIn && fullTruckData?.currentRoute) {
        console.log('📍 [MOBILE DRIVER] Navegando para adicionar parada com localização');
        navigateToAddStop();
      }
    };

    // Escutar mudanças no store
    const unsubscribe = sharedLocationStore.subscribe((state) => {
      if (state.isFromShare && state.sharedContent) {
        console.log('📍 [MOBILE DRIVER] Store atualizado com compartilhamento');
        handleSharedLocation();
      }
    });

    // Escutar evento customizado do Android
    const handleSharedLocationEvent = (event: any) => {
      console.log('📍 [MOBILE DRIVER] Evento sharedLocation recebido:', event.detail);
      // Armazenar no store e então navegar
      if (event.detail) {
        sharedLocationStore.setSharedContent(event.detail);
        handleSharedLocation();
      }
    };
    window.addEventListener('sharedLocation', handleSharedLocationEvent);

    // Verificar se há conteúdo pendente de compartilhamento
    const checkPendingShare = () => {
      // Verificar store
      const sharedState = sharedLocationStore.getState();
      if (sharedState.isFromShare && sharedState.sharedContent) {
        console.log('📍 [MOBILE DRIVER] Conteúdo pendente no store');
        handleSharedLocation();
        return;
      }
      
      // Verificar pendingSharedLocation do Android
      const pendingLocation = (window as any).pendingSharedLocation;
      if (pendingLocation) {
        console.log('📍 [MOBILE DRIVER] Conteúdo pendente do Android:', pendingLocation);
        sharedLocationStore.setSharedContent(pendingLocation);
        delete (window as any).pendingSharedLocation;
        handleSharedLocation();
      }
    };

    if (isLoggedIn && fullTruckData?.currentRoute) {
      checkPendingShare();
    }

    return () => {
      unsubscribe();
      window.removeEventListener('sharedLocation', handleSharedLocationEvent);
    };
  }, [isLoggedIn, fullTruckData]);

  // Carregar estado persistido na inicialização
  useEffect(() => {
    const loadPersistedState = () => {
      try {
        const saved = localStorage.getItem('mobile-driver-state');
        if (saved) {
          const parsedState = JSON.parse(saved);
          console.log('📱 [MOBILE] Carregando estado persistido:', parsedState);
          
          setPersistedState(parsedState);
          
          if (parsedState.isLoggedIn && parsedState.plateNumber && parsedState.truckData) {
            setIsLoggedIn(true);
            setPlateNumber(parsedState.plateNumber);
            setTruckData(parsedState.truckData);
            
            // Recarregar dados completos do caminhão
            reloadTruckData(parsedState.plateNumber);
          }
        }
      } catch (error) {
        console.error('❌ [MOBILE] Erro ao carregar estado:', error);
        localStorage.removeItem('mobile-driver-state');
      }
    };

    loadPersistedState();
  }, []);

  // Persistir estado
  const persistState = (state: any) => {
    try {
      localStorage.setItem('mobile-driver-state', JSON.stringify(state));
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao persistir estado:', error);
    }
  };

  // Recarregar dados do caminhão
  const reloadTruckData = async (plate: string) => {
    try {
      const updatedData = await getTruckByPlate(plate);
      setFullTruckData(updatedData);
      
      // Preservar progresso da rota
      if (persistedState?.routeProgress && updatedData.currentRoute) {
        const mergedRoute = {
          ...updatedData.currentRoute,
          points: updatedData.currentRoute.points.map(point => {
            const savedProgress = persistedState.routeProgress[point.id];
            if (savedProgress) {
              return {
                ...point,
                completed: savedProgress.completed,
                completedAt: savedProgress.completedAt
              };
            }
            return point;
          })
        };
        
        setFullTruckData({
          ...updatedData,
          currentRoute: mergedRoute
        });
      }
      
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao recarregar dados:', error);
    }
  };

  const updateActiveTrackingInStorage = (truckId: string | null, isActive: boolean) => {
    try {
      const stored = localStorage.getItem('active-truck-tracking') || '[]';
      let activeTrucks = JSON.parse(stored);
      
      if (isActive && truckId && !activeTrucks.includes(truckId)) {
        activeTrucks.push(truckId);
      } else if (!isActive && truckId) {
        activeTrucks = activeTrucks.filter((id: string) => id !== truckId);
      }
      
      localStorage.setItem('active-truck-tracking', JSON.stringify(activeTrucks));
      
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'active-truck-tracking',
        newValue: JSON.stringify(activeTrucks)
      }));
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao atualizar rastreamento:', error);
    }
  };

  const handleLogin = async () => {
    if (!plateNumber.trim()) {
      setError('Por favor, insira o número da placa');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plateNumber}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
      });
      
      if (!response.ok) {
        throw new Error('Caminhão não encontrado');
      }

      const data = await response.json();
      
      setTruckData(data);
      setFullTruckData(data);
      setIsLoggedIn(true);
      
      // Persistir estado
      const stateToSave = {
        isLoggedIn: true,
        plateNumber,
        truckData: data,
        routeProgress: data.currentRoute ? 
          Object.fromEntries(
            data.currentRoute.points.map((p: any) => [
              p.id, 
              { completed: p.completed, completedAt: p.completedAt }
            ])
          ) : {}
      };
      persistState(stateToSave);
      
      updateActiveTrackingInStorage(data.id, true);
      toast.success(`Bem-vindo, ${data.name}!`);

      // Verificar se há conteúdo compartilhado pendente após login
      setTimeout(() => {
        const sharedState = sharedLocationStore.getState();
        if (sharedState.isFromShare && sharedState.sharedContent && data.currentRoute) {
          console.log('📍 [MOBILE] Redirecionando para adicionar parada após login');
          const pointsEncoded = encodeURIComponent(JSON.stringify(data.currentRoute.points));
          navigate(`/add-stop?routeId=${data.currentRoute.id}&truckId=${data.id}&points=${pointsEncoded}`);
        }
      }, 500);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (truckData?.id) {
      updateActiveTrackingInStorage(truckData.id, false);
    }
    
    localStorage.removeItem('mobile-driver-state');
    
    setIsLoggedIn(false);
    setTruckData(null);
    setFullTruckData(null);
    setPlateNumber('');
    setError(null);
    setPersistedState(null);
    
    toast.success('Logout realizado com sucesso');
  };

  /**
   * V2: Antes de marcar como concluído, exigir fotos (3 mín) e
   * — em recolhimento — abrir modal de quantidade.
   * Se uncomplete, faz direto.
   */
  const handlePointUpdate = async (pointId: string, completed: boolean) => {
    if (!fullTruckData?.id || !fullTruckData.currentRoute) return;
    const point = fullTruckData.currentRoute.points.find((p: any) => p.id === pointId);
    if (!point) return;

    if (!completed) {
      return commitPointUpdate(pointId, false);
    }

    const existingNumbers: string[] =
      (point as any).sanitario_numbers || (point as any).sanitarioNumbers || [];
    const hasNumbers = existingNumbers.length > 0;

    setPendingPoint(point);
    // Fluxo:
    //  recolhimento → Qty → (Numbers se necessário) → Photos
    //  manutenção → (Numbers se necessário) → Photos
    //  entrega → Numbers → Photos
    if (point.operationType === 'recolhimento') {
      setShowQtyModal(true);
    } else if (point.operationType === 'manutencao' && hasNumbers) {
      // já tem números registrados → pular modal e ir direto p/ fotos
      (point as any)._numeros = existingNumbers;
      setShowPhotoModal(true);
    } else {
      setShowNumberModal(true);
    }
  };

  const commitPointUpdate = async (
    pointId: string,
    completed: boolean,
    extra?: { recolhidoQty?: number; autoRemoved?: boolean }
  ) => {
    try {
      if (!fullTruckData?.id) return;
      await updateRoutePoint({
        truckId: fullTruckData.id,
        pointId,
        completed,
        ...(extra || {}),
      } as any);

      const updatedData = {
        ...fullTruckData,
        currentRoute: {
          ...fullTruckData.currentRoute!,
          points: fullTruckData.currentRoute!.points
            .map((p: any) =>
              p.id === pointId
                ? {
                    ...p,
                    completed,
                    completedAt: completed ? new Date().toISOString() : undefined,
                    recolhidoQty: extra?.recolhidoQty ?? p.recolhidoQty,
                    autoRemoved: extra?.autoRemoved ?? p.autoRemoved,
                  }
                : p
            )
            .filter((p: any) => !(p.autoRemoved === true)),
        },
      };
      setFullTruckData(updatedData);

      const routeProgress = Object.fromEntries(
        updatedData.currentRoute!.points.map((p: any) => [
          p.id,
          { completed: p.completed, completedAt: p.completedAt },
        ])
      );
      persistState({ isLoggedIn: true, plateNumber, truckData, routeProgress });
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao atualizar ponto:', error);
      toast.error('Erro ao atualizar ponto da rota');
    }
  };

  const handleFinishRoute = async () => {
    if (!fullTruckData?.id) return;
    try {
      await finishRoute(fullTruckData.id);
      await stopBackgroundTracking();
      setFullTruckData({ ...fullTruckData, currentRoute: null });
      persistState({ isLoggedIn: true, plateNumber, truckData, routeProgress: {} });
      toast.success('Rota finalizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao finalizar rota');
    }
  };

  // V2 — start background tracking enquanto houver rota ativa.
  // NÃO paramos no cleanup: o tracking só termina quando o motorista
  // finalizar a rota (handleFinishRoute) ou fizer logout.
  useEffect(() => {
    const routeId = fullTruckData?.currentRoute?.id;
    if (routeId) {
      startBackgroundTracking(routeId, fullTruckData?.id).then((ok) => {
        if (ok) console.log('[MOBILE] Rastreamento em background ativo');
      });
      flushQueue().catch(() => {});
    }
  }, [fullTruckData?.currentRoute?.id, fullTruckData?.id]);

  // Navegar para lista de paradas
  const navigateToStops = () => {
    if (fullTruckData?.currentRoute) {
      navigate('/stops', {
        state: {
          routeId: fullTruckData.currentRoute.id,
          truckId: fullTruckData.id,
          initialPoints: fullTruckData.currentRoute.points
        }
      });
    }
  };

  // Navegar para adicionar parada (usado pelo deep link)
  const navigateToAddStop = () => {
    if (fullTruckData?.currentRoute) {
      const pointsEncoded = encodeURIComponent(JSON.stringify(fullTruckData.currentRoute.points));
      navigate(`/add-stop?routeId=${fullTruckData.currentRoute.id}&truckId=${fullTruckData.id}&points=${pointsEncoded}`);
    }
  };

  // Tela de Login
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex flex-col">
        <div className="safe-top" />
        
        <div className="flex-1 flex items-center justify-center px-5 py-6">
          <Card className="w-full max-w-sm shadow-2xl border-0 overflow-hidden">
            {/* Header do card */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Alchemy Rotas</h1>
              <p className="text-blue-100 text-sm mt-1">Sistema de Gerenciamento de Rotas</p>
            </div>

            <CardContent className="p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                Acesso do Motorista
              </h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  <strong className="font-semibold">Erro:</strong> {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Placa do Veículo
                  </label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="ABC-1234"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                      disabled={loading}
                      className="pl-10 h-14 text-lg font-semibold text-center tracking-wider uppercase border-2 focus:border-blue-500"
                      maxLength={8}
                    />
                  </div>
                </div>

                <Button 
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                  onClick={handleLogin} 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-5">
                Insira a placa do seu veículo para acessar sua rota do dia
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="pb-safe" />
      </div>
    );
  }

  // Tela Principal (Logado)
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Área de conteúdo rolável */}
      <div className="flex-1 overflow-y-auto">
        <div className="safe-top" />
        
        <div className="w-full max-w-lg mx-auto p-4 space-y-4 pb-36">
          {/* Header do motorista */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{truckData?.name}</h2>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Truck className="h-4 w-4" />
                      <span className="font-semibold">{truckData?.plate}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => checkForRouteUpdates()}
                    title="Atualizar"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="icon"
                    onClick={handleLogout}
                    title="Sair"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notificação de atualização de rota */}
          {hasRouteChanged && newRouteData && (
            <RouteUpdateNotification
              onAccept={() => {
                const updatedData = acceptRouteUpdate(newRouteData);
                setFullTruckData(updatedData);
                
                const stateToSave = {
                  isLoggedIn: true,
                  plateNumber,
                  truckData,
                  routeProgress: updatedData.currentRoute ? 
                    Object.fromEntries(
                      updatedData.currentRoute.points.map((p: any) => [
                        p.id, 
                        { completed: p.completed, completedAt: p.completedAt }
                      ])
                    ) : {}
                };
                persistState(stateToSave);
              }}
              onDismiss={dismissRouteUpdate}
            />
          )}

          {/* Sem rota ativa */}
          {!fullTruckData?.currentRoute && (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">Nenhuma rota ativa</p>
                <p className="text-sm text-gray-400 mt-2">
                  Aguarde a atribuição de uma rota pelo administrador
                </p>
              </CardContent>
            </Card>
          )}

          {/* Card de Informações da Rota */}
          {fullTruckData?.currentRoute && (
            <RouteInfoCard
              routeName={fullTruckData.currentRoute.name}
              totalStops={fullTruckData.currentRoute.points?.length || 0}
              completedStops={fullTruckData.currentRoute.points?.filter(p => p.completed).length || 0}
              onViewStops={navigateToStops}
            />
          )}

          {/* Seção: Paradas da Rota */}
          {fullTruckData?.currentRoute && (
            <Card className="shadow-sm border-2 border-blue-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <List className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Paradas da Rota</h3>
                    <p className="text-sm text-gray-500">Veja e organize as paradas do seu dia</p>
                  </div>
                </div>
                
                <Button 
                  variant="outline"
                  className="w-full h-12 justify-between text-base font-medium border-2"
                  onClick={navigateToStops}
                >
                  <span>Ver lista completa de paradas</span>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Card de Execução da Rota */}
          {fullTruckData?.currentRoute && (
            <RouteExecutionCard
              points={fullTruckData.currentRoute.points}
              onPointComplete={handlePointUpdate}
              onFinishRoute={handleFinishRoute}
            />
          )}
        </div>
      </div>

      {/* Footer fixo */}
      {fullTruckData?.currentRoute && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-lg z-50">
          <div className="p-4 max-w-lg mx-auto">
            <Button 
              className="w-full h-14 text-lg font-bold shadow-md bg-blue-600 hover:bg-blue-700"
              onClick={navigateToStops}
            >
              <MapPin className="h-5 w-5 mr-2" />
              Ver Paradas ({fullTruckData.currentRoute.points?.length || 0})
            </Button>
          </div>
          <div className="pb-safe bg-white" />
        </div>
      )}

      {/* V2 — Modais de conclusão */}
      {pendingPoint && fullTruckData?.currentRoute && (
        <>
          <RecolhimentoQtyModal
            open={showQtyModal}
            totalQty={pendingPoint.restroomsQty || 1}
            onClose={() => {
              setShowQtyModal(false);
              setPendingPoint(null);
            }}
            onConfirm={(qty, autoRemove) => {
              setShowQtyModal(false);
              (pendingPoint as any)._recolhidoQty = qty;
              (pendingPoint as any)._autoRemoved = autoRemove;
              const existing: string[] =
                pendingPoint.sanitario_numbers || pendingPoint.sanitarioNumbers || [];
              // Se já temos números registrados e a qtd recolhida bate, pula o modal
              if (existing.length > 0 && existing.length === qty) {
                (pendingPoint as any)._numeros = existing;
                setShowPhotoModal(true);
              } else {
                setShowNumberModal(true);
              }
            }}
          />

          <SanitarioNumberModal
            open={showNumberModal}
            operationType={(pendingPoint.operationType as any) || 'entrega'}
            expectedQty={
              (pendingPoint.operationType === 'recolhimento'
                ? (pendingPoint as any)._recolhidoQty
                : pendingPoint.restroomsQty) || 1
            }
            initialNumbers={
              pendingPoint.operationType === 'recolhimento'
                ? (pendingPoint.sanitario_numbers || pendingPoint.sanitarioNumbers || [])
                : []
            }
            onClose={() => {
              setShowNumberModal(false);
              setPendingPoint(null);
            }}
            onConfirm={(numeros) => {
              (pendingPoint as any)._numeros = numeros;
              setShowNumberModal(false);
              setShowPhotoModal(true);
            }}
          />

          <PhotoCaptureModal
            open={showPhotoModal}
            routeId={fullTruckData.currentRoute.id}
            pointId={pendingPoint.id}
            operationType={(pendingPoint.operationType as any) || 'entrega'}
            minPhotos={3}
            onClose={() => {
              setShowPhotoModal(false);
              setPendingPoint(null);
            }}
            onConfirmed={async () => {
              setShowPhotoModal(false);
              const numeros: string[] = (pendingPoint as any)._numeros || [];
              const extra = {
                recolhidoQty: (pendingPoint as any)._recolhidoQty,
                autoRemoved: (pendingPoint as any)._autoRemoved,
              };
              try {
                if (numeros.length) {
                  await movimentarSanitarios({
                    numeros,
                    operationType: (pendingPoint.operationType as any) || 'entrega',
                    routeId: fullTruckData.currentRoute!.id,
                    routePointId: pendingPoint.id,
                    customerName: pendingPoint.customerName || pendingPoint.name,
                    address: pendingPoint.address,
                    lat: pendingPoint.lat,
                    lng: pendingPoint.lng,
                    truckId: fullTruckData.id,
                  });
                }
              } catch (e: any) {
                toast.error('Sanitários: ' + (e?.message || ''));
              }
              await commitPointUpdate(pendingPoint.id, true, extra);
              setPendingPoint(null);
            }}
          />
        </>
      )}
    </div>
  );
};

export default MobileDriver;
