import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App APK do Checklist — wrapper que carrega a página /checklist
 * direto do domínio de produção. Não há frontend local: o WebView
 * sempre abre a versão mais recente publicada em alchemyrotas.com.
 */
const config: CapacitorConfig = {
  appId: 'com.alchemyrotas.checklist',
  appName: 'Alchemy Checklist',
  webDir: 'dist',
  server: {
    url: 'https://alchemyrotas.com/checklist',
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'alchemyrotas.com',
      '*.alchemyrotas.com',
      'maps.googleapis.com',
      '*.google.com',
    ],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f172a',
    },
    CapacitorHttp: { enabled: true },
  },
};

export default config;
