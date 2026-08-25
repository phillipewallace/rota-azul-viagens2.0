
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e145d80f177c4eb9987fd67c392fc5de',
  appName: 'AlchemyRotas Mobile',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'alchemyrotas.com',
      'https://alchemyrotas.com',
      'maps.googleapis.com',
      'https://maps.googleapis.com',
      'maps.google.com',
      'https://maps.google.com'
    ]
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    Geolocation: {
      permissions: {
        location: "always"
      }
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1e40af"
    },
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
