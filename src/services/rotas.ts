import {
  Rota, Ponto, RotaStatus,
  validateRota, validatePonto, normalizeRota, normalizePonto,
} from '@/types/rota';
import { BaseApiService } from './base';

const LEGACY_STORAGE_KEY = 'erp_rotaas_routes';
const MIGRATED_KEY = 'erp_rotas_migrated_to_server';

/**
 * Migrar registro do formato antigo (rota única = uma parada com empresa/endereço)
 * para o novo formato (rota = card com lista de pontos). Usado só na migração
 * do localStorage local para o servidor.
 */
const migrateLegacyRota = (raw: any): Omit<Rota, 'id' | 'createdAt' | 'updatedAt'> & { sortOrder?: number } => {
  if (Array.isArray(raw?.pontos)) {
    const n = normalizeRota(raw);
    return { name: n.name, status: n.status, pontos: n.pontos };
  }
  const legacy = raw || {};
  return {
    name: legacy.name || 'Rota sem nome',
    status: legacy.status as RotaStatus,
    pontos: [normalizePonto({
      company: legacy.company || '',
      address: legacy.address || '',
      cleaning: legacy.cleaning || '',
      bathrooms: legacy.bathrooms || '',
      toilets: legacy.toilets || '',
      pieces: legacy.pieces || '',
      contact: legacy.contact || '',
      observation: legacy.observation || '',
      sanitarioNumber: legacy.sanitarioNumber || '',
      model: legacy.model || '',
      color: legacy.color || '',
    })],
  };
};

/** Lê as rotas que ainda estão SÓ no localStorage deste PC (para migração). */
const readLocalOnly = (): Array<Omit<Rota, 'id' | 'createdAt' | 'updatedAt'>> => {
  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(migrateLegacyRota)
      .filter((r) => r.name?.trim() && r.pontos.length > 0);
  } catch {
    return [];
  }
};

/**
 * Serviço de rotas — API-first (Postgres via /api/erp/rotas).
 *
 * - Todas as operações vão ao SERVIDOR: todos os PCs veem os mesmos dados.
 * - Fallback: se o backend estiver inacessível/offline, lê do cache local
 *   (última cópia sincronizada) para não travar a tela.
 * - Migração automática: na primeira carga, o que ainda estiver SÓ no
 *   localStorage deste PC é enviado ao servidor UMA vez (sem duplicar:
 *   o backend pula nomes já existentes e marcamos MIGRATED_KEY).
 */
