import {
  Rota, Ponto, RotaStatus,
  validateRota, validatePonto, normalizeRota, normalizePonto, generateId,
} from '@/types/rota';

interface LocalStorageRota extends Rota {
  sortOrder: number; // Para manter a ordem de exibição
}

const STORAGE_KEY = 'erp_rotaas_routes';

/**
 * Migrar registro do formato antigo (rota única = uma parada com empresa/endereço)
 * para o novo formato (rota = card com lista de pontos).
 */
const migrateLegacyRota = (raw: any): LocalStorageRota => {
  // Já está no formato novo
  if (Array.isArray(raw?.pontos)) {
    return { ...normalizeRota(raw), sortOrder: raw.sortOrder ?? 0 };
  }

  const legacy = raw || {};
  return {
    ...normalizeRota({
      id: legacy.id,
      name: legacy.name || 'Rota sem nome',
      status: legacy.status as RotaStatus,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      pontos: [{
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
      }],
    }),
    sortOrder: legacy.sortOrder ?? 0,
  };
};

/**
 * Persistência das rotas exclusivamente em localStorage.
 * O backend NÃO possui endpoint /rotas — qualquer chamada retorna 404,
 * por isso não há nenhuma chamada de API neste serviço.
 */
export class RotasService {
  async getRoutes(): Promise<Rota[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(migrateLegacyRota)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    } catch (error) {
      console.error('Erro ao ler rotas do localStorage:', error);
      return [];
    }
  }

  async createRoute(data: { name: string; status?: RotaStatus }): Promise<Rota> {
    const validation = validateRota(data);
    if (!validation.valid) throw new Error(validation.errors.join(', '));

    const routes = (await this.getRoutes()) as LocalStorageRota[];
    const newRota: LocalStorageRota = {
      ...normalizeRota({ name: data.name.trim(), status: data.status || 'ativa' }),
      sortOrder: routes.length,
    };
    routes.push(newRota);
    await this._saveToStorage(routes);
    return newRota;
  }

  async updateRoute(id: string, data: Partial<Rota>): Promise<Rota> {
    const routes = (await this.getRoutes()) as LocalStorageRota[];
    const index = routes.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Rota não encontrada');

    const updated = normalizeRota({
      ...routes[index],
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    });
    const validation = validateRota(updated);
    if (!validation.valid) throw new Error(validation.errors.join(', '));

    routes[index] = { ...updated, sortOrder: routes[index].sortOrder };
    await this._saveToStorage(routes);
    return routes[index];
  }

  async deleteRoute(id: string): Promise<void> {
    const routes = (await this.getRoutes()) as LocalStorageRota[];
    await this._saveToStorage(
      routes.filter((r) => r.id !== id).map((r, i) => ({ ...r, sortOrder: i }))
    );
  }

  // --- Operações de ordenação de rotas ---

  async moveRoute(id: string, direction: 'up' | 'down'): Promise<Rota[]> {
    const routes = (await this.getRoutes()) as LocalStorageRota[];
    const index = routes.findIndex((r) => r.id === id);
    if (index === -1) return routes;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= routes.length) return routes;

    [routes[index], routes[targetIndex]] = [routes[targetIndex], routes[index]];
    routes.forEach((r, i) => { r.sortOrder = i; });

    await this._saveToStorage(routes);
    return routes;
  }

  async reorderRoutes(routeIds: string[]): Promise<Rota[]> {
    const routes = (await this.getRoutes()) as LocalStorageRota[];
    const ordered = routeIds
      .map((id) => routes.find((r) => r.id === id))
      .filter((r): r is LocalStorageRota => Boolean(r));
    // Acrescenta eventuais rotas que não estavam na lista enviada
    routes.forEach((r) => {
      if (!routeIds.includes(r.id)) ordered.push(r);
    });
    ordered.forEach((r, i) => { r.sortOrder = i; });
    await this._saveToStorage(ordered);
    return ordered;
  }

  /**
   * Importação em lote (planilha Excel): cada item vira uma rota com seus pontos.
   * Pontos sem empresa E sem endereço são descartados; rotas que ficarem sem
   * nenhum ponto válido também são descartadas. Retorna as rotas criadas.
   */
  async importRotas(
    items: { name: string; status?: RotaStatus; pontos: Array<Partial<Ponto>> }[],
  ): Promise<Rota[]> {
    const routes = (await this.getRoutes()) as LocalStorageRota[];
    const created: LocalStorageRota[] = [];

    for (const item of items) {
      const name = item.name?.trim() || 'Rota importada';
      const validPontos = (item.pontos || [])
        .filter((p) => String(p.company ?? '').trim() !== '' || String(p.address ?? '').trim() !== '')
        .map((p) =>
          normalizePonto({
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
          }),
        );
      if (validPontos.length === 0) continue;

      const newRota: LocalStorageRota = {
        ...normalizeRota({ name, status: item.status || 'ativa', pontos: validPontos }),
        sortOrder: routes.length + created.length,
      };
      routes.push(newRota);
      created.push(newRota);
    }

    if (created.length > 0) await this._saveToStorage(routes);
    return created;
  }

  // --- Operações de pontos (dentro de uma rota) ---

  async addPonto(rotaId: string, pontoData: Omit<Ponto, 'id'>): Promise<Ponto> {
    const validation = validatePonto(pontoData);
    if (!validation.valid) throw new Error(validation.errors.join(', '));

    const routes = (await this.getRoutes()) as LocalStorageRota[];
    const rota = routes.find((r) => r.id === rotaId);
    if (!rota) throw new Error('Rota não encontrada');

    const newPonto = normalizePonto(pontoData);
    rota.pontos.push(newPonto);
    rota.updatedAt = new Date().toISOString();
    await this._saveToStorage(routes);
    return newPonto;
  }

  async updatePonto(rotaId: string, pontoId: string, pontoData: Partial<Ponto>): Promise<Ponto> {
    const routes = (await this.getRoutes()) as LocalStorageRota[];
    const rota = routes.find((r) => r.id === rotaId);
    if (!rota) throw new Error('Rota não encontrada');

    const index = rota.pontos.findIndex((p) => p.id === pontoId);
    if (index === -1) throw new Error('Ponto não encontrado');

    const updated = normalizePonto({ ...rota.pontos[index], ...pontoData, id: pontoId });
    const validation = validatePonto(updated);
    if (!validation.valid) throw new Error(validation.errors.join(', '));

    rota.pontos[index] = updated;
    rota.updatedAt = new Date().toISOString();
    await this._saveToStorage(routes);
    return updated;
  }

  async deletePonto(rotaId: string, pontoId: string): Promise<void> {
    const routes = (await this.getRoutes()) as LocalStorageRota[];
    const rota = routes.find((r) => r.id === rotaId);
    if (!rota) throw new Error('Rota não encontrada');

    rota.pontos = rota.pontos.filter((p) => p.id !== pontoId);
    rota.updatedAt = new Date().toISOString();
    await this._saveToStorage(routes);
  }

  async movePonto(rotaId: string, pontoId: string, direction: 'up' | 'down'): Promise<void> {
    const routes = (await this.getRoutes()) as LocalStorageRota[];
    const rota = routes.find((r) => r.id === rotaId);
    if (!rota) throw new Error('Rota não encontrada');

    const index = rota.pontos.findIndex((p) => p.id === pontoId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rota.pontos.length) return;

    [rota.pontos[index], rota.pontos[targetIndex]] = [rota.pontos[targetIndex], rota.pontos[index]];
    rota.updatedAt = new Date().toISOString();
    await this._saveToStorage(routes);
  }

  private async _saveToStorage(routes: LocalStorageRota[]): Promise<void> {
    const sorted = [...routes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  }
}

export const rotasService = new RotasService();
