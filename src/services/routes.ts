
import { Route, RoutePoint } from '@/hooks/useRoutes';
import { BaseApiService } from './base';

export class RoutesService extends BaseApiService {
  async getRoutes(): Promise<Route[]> {
    return this.request<Route[]>('/routes');
  }

  async createRoute(route: Omit<Route, 'id' | 'createdAt'>): Promise<Route> {
    return this.request<Route>('/routes', {
      method: 'POST',
      body: JSON.stringify(route),
    });
  }

  async updateRoute(id: string, route: Partial<Route>): Promise<Route> {
    return this.request<Route>(`/routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(route),
    });
  }

  async deleteRoute(id: string): Promise<void> {
    return this.request<void>(`/routes/${id}`, {
      method: 'DELETE',
    });
  }
}

export const routesService = new RoutesService();
