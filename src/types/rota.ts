// Modelo de dados para a aba "Rotas" do ERP.
//
// Uma Rota é um "card" (ex.: "Centro Barreiro") que agrupa vários Pontos.
// Cada Ponto é uma parada/entrega dentro da rota e carrega os detalhes
// operacionais (empresa, endereço, limpezas, banheiros, contato, etc.).
//
// Fluxo: criar a rota → adicionar os pontos dentro dela → gerar o PDF.

export type RotaStatus = 'ativa' | 'inativa' | 'concluida';

/** Detalhes de uma parada dentro de uma rota. */
export interface Ponto {
  id: string;
  company: string;           // Empresa
  address: string;           // Endereço
  cleaning: string;          // Limpezas (descrição)
  bathrooms: string;         // Banheiros (quantidade)
  toilets: string;           // Sanitários (quantidade — pode diferir de banheiros)
  pieces: string;            // Peças (quantidade — pode diferir das demais)
  contact: string;           // Contato
  observation: string;       // Observação
  sanitarioNumber: string;   // Número do sanitário
  model: string;             // Modelo (ex: veículo ou equipamento)
  color: string;             // Cor
}

/** Card de rota: nome + status + lista de pontos. */
export interface Rota {
  id: string;
  name: string;              // Nome da rota (ex: "Centro Barreiro")
  status: RotaStatus;
  pontos: Ponto[];
  createdAt: string;
  updatedAt: string;
}

// Gerar id único
export const generateId = (prefix: 'rota' | 'ponto' = 'rota'): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Normalizar ponto para garantir campos consistentes
// (toilets/pieces migram de bathrooms quando ausentes, para não perder dados antigos)
export const normalizePonto = (ponto: Partial<Ponto>): Ponto => ({
  id: ponto.id || generateId('ponto'),
  company: ponto.company || '',
  address: ponto.address || '',
  cleaning: ponto.cleaning || '',
  bathrooms: ponto.bathrooms || '',
  toilets: ponto.toilets || '',
  pieces: ponto.pieces || '',
  contact: ponto.contact || '',
  observation: ponto.observation || '',
  sanitarioNumber: ponto.sanitarioNumber || '',
  model: ponto.model || '',
  color: ponto.color || '',
});

// Normalizar rota para garantir campos consistentes
export const normalizeRota = (rota: Partial<Rota>): Rota => ({
  id: rota.id || generateId('rota'),
  name: rota.name || '',
  status: rota.status || 'ativa',
  pontos: (rota.pontos || []).map(normalizePonto),
  createdAt: rota.createdAt || new Date().toISOString(),
  updatedAt: rota.updatedAt || new Date().toISOString(),
});

// Validar rota (obrigatório: nome)
export const validateRota = (rota: Partial<Rota>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!rota.name || rota.name.trim() === '') errors.push('Nome da rota é obrigatório');
  return { valid: errors.length === 0, errors };
};

// Validar ponto (obrigatório: empresa e endereço)
export const validatePonto = (ponto: Partial<Ponto>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!ponto.company || ponto.company.trim() === '') errors.push('Empresa é obrigatória');
  if (!ponto.address || ponto.address.trim() === '') errors.push('Endereço é obrigatório');
  return { valid: errors.length === 0, errors };
};