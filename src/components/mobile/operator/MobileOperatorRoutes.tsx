import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Navigation, MapPin, Eye, Edit, Trash2, RotateCcw, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRoutes } from '@/hooks/useRoutes';
import { useRoutesCRUD } from '@/hooks/useRoutesCRUD';
import { toast } from 'sonner';
import MobileOperatorHeader from './MobileOperatorHeader';
import MobileFrame from '@/mobile/MobileFrame';
import MobileOperatorNav from './MobileOperatorNav';
import RouteMapPreview from '@/components/RouteMapPreview';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/lib/confirm';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const MobileOperatorRoutes = () => {
  const navigate = useNavigate();
  const [viewingRoute, setViewingRoute] = useState<any>(null);
  
  const { routes, loading, loadRoutes } = useRoutes();
  const { deleteRoute, updateRoute, resetRoute, optimizeRoute, isLoading } = useRoutesCRUD();

  const handleNewRoute = () => {
    navigate('/routes/create');
  };

  const handleEdit = (route: any) => {
    if (route.status === 'completed') {
      toast.error('Não é possível editar uma rota concluída');
      return;
    }
    navigate(`/routes/edit?edit=${route.id}`);
  };

  const handleDelete = async (id: string) => {
    if ((await confirmDialog({ description: 'Tem certeza que deseja excluir esta rota?', destructive: true }))) {
      try {
        await deleteRoute(id);
        toast.success('Rota excluída!');
        loadRoutes();
        setViewingRoute(null);
      } catch (error: any) {
        toast.error('Erro ao excluir rota');
      }
    }
  };

  const handleReactivate = async (route: any) => {
    try {
      await updateRoute({ id: route.id, route: { status: 'active' } });
      toast.success('Rota reativada!');
      loadRoutes();
    } catch (error) {
      toast.error('Erro ao reativar rota');
    }
  };

  const handleReset = async (route: any) => {
    if ((await confirmDialog({ description: `Resetar a rota "${route.name}"?`, destructive: true }))) {
      try {
        await resetRoute(route.id);
        toast.success('Rota resetada!');
        loadRoutes();
      } catch (error: any) {
        toast.error('Erro ao resetar rota');
      }
    }
  };

  const getStatusBadge = (status: string, optimizationMode?: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      active: { label: 'Ativa', className: 'bg-green-100 text-green-700 border-green-200' },
      inactive: { label: 'Inativa', className: 'bg-gray-100 text-gray-700 border-gray-200' },
      completed: { label: 'Concluída', className: 'bg-blue-100 text-blue-700 border-blue-200' }
    };

    const statusInfo = statusConfig[status] || statusConfig.active;

    return (
      <div className="flex gap-1.5 flex-wrap">
        <Badge className={cn("text-xs border", statusInfo.className)}>
          {statusInfo.label}
        </Badge>
        {optimizationMode === 'fixed' && (
          <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 border">
            🔒 Fixa
          </Badge>
        )}
        {optimizationMode === 'optimized' && (
          <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 border">
            ✨ Otimizada
          </Badge>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <MobileFrame title="Rotas">
        <div className="flex-1 flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Carregando…</p>
          </div>
        </div>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame title="Rotas">
      <div className="overflow-auto">
        <div className="p-4 space-y-3">
          {routes.length === 0 ? (
            <div className="text-center py-12">
              <Navigation className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Nenhuma rota
              </h3>
              <p className="text-gray-500 mb-6">Crie sua primeira rota</p>
              <Button onClick={handleNewRoute} className="bg-blue-600">
                <Plus className="h-4 w-4 mr-2" />
                Nova Rota
              </Button>
            </div>
          ) : (
            routes.map((route) => (
              <Card 
                key={route.id} 
                className="overflow-hidden active:bg-gray-50"
                onClick={() => setViewingRoute(route)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Navigation className="h-4 w-4 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 line-clamp-1">
                        {route.name}
                      </h3>
                    </div>
                    {getStatusBadge(route.status, route.optimizationMode)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mt-3">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>{route.points?.length || 0} pontos</span>
                    </div>
                    {route.totalDistance && (
                      <div className="flex items-center gap-1">
                        <span>📏</span>
                        <span>{route.totalDistance.toFixed(1)} km</span>
                      </div>
                    )}
                    {route.estimatedTime && (
                      <div className="flex items-center gap-1">
                        <span>⏱️</span>
                        <span>{route.estimatedTime}</span>
                      </div>
                    )}
                  </div>

                  {route.points && route.points.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-start gap-2 text-xs text-gray-500">
                        <MapPin className="h-3 w-3 mt-0.5 text-gray-400" />
                        <span className="line-clamp-1">{route.points[0]?.address}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* FAB */}
      <Button
        className="fixed right-4 bottom-24 z-30 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
        onClick={handleNewRoute}
      >
        <Plus className="h-6 w-6" />
      </Button>

      

      {/* Route Detail Sheet */}
      <Sheet open={!!viewingRoute} onOpenChange={(open) => !open && setViewingRoute(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-blue-600" />
              {viewingRoute?.name}
            </SheetTitle>
          </SheetHeader>

          {viewingRoute && (
            <div className="flex flex-col h-[calc(85vh-4rem)] overflow-hidden">
              {/* Map Preview */}
              <div className="h-48 -mx-6 mb-4">
                <RouteMapPreview route={viewingRoute} />
              </div>

              {/* Info */}
              <div className="flex gap-2 mb-4">
                {getStatusBadge(viewingRoute.status, viewingRoute.optimizationMode)}
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-gray-500 text-xs">Pontos</p>
                  <p className="font-semibold">{viewingRoute.points?.length || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-gray-500 text-xs">Distância</p>
                  <p className="font-semibold">{viewingRoute.totalDistance?.toFixed(1) || 0} km</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-gray-500 text-xs">Tempo</p>
                  <p className="font-semibold">{viewingRoute.estimatedTime || '-'}</p>
                </div>
              </div>

              {/* Points list */}
              <div className="flex-1 overflow-auto -mx-6 px-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Pontos da Rota</h4>
                <div className="space-y-2">
                  {viewingRoute.points?.map((point: any, index: number) => (
                    <div 
                      key={point.id || index}
                      className="flex items-start gap-2 text-sm p-2 bg-gray-50 rounded-lg"
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                        index === 0 ? "bg-green-100 text-green-700" :
                        index === viewingRoute.points.length - 1 ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 text-xs line-clamp-2">{point.address}</p>
                        {point.customerName && (
                          <p className="text-gray-500 text-xs mt-0.5">{point.customerName}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t mt-4 -mx-6 px-6 pb-2">
                {viewingRoute.status === 'completed' ? (
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={() => handleReactivate(viewingRoute)}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reativar
                  </Button>
                ) : (
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={() => handleEdit(viewingRoute)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                )}
                <Button 
                  className="flex-1" 
                  variant="outline"
                  onClick={() => handleReset(viewingRoute)}
                  disabled={isLoading}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetar
                </Button>
                <Button 
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => handleDelete(viewingRoute.id)}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </MobileFrame>
  );
};

export default MobileOperatorRoutes;
