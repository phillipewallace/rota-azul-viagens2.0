/**
 * Modelo unificado de ponto de rota - Mobile
 * Cópia do modelo principal para uso no app mobile
 */

export type PointType = 'origin' | 'destination' | 'waypoint' | 'origem' | 'parada' | 'destino';
export type PointCategory = 'obra' | 'evento';
export type OperationType = 'entrega' | 'recolhimento' | 'manutencao';

export interface RoutePoint {
  // Categoria/Operação V2
  pointCategory?: PointCategory;
  operationType?: OperationType;
  recolhidoQty?: number;
  autoRemoved?: boolean;
  manutencaoUntil?: string | null;

  id: string;
  order: number;
  type: PointType;

  // Dados de localização
  address: string;
  cep?: string;
  lat: number;
  lng: number;

  // Dados operacionais
  customerName?: string;
  restroomsQty?: number;
  cleaningsQty?: number;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  observation?: string;

  // Status
  completed?: boolean;
  completedAt?: string | null;

  // Metadados mobile
  name?: string;
  stopType?: string;
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
}

// Validação de campos numéricos
export const validateNumericField = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num) || num < 0) return undefined;
  return num;
};

// Validação de telefone
export const validatePhoneField = (value: string | undefined): string | undefined => {
  if (!value || value.trim() === '') return undefined;
  return value.trim().replace(/\s+/g, ' ');
};

// Obter nome de exibição do ponto
export const getPointDisplayName = (point: RoutePoint): string => {
  return point.customerName || point.name || 'Cliente';
};

// Verificar se telefone é válido para ligar
export const isValidPhoneForCall = (phone: string | undefined): boolean => {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 8;
};

// Formatar telefone para link tel:
export const formatPhoneForCall = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  return `tel:+55${cleaned}`;
};
