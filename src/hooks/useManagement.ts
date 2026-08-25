
import { useState, useEffect } from 'react';
import { BaseApiService } from '@/services/base';

export interface ManagementStats {
  trucks: {
    total: number;
    available: number;
    in_route: number;
    maintenance: number;
  };
  drivers: {
    total: number;
    active: number;
  };
  routes: {
    total: number;
    active: number;
  };
  trips: {
    total_trips: number;
    total_distance: number;
    avg_duration: number;
  };
}

export interface PerformanceData {
  date: string;
  trips: number;
  total_distance: number;
  avg_duration: number;
  truck_name?: string;
  route_name?: string;
}

export interface RouteUsageData {
  name: string;
  id: string;
  usage_count: number;
  total_distance: number;
  avg_duration: number;
}

export interface TruckPerformanceData {
  name: string;
  id: string;
  plate: string;
  trips_count: number;
  total_distance: number;
  avg_duration: number;
  status: string;
}

class ManagementService extends BaseApiService {
  async getStats(): Promise<ManagementStats> {
    return this.request<ManagementStats>('/management/stats');
  }

  async getPerformance(filters: {
    startDate?: string;
    endDate?: string;
    truckId?: string;
    routeId?: string;
  } = {}): Promise<PerformanceData[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return this.request<PerformanceData[]>(`/management/performance?${params}`);
  }

  async getRouteUsage(filters: {
    startDate?: string;
    endDate?: string;
  } = {}): Promise<RouteUsageData[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return this.request<RouteUsageData[]>(`/management/route-usage?${params}`);
  }

  async getTruckPerformance(filters: {
    startDate?: string;
    endDate?: string;
  } = {}): Promise<TruckPerformanceData[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return this.request<TruckPerformanceData[]>(`/management/truck-performance?${params}`);
  }

  async exportReport(filters: {
    startDate?: string;
    endDate?: string;
    format?: string;
  } = {}): Promise<any> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return this.request<any>(`/management/export?${params}`);
  }
}

const managementService = new ManagementService();

export const useManagement = () => {
  const [stats, setStats] = useState<ManagementStats | null>(null);
  const [performance, setPerformance] = useState<PerformanceData[]>([]);
  const [routeUsage, setRouteUsage] = useState<RouteUsageData[]>([]);
  const [truckPerformance, setTruckPerformance] = useState<TruckPerformanceData[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await managementService.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPerformance = async (filters: {
    startDate?: string;
    endDate?: string;
    truckId?: string;
    routeId?: string;
  } = {}) => {
    try {
      const data = await managementService.getPerformance(filters);
      setPerformance(data);
    } catch (error) {
      console.error('Error loading performance:', error);
    }
  };

  const loadRouteUsage = async (filters: {
    startDate?: string;
    endDate?: string;
  } = {}) => {
    try {
      const data = await managementService.getRouteUsage(filters);
      setRouteUsage(data);
    } catch (error) {
      console.error('Error loading route usage:', error);
    }
  };

  const loadTruckPerformance = async (filters: {
    startDate?: string;
    endDate?: string;
  } = {}) => {
    try {
      const data = await managementService.getTruckPerformance(filters);
      setTruckPerformance(data);
    } catch (error) {
      console.error('Error loading truck performance:', error);
    }
  };

  const exportReport = async (filters: {
    startDate?: string;
    endDate?: string;
    format?: string;
  } = {}) => {
    try {
      return await managementService.exportReport(filters);
    } catch (error) {
      console.error('Error exporting report:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadStats();
    loadPerformance();
    loadRouteUsage();
    loadTruckPerformance();
  }, []);

  return {
    stats,
    performance,
    routeUsage,
    truckPerformance,
    loading,
    loadStats,
    loadPerformance,
    loadRouteUsage,
    loadTruckPerformance,
    exportReport,
  };
};
