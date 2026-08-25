
import { useQuery } from '@tanstack/react-query';
import { BaseApiService } from '@/services/base';

export interface Driver {
  id: string;
  name: string;
  license: string;
  licenseCategory?: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive';
  hireDate?: string;
  currentRoute?: string;
  totalTrips?: number;
  truckCount?: number;
  source?: 'driver' | 'funcionario';
}


class DriversService extends BaseApiService {
  async getDrivers(): Promise<Driver[]> {
    return this.request<Driver[]>('/drivers');
  }
}

const driversService = new DriversService();

export const useDrivers = () => {
  const { data: drivers = [], isLoading: loading, refetch: loadDrivers } = useQuery({
    queryKey: ['drivers'],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        const data = await driversService.getDrivers();
        return data;
      } catch (error) {
        console.error('❌ Error loading drivers:', error);
        return [] as Driver[];
      }
    },
  });

  return {
    drivers,
    loading,
    loadDrivers
  };
};
