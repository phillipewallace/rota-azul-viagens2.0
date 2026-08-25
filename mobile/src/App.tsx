import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from 'sonner';
import { useEffect } from 'react';
import MobileDriver from './pages/MobileDriver';
import StopsList from './pages/StopsList';
import AddExtraStopPage from './pages/AddExtraStopPage';
import StopDetailsPage from './pages/StopDetailsPage';
import { initializeShareHandler } from './utils/shareHandler';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

const App = () => {
  useEffect(() => {
    initializeShareHandler();
    // Flush fila offline de fotos (se houver) ao iniciar
    import('./services/photoUpload').then(m => m.flushQueue().catch(() => {}));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<MobileDriver />} />
            <Route path="/driver" element={<MobileDriver />} />
            <Route path="/stops" element={<StopsList />} />
            <Route path="/add-stop" element={<AddExtraStopPage />} />
            <Route path="/stop-details" element={<StopDetailsPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
