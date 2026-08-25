import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTrucks } from '@/hooks/useTrucks';
import { Truck } from '@/hooks/useTrucks';
import { BaseApiService } from '@/services/base';
import { API_CONFIG } from '@/services/config';
import { RefreshCw, Loader2 } from 'lucide-react';

interface Route {
  id: string;
  name: string;
  description?: string;
  points: any[];
  totalDistance: number;
  status: string;
}

interface LinkRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  truck?: Truck | null;
  onSuccess?: () => void;
}

class LinkRouteService extends BaseApiService {
  async linkRoute(truckId: string, routeId: string): Promise<any> {
    return this.request('/trucks/link-route', {
      method: 'POST',
      body: JSON.stringify({
        truckId,
        routeId,
      }),
    });
  }
}

const linkRouteService = new LinkRouteService();

export const LinkRouteModal: React.FC<LinkRouteModalProps> = ({
  open,
  onOpenChange,
  truck,
  onSuccess
}) => {
  const { toast } = useToast();
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Estado local para rotas (sempre buscar fresco)
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);

  const { trucks, loading: trucksLoading, refetch: refetchTrucks } = useTrucks();

  // ✅ BUSCAR ROTAS SEMPRE QUE O MODAL ABRIR
  const fetchRoutes = useCallback(async () => {
    setRoutesLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/routes`);
      if (!response.ok) throw new Error('Erro ao buscar rotas');
      const data = await response.json();
      setRoutes(data);
      console.log('✅ [LINK MODAL] Rotas carregadas:', data.length);
    } catch (error) {
      console.error('❌ [LINK MODAL] Erro ao buscar rotas:', error);
      toast({
        title: "Erro ao carregar rotas",
        description: "Não foi possível buscar as rotas disponíveis.",
        variant: "destructive"
      });
    } finally {
      setRoutesLoading(false);
    }
  }, [toast]);

  // Carregar rotas quando modal abrir
  useEffect(() => {
    if (open) {
      fetchRoutes();
      setSelectedTruck(truck?.id || '');
      setSelectedRoute('');
    } else {
      setSelectedTruck('');
      setSelectedRoute('');
    }
  }, [open, truck, fetchRoutes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruck || !selectedRoute) {
      toast({
        title: "Seleção incompleta",
        description: "Selecione um caminhão e uma rota.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await linkRouteService.linkRoute(selectedTruck, selectedRoute);

      const truckData = trucks?.find(t => t.id === selectedTruck);
      const routeData = routes?.find(r => r.id === selectedRoute);

      toast({
        title: "Rota vinculada com sucesso!",
        description: `${truckData?.name} foi vinculado à ${routeData?.name}. O veículo está pronto para iniciar a jornada.`,
      });

      // Refresh trucks data
      if (refetchTrucks) {
        await refetchTrucks();
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error linking route:', error);
      toast({
        title: "Erro ao vincular rota",
        description: error.message || "Tente novamente ou verifique se os dados estão corretos.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const availableTrucks = trucks?.filter(truck => truck.status === 'available') || [];
  const activeRoutes = routes?.filter(route => route.status === 'active') || [];

  const formatDistance = (distance: any): string => {
    if (distance === null || distance === undefined) return '0';
    const numDistance = typeof distance === 'string' ? parseFloat(distance) : distance;
    return isNaN(numDistance) ? '0' : numDistance.toFixed(1);
  };

  const formatPointCount = (points: any): number => {
    if (!points) return 0;
    if (Array.isArray(points)) return points.length;
    if (typeof points === 'string') {
      try {
        const parsed = JSON.parse(points);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Vincular Rota ao Caminhão</DialogTitle>
          <DialogDescription>
            Selecione um caminhão disponível e uma rota ativa para criar a vinculação.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="truck">Selecionar Caminhão</Label>
            <SearchableSelect
              value={selectedTruck}
              onValueChange={setSelectedTruck}
              disabled={trucksLoading || isLoading}
              placeholder={trucksLoading ? "Carregando..." : "Escolha um caminhão"}
              searchPlaceholder="Buscar caminhão..."
              options={availableTrucks.map((t) => ({
                value: t.id,
                label: `${t.name} - ${t.plate}`,
                hint: 'Disponível',
              }))}
            />
            {availableTrucks.length === 0 && !trucksLoading && (
              <p className="text-sm text-gray-500 mt-1">Nenhum caminhão disponível</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="route">Selecionar Rota</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={fetchRoutes}
                disabled={routesLoading}
                className="h-7 px-2 text-xs"
              >
                {routesLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                <span className="ml-1">Atualizar</span>
              </Button>
            </div>
            <SearchableSelect
              value={selectedRoute}
              onValueChange={setSelectedRoute}
              disabled={routesLoading || isLoading}
              placeholder={routesLoading ? "Carregando..." : "Escolha uma rota"}
              searchPlaceholder="Buscar rota..."
              options={activeRoutes.map((r) => ({
                value: r.id,
                label: r.name,
                hint: `${formatPointCount(r.points)} pts · ${formatDistance(r.totalDistance)}km`,
              }))}
            />
            {activeRoutes.length === 0 && !routesLoading && (
              <p className="text-sm text-gray-500 mt-1">Nenhuma rota ativa disponível</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!selectedTruck || !selectedRoute || isLoading}>
              {isLoading ? 'Vinculando...' : 'Vincular Rota'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LinkRouteModal;
