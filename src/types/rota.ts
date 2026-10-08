// Modelo de dados para a aba "Rotas" do ERP
// Cada rota representa uma parada/entrega em uma empresa/cliente

export type RotaStatus = 'ativa' | 'inativa' | 'concluida';

export interface Rota {
  id: string;
  name: string;              // Nome da rota
  company: string;           // Empresa
  address: string;           // Endereço
  cleaning: string;          // Limpezas (descrição)
  bathrooms: string;         // Banheiros (quantidade)
  contact: string;           // Contato
  observation: string;       // Observação
  sanitarioNumber: string;   // Número do sanitário
  model: string;             // Modelo (ex: veículo ou equipamento)
  color: string;             // Cor
  status: RotaStatus;
  createdAt: string;
  updatedAt: string;
}

// Tipo para campos numéricos opcionais
export const validateNumericField = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num) || num < 0) return undefined;
  return num;
};

// Normalizar rota para garantir campos consistentes
export const normalizeRota = (rota: Partial<Rota>): Rota => {
  return {
    id: rota.id || `rota-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: rota.name || '',
    company: rota.company || '',
    address: rota.address || '',
    cleaning: rota.cleaning || '',
    bathrooms: rota.bathrooms || '',
    contact: rota.contact || '',
    observation: rota.observation || '',
    sanitarioNumber: rota.sanitrioNumber || '',
    model: rota.model || '',
    color: rota.color || '',
    status: rota.status || 'ativa',
    createdAt: rota.createdAt || new Date().toISOString(),
    updatedAt: rota.updatedAt || new Date().toISOString(),
  };
};

// Validar campos obrigatórios
export const validateRota = (rota: Partial<Rota>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!rota.name || rota.name.trim() === '') errors.push('Nome da rota é obrigatório');
  if (!rota.company || rota.company.trim() === '') errors.push('Empresa é obrigatória');
  if (!rota.address || rota.address.trim() === '') errors.push('Endereço é obrigatório');
  return { valid: errors.length === 0, errors };
};