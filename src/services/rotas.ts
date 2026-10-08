import { Rota, validateRota, normalizeRota } from '@/types/rota';
import { BaseApiService } from './base';

interface LocalStorageRota extends Rota {
  sortOrder: number; // Para manter a ordem de exibição
}

const STORAGE_KEY = 'erp_rotaas_routes';

export class RotasService extends BaseApiService {
  // CRUD sincronizado com localStorage (com fallback para API se disponível)

  async getRoutes(): Promise<Rota[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as LocalStorageRota[];
        // Ordenar pela ordem de exibição
        return parsed
          .map((r) => normalizeRota(r))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      }
    } catch (error) {
      console.error('Erro ao ler rotas do localStorage:', error);
    }

    // Fallback: tentar API REST
    try {
      return this.request<Rota[]>('/rotas');
    } catch (error) {
      console.error('Erro ao buscar rotas da API:', error);
      return [];
    }
  }

  async createRoute(rota: Omit<Rota, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rota> {
    // Validação do formulário
    const normalized = normalizeRota(rota);
    const validation = validateRota(normalized);
    if (!validation.valid) {
      const errors = validation.errors.join(', ');
      throw new Error(errors);
    }

    const newRota: Rota = {
      ...normalized,
      id: `rota-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Tenta API first
      const result = await this.request<Rota>('/rotas', {
        method: 'POST',
        body: JSON.stringify(newRota),
      });
      // Atualiza localStorage
      await this._saveToStorage();
      return result;
    } catch (error) {
      console.error('Erro na API, salvando no localStorage:', error);
      await this._saveToStorage(newRota);
      return newRota;
    }
  }

  async updateRoute(id: string, rota: Partial<Rota>): Promise<Rota> {
    const normalized = normalizeRota(rota);
    const validation = validateRota(normalized);
    if (!validation.valid) {
      const errors = validation.errors.join(', ');
      throw new Error(errors);
    }

    const updated: Rota = {
      ...normalized,
      id,
      updatedAt: new Date().toISOString(),
    };

    try {
      const result = await this.request<Rota>(`/rotas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
      await this._saveToStorage();
      return result;
    } catch (error) {
      console.error('Erro na API, atualizando localStorage:', error);
      await this._updateInStorage(id, updated);
      return updated;
    }
  }

  async deleteRoute(id: string): Promise<void> {
    try {
      await this.request<void>(`/rotas/${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Erro na API, removendo localStorage:', error);
    }
    await this._removeFromStorage(id);
  }

  // --- Operações de ordenação ---

  async moveRoute(id: string, direction: 'up' | 'down'): Promise<Rota[]> {
    const routes = await this.getRoutes();
    const index = routes.findIndex((r) => r.id === id);
    if (index === -1) return routes;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= routes.length) return routes;

    // Troca de posição
    const updated = [...routes];
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];

    // Atualiza sortOrder
    updated.forEach((r, i) => {
      r.sortOrder = i;
    });

    // Salva no localStorage
    await this._saveToStorage(updated.map((r) => r as LocalStorageRota));
    return updated;
  }

  async reorderRoutes(routes: Rota[]): Promise<void> {
    const sorted = routes.map((r, i) => ({ ...r, sortOrder: i }));
    await this._saveToStorage(sorted as LocalStorageRota[]);
  }

  private async _saveToStorage(routes: LocalStorageRota[] = []): Promise<void> {
    const sorted = [...routes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  }

  private async _updateInStorage(id: string, rota: Rota): Promise<void> {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored) as LocalStorageRota[];
    const index = parsed.findIndex((r) => r.id === id);
    if (index !== -1) {
      parsed[index] = { ...parsed[index], ...rota, updatedAt: rota.updatedAt! } as LocalStorageRota;
      await this._saveToStorage(parsed);
    }
  }

  private async _removeFromStorage(id: string): Promise<void> {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored) as LocalStorageRota[];
    const filtered = parsed.filter((r) => r.id !== id);
    await this._saveToStorage(filtered);
  }
}

export const rotasService = new RotasService();