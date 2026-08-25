import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
// Tipografia do design system: Space Grotesk (headings) + DM Sans (body).
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import App from './App.tsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { installGlobalErrorHandlers, logger } from './lib/logger'
import { bootstrapDemoMode } from './lib/demoMode'

installGlobalErrorHandlers();
bootstrapDemoMode();

// Log vibrante de inicialização
logger.info("🚀 Sistema inicializado com sucesso!");
logger.debug("Detective Mode ativado: Verbosidade total habilitada.");

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </ErrorBoundary>
);
