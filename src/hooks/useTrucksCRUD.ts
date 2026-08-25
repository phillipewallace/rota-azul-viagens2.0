
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck } from './useTrucks';
import { trucksService } from '@/services/trucks';

export const useTrucksCRUD = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (truck: Omit<Truck, 'id'>) => {
      return trucksService.createTruck(truck);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, truck }: { id: string; truck: Partial<Truck> }) => {
      return trucksService.updateTruck(id, truck);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`https://alchemyrotas.com/api/trucks/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Erro ao excluir caminhão');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
  });

  return {
    createTruck: createMutation.mutateAsync,
    updateTruck: updateMutation.mutateAsync,
    deleteTruck: deleteMutation.mutateAsync,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
};
