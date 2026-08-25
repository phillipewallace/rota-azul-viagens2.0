
import { GOOGLE_MAPS_API_KEY } from './config';
import { BaseApiService } from './base';
import { RoutePoint } from '@/hooks/useRoutes';

interface AddressResponse {
  address: string;
  lat: number;
  lng: number;
  cep: string;
}

interface OptimizedRouteResponse {
  optimizedOrder: string[];
  totalDistance: number;
  estimatedTime: string;
  routes: any[];
}

export class GeocodingService extends BaseApiService {
  async getAddressByCep(cep: string): Promise<AddressResponse> {
    try {
      const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const viaCepData = await viaCepResponse.json();
      
      if (!viaCepData.erro) {
        const address = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;
        const coords = await this.getCoordinatesFromAddress(address);
        
        return {
          address: address,
          lat: coords.lat,
          lng: coords.lng,
          cep: cep
        };
      }
    } catch (error) {
      console.error('Erro ao buscar CEP via ViaCEP:', error);
    }

    return this.request<AddressResponse>(`/geocoding/cep/${cep}`);
  }

  async getCoordinatesFromAddress(address: string): Promise<{ lat: number; lng: number }> {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    }

    throw new Error('Endereço não encontrado');
  }

  async optimizeRoute(points: RoutePoint[]): Promise<OptimizedRouteResponse> {
    if (points.length < 2) {
      throw new Error('É necessário pelo menos 2 pontos para otimizar a rota');
    }

    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id));

    const waypointsParam = waypoints.length > 0 
      ? `&waypoints=optimize:true|${waypoints.map(p => `${p.lat},${p.lng}`).join('|')}`
      : '';

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointsParam}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];

      let optimizedOrder = [origin.id];
      if (data.routes[0].waypoint_order) {
        optimizedOrder.push(...data.routes[0].waypoint_order.map((index: number) => waypoints[index].id));
      }
      optimizedOrder.push(destination.id);

      return {
        optimizedOrder,
        totalDistance: leg.distance.value / 1000,
        estimatedTime: leg.duration.text,
        routes: data.routes
      };
    }

    throw new Error('Não foi possível otimizar a rota');
  }
}

export const geocodingService = new GeocodingService();
