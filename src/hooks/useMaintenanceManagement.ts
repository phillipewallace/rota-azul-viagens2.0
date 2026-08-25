import { useState, useEffect } from 'react';
import { BaseApiService } from '@/services/base';

export interface MaintenanceStats {
  trucks: {
    total: number;
    available: number;
    in_route: number;
    in_maintenance: number;
  };
  maintenance: {
    total_maintenances: number;
    completed: number;
    pending: number;
    in_progress: number;
  };
  upcoming: {
    upcoming_count: number;
  };
  costs: {
    total_cost: number;
    avg_cost: number;
  };
}

export interface MaintenanceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface MaintenanceRecord {
  id: string;
  truck_id: string;
  truck_name: string;
  truck_plate: string;
  maintenance_type: string;
  description: string;
  scheduled_date: string;
  cost: number;
  mileage?: number | null;
  next_maintenance_km?: number | null;
  supplier?: string | null;
  invoice_number?: string | null;
  items?: MaintenanceItem[];
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
  files?: FileAttachment[];
}



export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  url: string;
  originalName?: string;
  filename?: string;
  mimetype?: string;
}

export interface CostSummary {
  maintenance_type: string;
  count: number;
  total_cost: number;
  avg_cost: number;
}

class MaintenanceManagementService extends BaseApiService {
  async getStats(): Promise<MaintenanceStats> {
    return this.request<MaintenanceStats>('/management/stats');
  }

  async getMaintenanceRecords(filters: {
    startDate?: string;
    endDate?: string;
    truckId?: string;
    status?: string;
    type?: string;
  } = {}): Promise<MaintenanceRecord[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') params.append(key, value);
    });
    return this.request<MaintenanceRecord[]>(`/management/maintenance?${params}`);
  }

  async getCostsSummary(filters: {
    startDate?: string;
    endDate?: string;
  } = {}): Promise<CostSummary[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return this.request<CostSummary[]>(`/management/costs-summary?${params}`);
  }

  async createMaintenance(maintenance: Omit<MaintenanceRecord, 'id' | 'truck_name' | 'truck_plate' | 'created_at' | 'updated_at'>): Promise<MaintenanceRecord> {
    return this.request<MaintenanceRecord>('/management/maintenance', {
      method: 'POST',
      body: JSON.stringify(maintenance),
    });
  }

  async updateMaintenance(id: string, maintenance: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
    return this.request<MaintenanceRecord>(`/management/maintenance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(maintenance),
    });
  }

  async deleteMaintenance(id: string): Promise<void> {
    return this.request<void>(`/management/maintenance/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadFile(file: File): Promise<FileAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request<FileAttachment>('/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async deleteFile(filename: string): Promise<void> {
    return this.request<void>(`/upload/files/${filename}`, {
      method: 'DELETE',
    });
  }
}

const maintenanceManagementService = new MaintenanceManagementService();

export const useMaintenanceManagement = () => {
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [costsSummary, setCostsSummary] = useState<CostSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await maintenanceManagementService.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading maintenance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMaintenanceRecords = async (filters: {
    startDate?: string;
    endDate?: string;
    truckId?: string;
    status?: string;
    type?: string;
  } = {}) => {
    try {
      const data = await maintenanceManagementService.getMaintenanceRecords(filters);
      setMaintenanceRecords(data);
    } catch (error) {
      console.error('Error loading maintenance records:', error);
    }
  };

  const loadCostsSummary = async (filters: {
    startDate?: string;
    endDate?: string;
  } = {}) => {
    try {
      const data = await maintenanceManagementService.getCostsSummary(filters);
      setCostsSummary(data);
    } catch (error) {
      console.error('Error loading costs summary:', error);
    }
  };

  const createMaintenance = async (maintenance: Omit<MaintenanceRecord, 'id' | 'truck_name' | 'truck_plate' | 'created_at' | 'updated_at'>) => {
    try {
      const result = await maintenanceManagementService.createMaintenance(maintenance);
      await loadMaintenanceRecords();
      await loadStats();
      return result;
    } catch (error) {
      console.error('Error creating maintenance:', error);
      throw error;
    }
  };

  const updateMaintenance = async (id: string, maintenance: Partial<MaintenanceRecord>) => {
    try {
      const result = await maintenanceManagementService.updateMaintenance(id, maintenance);
      await loadMaintenanceRecords();
      await loadStats();
      return result;
    } catch (error) {
      console.error('Error updating maintenance:', error);
      throw error;
    }
  };

  const deleteMaintenance = async (id: string) => {
    try {
      await maintenanceManagementService.deleteMaintenance(id);
      await loadMaintenanceRecords();
      await loadStats();
    } catch (error) {
      console.error('Error deleting maintenance:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadStats();
    loadMaintenanceRecords();
    loadCostsSummary();
  }, []);

  return {
    stats,
    maintenanceRecords,
    costsSummary,
    loading,
    loadStats,
    loadMaintenanceRecords,
    loadCostsSummary,
    createMaintenance,
    updateMaintenance,
    deleteMaintenance,
  };
};
