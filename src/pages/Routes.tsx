
import React, { useState } from 'react';
import { Plus, Edit, Trash2, MapPin, Navigation, Eye, ArrowLeft, RefreshCw, RotateCcw, Copy, CheckSquare, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from 'react-router-dom';
import { useRoutes } from '@/hooks/useRoutes';
import { useRoutesCRUD } from '@/hooks/useRoutesCRUD';
import RouteMapPreview from '@/components/RouteMapPreview';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileOperatorRoutes from '@/components/mobile/operator/MobileOperatorRoutes';

import { confirmDialog } from '@/lib/confirm';
const Routes = () => {
  const isMobile = useIsMobile();
  
  // Return mobile version for operator
  if (isMobile) {
    return <MobileOperatorRoutes />;
  }

  return <DesktopRoutes />;
};

const DesktopRoutes = () => {
  const navigate = useNavigate();
  const [viewingRoute, setViewingRoute] = useState<any>(null);
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const { routes, loading, loadRoutes } = useRoutes();
  const { deleteRoute, updateRoute, resetRoute, optimizeRoute, isLoading } = useRoutesCRUD();

  const handleEdit = (route: any) => {
    if (route.status === 'completed') {
      toast.error('Não é possível editar uma rota concluída');
      return;
    }
    console.log('🔧 [ROUTES PAGE] Abrindo rota para edição:', route.name);
    navigate(`/routes/edit?edit=${route.id}`);
  };

  const handleDelete = async (id: string) => {
    if ((await confirmDialog({ description: 'Tem certeza que deseja excluir esta rota? Isso também removerá todos os agendamentos relacionados.', destructive: true }))) {
      try {
        console.log('🗑️ [ROUTES PAGE] Excluindo rota:', id);
        await deleteRoute(id);
        toast.success('Rota excluída com sucesso!');
        loadRoutes();
      } catch (error: any) {
        console.error('Error deleting route:', error);
        if (error.message?.includes('foreign key') || error.message?.includes('chave estrangeira')) {
          toast.error('Não é possível excluir esta rota pois ela possui agendamentos vinculados. Remova os agendamentos primeiro.');
        } else {
          toast.error('Erro ao excluir rota');
        }
      }
    }
  };

  const handleReactivate = async (route: any) => {
    try {
      console.log('♻️ [ROUTES PAGE] Reativando rota:', route.name);
      await updateRoute({ id: route.id, route: { status: 'active' } });
      toast.success('Rota reativada com sucesso!');
      loadRoutes();
    } catch (error) {
      console.error('Error reactivating route:', error);
      toast.error('Erro ao reativar rota');
    }
  };

  // ✅ ÚNICO PONTO AUTORIZADO DE RESET - Via botão específico
  const handleReset = async (route: any) => {
    if ((await confirmDialog({ description: `Tem certeza que deseja resetar a rota "${route.name}"? TODOS os pontos concluídos serão marcados como não concluídos.`, destructive: true }))) {
      try {
        console.log('🔄 [ROUTES PAGE] Resetando rota via botão reset:', route.name);
        await resetRoute(route.id);
        toast.success('Rota resetada com sucesso! Todos os pontos foram marcados como não concluídos.');
        loadRoutes();
      } catch (error: any) {
        console.error('Error resetting route:', error);
        toast.error(error.message || 'Erro ao resetar rota');
      }
    }
  };

  // ✅ NOVO: Handler para otimizar rota manualmente
  const handleOptimize = async (route: any) => {
    if (route.optimizationMode === 'optimized') {
      toast.info('Esta rota já está otimizada');
      return;
    }
    
    if ((await confirmDialog({ description: `Tem certeza que deseja otimizar a rota "${route.name}"? Isso reorganizará os pontos intermediários para a melhor sequência.`, destructive: true }))) {
      try {
        console.log('🔄 [ROUTES PAGE] Otimizando rota:', route.name);
        await optimizeRoute(route.id);
        toast.success('Rota otimizada com sucesso!');
        loadRoutes();
      } catch (error: any) {
        console.error('Error optimizing route:', error);
        toast.error(error.message || 'Erro ao otimizar rota');
      }
    }
  };

  const handleView = (route: any) => {
    setViewingRoute(route);
    setSelectedPoints(new Set());
    setSelectionMode(false);
  };

  // Toggle seleção de ponto para cópia
  const togglePointSelection = (pointId: string) => {
    setSelectedPoints(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pointId)) {
        newSet.delete(pointId);
      } else {
        newSet.add(pointId);
      }
      return newSet;
    });
  };

  // Selecionar/desselecionar todos os pontos
  const toggleSelectAll = () => {
    if (!viewingRoute?.points) return;
    
    if (selectedPoints.size === viewingRoute.points.length) {
      setSelectedPoints(new Set());
    } else {
      const allIds = viewingRoute.points.map((p: any) => p.id);
      setSelectedPoints(new Set(allIds));
    }
  };

  // Criar nova rota com pontos selecionados
  const handleCopyPointsToNewRoute = () => {
    if (selectedPoints.size === 0) {
      toast.error('Selecione ao menos um ponto para copiar');
      return;
    }

    if (!viewingRoute?.points) return;

    // Filtrar e ordenar pontos selecionados COM TODOS OS CAMPOS
    const pointsToCopy = viewingRoute.points
      .filter((p: any) => selectedPoints.has(p.id))
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .map((point: any, index: number) => ({
        address: point.address || '',
        lat: point.lat || 0,
        lng: point.lng || 0,
        cep: point.cep || '',
        // ✅ COPIAR TODOS OS CAMPOS OPERACIONAIS
        customerName: point.customerName || '',
        restroomsQty: point.restroomsQty !== undefined ? point.restroomsQty : undefined,
        cleaningsQty: point.cleaningsQty !== undefined ? point.cleaningsQty : undefined,
        contactName: point.contactName || '',
        contactPhone: point.contactPhone || '',
        notes: point.notes || point.observation || '',
        observation: point.observation || point.notes || '',
        stopType: point.stopType || '',
        order: index
      }));
    
    console.log('📋 [ROUTES] Copiando pontos com campos operacionais:', pointsToCopy);

    // Armazenar pontos no localStorage para a página de criação
    localStorage.setItem('copiedRoutePoints', JSON.stringify(pointsToCopy));
    localStorage.setItem('copiedFromRoute', viewingRoute.name);

    toast.success(`${pointsToCopy.length} ponto(s) copiado(s)! Abrindo criação de rota...`);
    
    // Fechar modal e navegar
    setViewingRoute(null);
    navigate('/routes/create?fromCopy=true');
  };

  const handleNewRoute = () => {
    console.log('➕ [ROUTES PAGE] Criando nova rota');
    navigate('/routes/create');
  };

  const getStatusBadge = (status: string, optimizationMode?: string) => {
    const statusConfig = {
      active: { 
        label: 'Ativa', 
        bgColor: 'bg-green-500/10',
        textColor: 'text-green-700',
        borderColor: 'border-green-200'
      },
      inactive: { 
        label: 'Inativa', 
        bgColor: 'bg-slate-500/10',
        textColor: 'text-slate-700',
        borderColor: 'border-slate-200'
      },
      completed: { 
        label: 'Concluída', 
        bgColor: 'bg-blue-500/10',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200'
      }
    };

    const modeConfig = {
      fixed: {
        icon: '🔒',
        label: 'Ordem Fixa',
        tooltip: 'Os pontos seguem exatamente a sequência definida',
        bgColor: 'bg-amber-500/10',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200'
      },
      optimized: {
        icon: '✨',
        label: 'Otimizada',
        tooltip: 'Os pontos são reorganizados automaticamente',
        bgColor: 'bg-blue-500/10',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200'
      }
    };

    const statusInfo = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    const modeInfo = optimizationMode ? modeConfig[optimizationMode as keyof typeof modeConfig] : null;

    return (
      <div className="flex flex-wrap gap-1.5">
        <Badge 
          className={`${statusInfo.bgColor} ${statusInfo.textColor} ${statusInfo.borderColor} border backdrop-blur-sm font-medium px-2.5 py-1 text-xs shadow-sm`}
        >
          {statusInfo.label}
        </Badge>
        {modeInfo && (
          <Badge 
            className={`${modeInfo.bgColor} ${modeInfo.textColor} ${modeInfo.borderColor} border backdrop-blur-sm font-medium px-2.5 py-1 text-xs shadow-sm`}
            title={modeInfo.tooltip}
          >
            <span className="mr-1">{modeInfo.icon}</span>
            {modeInfo.label}
          </Badge>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando rotas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rotas</h1>
              <p className="text-gray-600 mt-2">Gerencie as rotas do sistema</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={handleNewRoute}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Rota
            </Button>
          </div>
        </div>

        {/* Lista de Rotas */}
        {routes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Navigation className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma rota encontrada</h3>
              <p className="text-gray-600 mb-6">Comece criando sua primeira rota</p>
              <Button onClick={handleNewRoute}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Rota
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => (
              <Card key={route.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                  <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center gap-2.5 text-slate-900">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Navigation className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="font-bold">{route.name}</span>
                    </CardTitle>
                    {getStatusBadge(route.status, route.optimizationMode)}
                  </div>
                  {route.description && (
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">{route.description}</p>
                  )}
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Pontos</p>
                          <p className="font-semibold text-slate-900">{route.points?.length || 0}</p>
                        </div>
                      </div>
                      
                      {route.totalDistance && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                            <span className="text-green-600 font-semibold">📏</span>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Distância</p>
                            <p className="font-semibold text-slate-900">{route.totalDistance.toFixed(1)} km</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {route.estimatedTime && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                        <span className="text-amber-600">⏱️</span>
                        <div className="flex-1">
                          <p className="text-xs text-amber-700 font-medium">Tempo estimado</p>
                          <p className="text-sm text-amber-900 font-semibold">{route.estimatedTime}</p>
                        </div>
                      </div>
                    )}

                    {route.points && route.points.length > 0 && (
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-700 mb-2.5">Principais pontos</p>
                        <div className="space-y-2">
                          {route.points.slice(0, 2).map((point, index) => (
                            <div key={`${route.id}-point-${index}`} className="flex items-start gap-2 text-xs">
                              <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <span className="text-slate-600 line-clamp-1">{point.address}</span>
                            </div>
                          ))}
                          {route.points.length > 2 && (
                            <p className="text-xs text-slate-500 pl-5">
                              +{route.points.length - 2} mais {route.points.length - 2 === 1 ? 'ponto' : 'pontos'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(route)}
                      className="hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                    >
                      <Eye className="h-4 w-4 mr-1.5" />
                      Ver
                    </Button>
                    {route.status === 'completed' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReactivate(route)}
                        className="hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors"
                        disabled={isLoading}
                      >
                        <RefreshCw className="h-4 w-4 mr-1.5" />
                        Reativar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(route)}
                        className="hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 transition-colors"
                      >
                        <Edit className="h-4 w-4 mr-1.5" />
                        Editar
                      </Button>
                    )}
                    {route.optimizationMode === 'fixed' && route.status !== 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOptimize(route)}
                        className="hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                        disabled={isLoading}
                        title="Otimizar rota"
                      >
                        <Navigation className="h-4 w-4 mr-1.5" />
                        Otimizar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReset(route)}
                      className="hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 transition-colors"
                      disabled={isLoading}
                      title="Resetar rota"
                    >
                      <RotateCcw className="h-4 w-4 mr-1.5" />
                      Resetar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(route.id)}
                      className="hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {viewingRoute && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Detalhes da Rota</h2>
                <div className="flex gap-2">
                  {selectionMode && selectedPoints.size > 0 && (
                    <Button 
                      onClick={handleCopyPointsToNewRoute}
                      className="bg-green-600 hover:bg-green-700 gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Criar rota com {selectedPoints.size} ponto(s)
                    </Button>
                  )}
                  <Button 
                    variant={selectionMode ? "default" : "outline"}
                    onClick={() => {
                      setSelectionMode(!selectionMode);
                      if (!selectionMode) setSelectedPoints(new Set());
                    }}
                    className="gap-2"
                  >
                    {selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    {selectionMode ? 'Cancelar seleção' : 'Selecionar pontos'}
                  </Button>
                  <Button variant="outline" onClick={() => setViewingRoute(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{viewingRoute.name}</h3>
                    {viewingRoute.description && (
                      <p className="text-gray-600">{viewingRoute.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium">Status:</p>
                      {getStatusBadge(viewingRoute.status, viewingRoute.optimizationMode)}
                    </div>
                    <div>
                      <p className="font-medium">Total de Pontos:</p>
                      <p>{viewingRoute.points?.length || 0}</p>
                    </div>
                    {viewingRoute.totalDistance && (
                      <div>
                        <p className="font-medium">Distância Total:</p>
                        <p>{viewingRoute.totalDistance.toFixed(2)} km</p>
                      </div>
                    )}
                    {viewingRoute.estimatedTime && (
                      <div>
                        <p className="font-medium">Tempo Estimado:</p>
                        <p>{viewingRoute.estimatedTime}</p>
                      </div>
                    )}
                  </div>

                  {viewingRoute.points && viewingRoute.points.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">Pontos da Rota:</h4>
                        {selectionMode && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={toggleSelectAll}
                            className="text-sm"
                          >
                            {selectedPoints.size === viewingRoute.points.length ? 'Desselecionar todos' : 'Selecionar todos'}
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {viewingRoute.points
                          .sort((a: any, b: any) => a.order - b.order)
                          .map((point: any, index: number) => (
                          <div 
                            key={`${viewingRoute.id}-detail-point-${point.id || index}`} 
                            className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer ${
                              selectionMode && selectedPoints.has(point.id) 
                                ? 'bg-blue-50 border-blue-300' 
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => selectionMode && togglePointSelection(point.id)}
                          >
                            {selectionMode && (
                              <Checkbox
                                checked={selectedPoints.has(point.id)}
                                onCheckedChange={() => togglePointSelection(point.id)}
                                className="h-5 w-5"
                              />
                            )}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                              point.type === 'origin' ? 'bg-green-500' :
                              point.type === 'destination' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{point.customerName || point.address}</p>
                              {point.customerName && (
                                <p className="text-sm text-gray-500">{point.address}</p>
                              )}
                              <p className="text-sm text-gray-600 capitalize">{point.type}</p>
                              {point.cep && <p className="text-xs text-gray-400">CEP: {point.cep}</p>}
                              {(point.restroomsQty || point.cleaningsQty) && (
                                <p className="text-xs text-gray-500">
                                  {point.restroomsQty && `🚿 ${point.restroomsQty}`}
                                  {point.cleaningsQty && ` 🧹 ${point.cleaningsQty}`}
                                </p>
                              )}
                              {point.completed && (
                                <p className="text-xs text-green-600 font-medium">✅ Concluído</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {selectionMode && (
                        <p className="text-sm text-blue-600 mt-3 font-medium">
                          💡 Selecione os pontos que deseja copiar para uma nova rota
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-3">Preview da Rota:</h4>
                  <RouteMapPreview route={viewingRoute} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="h-20 md:hidden" />
    </div>
  );
};

export default Routes;
