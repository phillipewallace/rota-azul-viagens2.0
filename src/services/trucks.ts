
import { Truck } from '@/hooks/useTrucks';
import { BaseApiService } from './base';

export class TrucksService extends BaseApiService {
  async getTrucks(): Promise<Truck[]> {
    return this.request<Truck[]>('/trucks');
  }

  async createTruck(truck: Omit<Truck, 'id'>): Promise<Truck> {
    return this.request<Truck>('/trucks', {
      method: 'POST',
      body: JSON.stringify(truck),
    });
  }

  async updateTruck(id: string, truck: Partial<Truck>): Promise<Truck> {
    return this.request<Truck>(`/trucks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(truck),
    });
  }

  async updateTruckLocation(truckId: string, lat: number, lng: number): Promise<void> {
    return this.request<void>(`/trucks/${truckId}/location`, {
      method: 'PUT',
      body: JSON.stringify({ lat, lng, timestamp: new Date().toISOString() }),
    });
  }

  async scheduleMaintenance(truckId: string, maintenanceData: any): Promise<any> {
    return this.request(`/trucks/${truckId}/maintenance`, {
      method: 'POST',
      body: JSON.stringify(maintenanceData),
    });
  }
}

export const trucksService = new TrucksService();
