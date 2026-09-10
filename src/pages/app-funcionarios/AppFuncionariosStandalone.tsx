/**
 * App Funcionários — entry standalone (domínio próprio, ex.: csll.cloud).
 *
 * Wrapper fino sobre o AppFuncionarios existente: adiciona QueryClient +
 * Sonner, isola a sessão (chave própria no localStorage para não conflitar
 * com o sistema principal) e permite configurar a API via env:
 *   VITE_FUNC_API_URL=https://alchemyrotas.com/api  (padrão)
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { PageMeta } from '@/components/PageMeta';
import AppFuncionarios from './AppFuncionarios';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export default function AppFuncionariosStandalone() {
  return (
    <QueryClientProvider client={queryClient}>
      <PageMeta title="CSLL Equipe — App do Funcionário" />
      <Toaster position="top-center" richColors closeButton />
      <AppFuncionarios />
    </QueryClientProvider>
  );
}