export class RotasService extends BaseApiService {
  private cache(routes: Rota[]): void {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(routes));
    } catch { /* storage cheio/bloqueado: ignora */ }
  }

  private cached(): Rota[] {
    try {
      const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((r: any) => normalizeRota(r));
    } catch {
      return [];
    }
  }

  /** Sobe ao servidor o que ainda está só neste PC (uma vez por navegador). */
  private async migrateLocalToServer(): Promise<void> {
    try {
      if (localStorage.getItem(MIGRATED_KEY) === '1') return;
      const local = readLocalOnly();
      if (local.length === 0) {
        localStorage.setItem(MIGRATED_KEY, '1');
        return;
      }
      await this.request<Rota[]>('/erp/rotas/import', {
        method: 'POST',
        body: JSON.stringify({ items: local }),
      });
      localStorage.setItem(MIGRATED_KEY, '1');
    } catch {
      // Backend fora/migration não aplicada ainda: tenta de novo na próxima carga.
    }
  }

  async getRoutes(): Promise<Rota[]> {
    try {
      await this.migrateLocalToServer();
      const data = await this.request<Rota[]>('/erp/rotas');
      const routes = (Array.isArray(data) ? data : []).map((r: any) => normalizeRota(r));
      this.cache(routes);
      return routes;
    } catch (error) {
      console.warn('[Rotas] backend inacessível, usando cache local:', error);
      return this.cached();
    }
  }

  async createRoute(data: { name: string; status?: RotaStatus }): Promise<Rota> {
    const validation = validateRota(data);
    if (!validation.valid) throw new Error(validation.errors.join(', '));

    const created = await this.request<Rota>('/erp/rotas', {
      method: 'POST',
      body: JSON.stringify({ name: data.name.trim(), status: data.status || 'ativa' }),
    });
    return normalizeRota(created);
  }

  async updateRoute(id: string, data: Partial<Rota>): Promise<Rota> {
    const updated = await this.request<Rota>(`/erp/rotas/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      }),
    });
    return normalizeRota(updated);
  }

  async deleteRoute(id: string): Promise<void> {
    await this.request<void>(`/erp/rotas/${id}`, { method: 'DELETE' });
  }

  // --- Operações de ordenação de rotas ---

  async moveRoute(id: string, direction: 'up' | 'down'): Promise<Rota[]> {
    const routes = await this.getRoutes();
    const index = routes.findIndex((r) => r.id === id);
    if (index === -1) return routes;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= routes.length) return routes;

    const ordered = [...routes];
    [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
    await this.request('/erp/rotas/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids: ordered.map((r) => r.id) }),
    });
    return ordered;
  }

  async reorderRoutes(routeIds: string[]): Promise<Rota[]> {
    await this.request('/erp/rotas/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids: routeIds }),
    });
    return this.getRoutes();
  }

  /**
   * Importação em lote (planilha Excel): cada item vira uma rota com seus pontos.
   * Pontos sem empresa E sem endereço são descartados; rotas que ficarem sem
   * nenhum ponto válido também são descartadas. Retorna as rotas criadas.
   */
  async importRotas(
    items: { name: string; status?: RotaStatus; pontos: Array<Partial<Ponto>> }[],
  ): Promise<Rota[]> {
    const cleaned = items
      .map((item) => ({
        name: item.name?.trim() || 'Rota importada',
        status: item.status || 'ativa',
        pontos: (item.pontos || [])
          .filter((p) => String(p.company ?? '').trim() !== '' || String(p.address ?? '').trim() !== '')
          .map((p) => ({
            company: String(p.company ?? '').trim(),
            address: String(p.address ?? '').trim(),
            cleaning: String(p.cleaning ?? '').trim(),
            bathrooms: String(p.bathrooms ?? '').trim(),
            toilets: String(p.toilets ?? '').trim(),
            pieces: String(p.pieces ?? '').trim(),
            contact: String(p.contact ?? '').trim(),
            observation: String(p.observation ?? '').trim(),
            sanitarioNumber: String(p.sanitarioNumber ?? '').trim(),
            model: String(p.model ?? '').trim(),
            color: String(p.color ?? '').trim(),
          })),
      }))
      .filter((item) => item.pontos.length > 0);
    if (cleaned.length === 0) return [];
    const created = await this.request<Rota[]>('/erp/rotas/import', {
      method: 'POST',
      body: JSON.stringify({ items: cleaned }),
    });
    return (Array.isArray(created) ? created : []).map((r: any) => normalizeRota(r));
  }

  // --- Operações de pontos (dentro de uma rota) ---

  async addPonto(rotaId: string, pontoData: Omit<Ponto, 'id'>): Promise<Ponto> {
    const validation = validatePonto(pontoData);
    if (!validation.valid) throw new Error(validation.errors.join(', '));

    const created = await this.request<Ponto>(`/erp/rotas/${rotaId}/pontos`, {
      method: 'POST',
      body: JSON.stringify({ ...pontoData }),
    });
    return normalizePonto(created);
  }

  async updatePonto(rotaId: string, pontoId: string, pontoData: Partial<Ponto>): Promise<Ponto> {
    const updated = await this.request<Ponto>(`/erp/rotas/${rotaId}/pontos/${pontoId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...pontoData }),
    });
    return normalizePonto(updated);
  }

  async deletePonto(rotaId: string, pontoId: string): Promise<void> {
    await this.request<void>(`/erp/rotas/${rotaId}/pontos/${pontoId}`, { method: 'DELETE' });
  }

  async movePonto(rotaId: string, pontoId: string, direction: 'up' | 'down'): Promise<void> {
    await this.request(`/erp/rotas/${rotaId}/pontos/${pontoId}/move`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    });
  }
}

export const rotasService = new RotasService();
