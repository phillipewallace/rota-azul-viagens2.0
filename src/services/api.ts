
import { routesService } from './routes';
import { trucksService } from './trucks';
import { geocodingService } from './geocoding';

// Exporta todos os serviços em uma única classe para compatibilidade
export class ApiService {
  // Rotas
  async getRoutes() {
    return routesService.getRoutes();
  }

  async createRoute(route: any) {
    return routesService.createRoute(route);
  }

  async updateRoute(id: string, route: any) {
    return routesService.updateRoute(id, route);
  }

  async deleteRoute(id: string) {
    return routesService.deleteRoute(id);
  }

  // Caminhões
  async getTrucks() {
    return trucksService.getTrucks();
  }

  async createTruck(truck: any) {
    return trucksService.createTruck(truck);
  }

  async updateTruck(id: string, truck: any) {
    return trucksService.updateTruck(id, truck);
  }

  async updateTruckLocation(truckId: string, lat: number, lng: number) {
    return trucksService.updateTruckLocation(truckId, lat, lng);
  }

  async scheduleMaintenance(truckId: string, maintenanceData: any) {
    return trucksService.scheduleMaintenance(truckId, maintenanceData);
  }

  // Geocoding
  async getAddressByCep(cep: string) {
    return geocodingService.getAddressByCep(cep);
  }

  async getCoordinatesFromAddress(address: string) {
    return geocodingService.getCoordinatesFromAddress(address);
  }

  async optimizeRoute(points: any[]) {
    return geocodingService.optimizeRoute(points);
  }
}

export const apiService = new ApiService();
