
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trucksService } from '@/services/trucks';

export interface Truck {
  id: string;
  name: string;
  plate: string;
  model: string;
  year: number;
  status: 'available' | 'in-route' | 'maintenance';
  currentRoute?: string;
  currentRouteName?: string;
  driver?: string;
  driverName?: string;
  lastMaintenance: string;
  mileage: number;
  location?: {
    lat: number;
    lng: number;
  };
}

export const useTrucks = () => {
  const queryClient = useQueryClient();

  const { 
    data: trucks = [], 
    isLoading: loading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['trucks'],
    queryFn: () => trucksService.getTrucks(),
    refetchInterval: 30000,
    retry: 2,
    staleTime: 25000,
  });

  const updateLocationMutation = useMutation({
    mutationFn: ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) =>
      trucksService.updateTruckLocation(truckId, lat, lng),
    onSuccess: (_, { truckId, lat, lng }) => {
      queryClient.setQueryData(['trucks'], (oldData: Truck[] | undefined) => {
        if (!oldData || !Array.isArray(oldData)) return [];
        return oldData.map(truck => 
          truck.id === truckId 
            ? { ...truck, location: { lat, lng } }
            : truck
        );
      });
    },
    onError: (error) => {
      console.error('Error updating truck location:', error);
    }
  });

  const updateTruckLocation = (truckId: string, lat: number, lng: number) => {
    if (!truckId || typeof lat !== 'number' || typeof lng !== 'number') {
      console.error('Invalid parameters for updateTruckLocation');
      return;
    }
    updateLocationMutation.mutate({ truckId, lat, lng });
  };

  const loadTrucks = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['trucks'] });
    } catch (error) {
      console.error('Error reloading trucks:', error);
    }
  };

  return {
    trucks: Array.isArray(trucks) ? trucks : [],
    loading,
    error: error ? 'Erro ao carregar caminhões' : null,
    loadTrucks,
    updateTruckLocation,
    refetch,
    isUpdatingLocation: updateLocationMutation.isPending
  };
};
