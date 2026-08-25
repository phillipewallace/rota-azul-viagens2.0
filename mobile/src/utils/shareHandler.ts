import { App } from '@capacitor/app';
import { sharedLocationStore } from '@/store/sharedLocationStore';

/**
 * Handler para localizações compartilhadas do WhatsApp/Google Maps
 * 
 * Suporta múltiplos métodos de recebimento:
 * 1. Capacitor App.addListener('appUrlOpen') - para deep links
 * 2. Capacitor App.getLaunchUrl() - para quando app é aberto com URL
 * 3. window.handleAndroidSharedLocation - injeção direta do Android
 * 4. window event 'sharedLocation' - evento customizado
 */
export const initializeShareHandler = () => {
  console.log('🔄 [SHARE HANDLER] Inicializando...');

  // === MÉTODO 1: Listener do Capacitor para URLs ===
  App.addListener('appUrlOpen', (data: any) => {
    console.log('📱 [SHARE HANDLER] appUrlOpen recebido:', data);
    
    if (data.url) {
      processIncomingUrl(data.url);
    }
  });

  // === MÉTODO 2: URL de launch (quando app é aberto com URL) ===
  App.getLaunchUrl().then((result) => {
    if (result?.url) {
      console.log('📱 [SHARE HANDLER] Launch URL detectada:', result.url);
      processIncomingUrl(result.url);
    }
  }).catch(err => {
    console.warn('⚠️ [SHARE HANDLER] Erro ao obter launch URL:', err);
  });

  // === MÉTODO 3: Handler global para injeção do Android ===
  (window as any).handleAndroidSharedLocation = (locationData: string) => {
    console.log('📱 [SHARE HANDLER] Localização recebida do Android:', locationData);
    processLocationData(locationData);
  };

  // === MÉTODO 4: Event listener para evento customizado ===
  window.addEventListener('sharedLocation', (event: any) => {
    console.log('📱 [SHARE HANDLER] Evento sharedLocation recebido:', event.detail);
    if (event.detail) {
      processLocationData(event.detail);
    }
  });

  // === MÉTODO 5: Verificar se já existe localização pendente (Android) ===
  const pendingLocation = (window as any).pendingSharedLocation;
  if (pendingLocation) {
    console.log('📱 [SHARE HANDLER] Localização pendente encontrada:', pendingLocation);
    processLocationData(pendingLocation);
    delete (window as any).pendingSharedLocation;
  }

  console.log('✅ [SHARE HANDLER] Inicialização completa');
};

/**
 * Processa URLs recebidas (deep links, custom schemes, etc)
 */
function processIncomingUrl(url: string) {
  console.log('🔗 [SHARE HANDLER] Processando URL:', url);
  
  try {
    const urlObj = new URL(url);
    
    // Custom scheme: alchemyrotas://share?text=...
    if (urlObj.protocol === 'alchemyrotas:') {
      const sharedText = urlObj.searchParams.get('text');
      const locationUri = urlObj.searchParams.get('uri');
      
      if (sharedText) {
        processLocationData(decodeURIComponent(sharedText));
      } else if (locationUri) {
        processLocationData(decodeURIComponent(locationUri));
      }
      return;
    }
    
    // URLs de mapas diretas
    if (url.includes('maps') || url.includes('geo:') || url.includes('google.com')) {
      processLocationData(url);
      return;
    }
    
    // Tentar extrair coordenadas de qualquer URL
    const coords = extractCoordinatesFromText(url);
    if (coords.lat && coords.lng) {
      processLocationData(url);
    }
  } catch (error) {
    console.error('❌ [SHARE HANDLER] Erro ao processar URL:', error);
    
    // Se falhou como URL, tentar como texto plano
    if (url.includes('geo:') || url.includes('maps') || url.match(/-?\d+\.\d+/)) {
      processLocationData(url);
    }
  }
}

/**
 * Processa dados de localização e atualiza o store
 */
function processLocationData(data: string) {
  if (!data || data.trim() === '') {
    console.warn('⚠️ [SHARE HANDLER] Dados vazios ignorados');
    return;
  }
  
  console.log('📍 [SHARE HANDLER] Salvando localização no store:', data);
  sharedLocationStore.setSharedContent(data);
}

/**
 * Extrai coordenadas de texto/link
 */
export const extractCoordinatesFromText = (text: string): { lat?: number; lng?: number; address?: string } => {
  const patterns = [
    /maps\?q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,           // ?q=lat,lng
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,                   // @lat,lng
    /maps\/place\/[^\/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/, // place/@lat,lng
    /q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,                  // q=lat,lng
    /(-?\d+\.\d{4,}),\s*(-?\d+\.\d{4,})/,             // lat, lng (decimal longo)
    /geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/,                // geo:lat,lng
    /place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,             // place/lat,lng
    /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,               // !3dlat!4dlng (Google Maps novo)
    /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,                 // ll=lat,lng
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        console.log('📍 [SHARE HANDLER] Coordenadas extraídas:', { lat, lng });
        return { lat, lng };
      }
    }
  }
  
  return { address: text };
};
