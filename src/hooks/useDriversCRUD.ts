
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Driver } from './useDrivers';
import { BaseApiService } from '@/services/base';

export interface DriverDependencies {
  trucks: Array<{ id: string; name: string; plate: string }>;
  tripsCount: number;
  canDelete: boolean;
}

class DriversCRUDService extends BaseApiService {
  async createDriver(driver: Omit<Driver, 'id' | 'totalTrips' | 'truckCount'>): Promise<Driver> {
    return this.request<Driver>('/drivers', {
      method: 'POST',
      body: JSON.stringify(driver),
    });
  }

  async updateDriver(id: string, driver: Partial<Driver>): Promise<Driver> {
    return this.request<Driver>(`/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(driver),
    });
  }

  async checkDependencies(id: string): Promise<DriverDependencies> {
    return this.request<DriverDependencies>(`/drivers/${id}/dependencies`);
  }

  async deleteDriver(id: string, force: boolean = false): Promise<void> {
    return this.request<void>(`/drivers/${id}?force=${force}`, {
      method: 'DELETE',
    });
  }
}

const driversCRUDService = new DriversCRUDService();

export const useDriversCRUD = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (driver: Omit<Driver, 'id' | 'totalTrips' | 'truckCount'>) => {
      return driversCRUDService.createDriver(driver);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, driver }: { id: string; driver: Partial<Driver> }) => {
      return driversCRUDService.updateDriver(id, driver);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const checkDependenciesMutation = useMutation({
    mutationFn: async (id: string): Promise<DriverDependencies> => {
      return driversCRUDService.checkDependencies(id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, force = false }: { id: string; force?: boolean }) => {
      return driversCRUDService.deleteDriver(id, force);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  return {
    createDriver: createMutation.mutateAsync,
    updateDriver: updateMutation.mutateAsync,
    deleteDriver: deleteMutation.mutateAsync,
    checkDependencies: checkDependenciesMutation.mutateAsync,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || checkDependenciesMutation.isPending,
  };
};
