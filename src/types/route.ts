/**
 * Modelo unificado de ponto de rota
 * Este arquivo define o modelo padrão usado em todo o sistema (web, mobile, backend)
 * 
 * IMPORTANTE: Qualquer alteração aqui deve ser refletida em:
 * - backend/src/routes/routes.ts (DTOs de entrada/saída)
 * - mobile/src/types/route.ts (cópia para mobile)
 * - database/route_points_table.sql (schema do banco)
 */

export type PointType = 'origin' | 'destination' | 'waypoint' | 'origem' | 'parada' | 'destino';

export interface RoutePoint {
  id: string;                    // UUID estável por ponto
  order: number;                 // Ordem na rota (0-indexed)
  type: PointType;               // Tipo do ponto

  // Dados de localização
  address: string;               // Endereço completo
  cep?: string;                  // CEP (opcional)
  lat: number;                   // Latitude
  lng: number;                   // Longitude

  // Dados operacionais (todos opcionais)
  customerName?: string;         // Nome do cliente/ponto
  restroomsQty?: number;         // Quantidade de banheiros
  cleaningsQty?: number;         // Quantidade de limpezas previstas
  contactName?: string;          // Nome do responsável local
  contactPhone?: string;         // Telefone do responsável
  notes?: string;                // Observações (campo unificado - alias de observation)
  observation?: string;          // Observações (legado - usar notes preferencialmente)

  // Status de execução
  completed?: boolean;           // Se o ponto foi concluído
  completedAt?: string | null;   // Data/hora de conclusão

  // Metadados extras (mobile)
  name?: string;                 // Nome alternativo (usado no mobile)
  stopType?: string;             // Tipo de parada (Coleta, Entrega, Serviço)
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  points: RoutePoint[];
  totalDistance: number;
  estimatedTime: string;
  estimatedDuration?: number;
  optimizedOrder: string[];
  optimizationMode?: 'fixed' | 'optimized';
  status: 'active' | 'inactive' | 'completed';
  createdAt: string;
  updatedAt?: string;
  polyline?: string;
  pointCount?: number;
}

// Tipo para validação de campos numéricos
export const validateNumericField = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num) || num < 0) return undefined;
  return num;
};

// Tipo para validação de telefone
export const validatePhoneField = (value: string | undefined): string | undefined => {
  if (!value || value.trim() === '') return undefined;
  // Remove espaços extras mas mantém formatação básica
  return value.trim().replace(/\s+/g, ' ');
};

// Função para normalizar ponto (garantir campos consistentes)
export const normalizeRoutePoint = (point: Partial<RoutePoint>, index: number, totalPoints: number): RoutePoint => {
  // Determinar tipo baseado na posição
  let type: PointType = 'waypoint';
  if (index === 0) type = 'origin';
  else if (index === totalPoints - 1) type = 'destination';

  // Unificar notes e observation (notes tem prioridade)
  const notes = point.notes || point.observation || undefined;

  return {
    id: point.id || `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    order: index,
    type,
    address: point.address || '',
    cep: point.cep || '',
    lat: typeof point.lat === 'number' ? point.lat : 0,
    lng: typeof point.lng === 'number' ? point.lng : 0,
    customerName: point.customerName || point.name || undefined,
    restroomsQty: validateNumericField(point.restroomsQty),
    cleaningsQty: validateNumericField(point.cleaningsQty),
    contactName: point.contactName || undefined,
    contactPhone: validatePhoneField(point.contactPhone),
    notes,
    observation: notes, // Manter compatibilidade
    completed: point.completed || false,
    completedAt: point.completedAt || null,
    name: point.name || point.customerName || undefined,
    stopType: point.stopType || undefined,
  };
};

// Função para preparar ponto para envio ao backend
export const preparePointForBackend = (point: RoutePoint): Record<string, any> => {
  return {
    id: point.id,
    order: point.order,
    type: point.type,
    address: point.address,
    cep: point.cep || '',
    lat: point.lat,
    lng: point.lng,
    customerName: point.customerName || null,
    restroomsQty: point.restroomsQty ?? null,
    cleaningsQty: point.cleaningsQty ?? null,
    contactName: point.contactName || null,
    contactPhone: point.contactPhone || null,
    notes: point.notes || point.observation || null,
    completed: point.completed || false,
    completedAt: point.completedAt || null,
  };
};
