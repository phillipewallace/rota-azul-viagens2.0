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
import AppFuncionariosStandalone from './pages/app-funcionarios/AppFuncionariosStandalone.tsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { installGlobalErrorHandlers, logger } from './lib/logger'

installGlobalErrorHandlers();

// Log vibrante de inicialização
logger.info("🚀 App Funcionários inicializado com sucesso!");

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <HelmetProvider>
      <AppFuncionariosStandalone />
    </HelmetProvider>
  </ErrorBoundary>
);
