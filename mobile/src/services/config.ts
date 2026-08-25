/**
 * Configurações da API para o app mobile
 * 
 * IMPORTANTE: No APK, SEMPRE usar URL de produção.
 * Múltiplas formas de detecção para garantir funcionamento.
 */

// Múltiplas formas de detectar se está em APK/ambiente mobile
const capacitorObj = (window as any).Capacitor;
const isCapacitorNative = capacitorObj?.isNativePlatform?.() === true;
const hasCapacitorPlatform = capacitorObj?.getPlatform?.() === 'android' || capacitorObj?.getPlatform?.() === 'ios';
const isCapacitorDefined = typeof capacitorObj !== 'undefined';

// Verificar se hostname indica que estamos em WebView (Capacitor usa localhost no WebView)
const isCapacitorWebView = typeof window !== 'undefined' && 
  (window.location.protocol === 'capacitor:' || 
   window.location.protocol === 'ionic:' ||
   window.location.hostname === 'localhost' && isCapacitorDefined);

// Verificar se é produção via Vite
const isViteProduction = import.meta.env.MODE === 'production' || import.meta.env.PROD === true;

// Decisão final: se qualquer indicador de APK for true, usar produção
const useProductionAPI = isCapacitorNative || hasCapacitorPlatform || isCapacitorWebView || isViteProduction;

console.log('🔍 [CONFIG] Detecção de ambiente:');
console.log('  - isCapacitorNative:', isCapacitorNative);
console.log('  - hasCapacitorPlatform:', hasCapacitorPlatform);
console.log('  - isCapacitorWebView:', isCapacitorWebView);
console.log('  - isViteProduction:', isViteProduction);
console.log('  - useProductionAPI:', useProductionAPI);

// URL da API - SEMPRE produção em APK
const PRODUCTION_API = 'https://alchemyrotas.com/api';
const DEV_API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const API_BASE_URL = useProductionAPI ? PRODUCTION_API : DEV_API;

console.log('🔍 [CONFIG] API_BASE_URL definida como:', API_BASE_URL);

// Google Maps API Key (mesma chave do sistema principal)
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';

// Configurações específicas do mobile
export const APP_CONFIG = {
  version: import.meta.env.VITE_APP_VERSION || '2.0',
  name: import.meta.env.VITE_APP_NAME || 'AlchemyRotas Mobile',
  apiTimeout: 15000,
  locationUpdateInterval: 30000,
};

console.log('🔍 [CONFIG] Configurações do app:', APP_CONFIG);
