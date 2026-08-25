// Configurações da API
console.log('🔍 [CONFIG] Mode atual:', import.meta.env.MODE);
console.log('🔍 [CONFIG] Prod check:', import.meta.env.PROD);
console.log('🔍 [CONFIG] Dev check:', import.meta.env.DEV);

// URL da API baseada no ambiente
export const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://alchemyrotas.com/api' 
  : 'http://localhost:3002/api';

console.log('🔍 [CONFIG] API_BASE_URL definida como:', API_BASE_URL);

export const GOOGLE_MAPS_API_KEY = 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';

// Garantir que as URLs estejam corretas para produção
export const API_CONFIG = {
  BASE_URL: import.meta.env.PROD 
    ? 'https://alchemyrotas.com/api' 
    : 'http://localhost:3002/api',
  ENDPOINTS: {
    AUTH: '/auth',
    ROUTES: '/routes', 
    TRUCKS: '/trucks',
    DRIVERS: '/drivers',
    SCHEDULES: '/schedules',
    GEOCODING: '/geocoding',
    MOBILE: '/mobile',
    REPORTS: '/reports',
    MAINTENANCE: '/maintenance',
    MANAGEMENT: '/management',
    SETTINGS: '/settings',
    UPLOAD: '/upload'
  }
};

export const getApiUrl = (endpoint: string) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
