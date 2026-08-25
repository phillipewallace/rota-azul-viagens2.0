
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '@/services/config';
import { Route } from './useRoutes';
import { classifyError } from '@/utils/errorHandler';

// Configurações de timeout
const REQUEST_TIMEOUT = 30000; // 30 segundos

// Helper para fazer requisição com timeout
const fetchWithTimeout = async (
  url: string, 
  options: RequestInit,
  timeout = REQUEST_TIMEOUT
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('A operação demorou muito. Verifique sua conexão e tente novamente.');
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
    }
    
    throw error;
  }
};

// Processar resposta de erro
const handleErrorResponse = async (response: Response, defaultMessage: string): Promise<never> => {
  let errorMessage = defaultMessage;
  
  try {
    const errorData = await response.json();
    errorMessage = errorData.error || errorData.message || defaultMessage;
  } catch {
    // Usar mensagem padrão se não conseguir parsear
  }
  
  // Adicionar contexto baseado no status
  if (response.status === 404) {
    errorMessage = 'Rota não encontrada. Pode ter sido removida.';
  } else if (response.status === 409) {
    errorMessage = 'Conflito de dados. A rota foi alterada por outro usuário. Recarregue a página.';
  } else if (response.status >= 500) {
    errorMessage = 'Erro no servidor. Tente novamente em alguns instantes.';
  }
  
  throw new Error(errorMessage);
};

export const useRoutesCRUD = () => {
  const queryClient = useQueryClient();

  const updateRoute = useMutation({
    mutationFn: async ({ id, route }: { id: string; route: any }) => {
      console.log('🔄 [ROUTES CRUD] Atualizando rota:', id);
      console.log('📋 [ROUTES CRUD] Pontos a salvar:', route.points?.length || 0);
      
      // Timeout maior para rotas com muitos pontos
      const timeout = route.points?.length > 20 ? 60000 : 30000;
      
      const token = localStorage.getItem('auth_token');

      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/routes/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(route),
        },
        timeout
      );

      if (!response.ok) {
        // Extrair mensagem de erro do backend
        let errorMessage = 'Erro ao atualizar rota';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Usar mensagem padrão
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ [ROUTES CRUD] Rota atualizada com sucesso');
      return result;
    },
    onSuccess: () => {
      console.log('✅ [ROUTES CRUD] Invalidando queries após atualização');
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
    onError: (error) => {
      console.error('❌ [ROUTES CRUD] Erro na atualização:', error);
    }
  });

  const deleteRoute = useMutation({
    mutationFn: async (id: string) => {
      console.log('🗑️ [ROUTES CRUD] Excluindo rota:', id);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/routes/${id}`,
        {
          method: 'DELETE',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        await handleErrorResponse(response, 'Erro ao excluir rota');
      }

      console.log('✅ [ROUTES CRUD] Rota excluída com sucesso');
    },
    onSuccess: () => {
      console.log('✅ [ROUTES CRUD] Invalidando queries após exclusão');
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
    onError: (error) => {
      console.error('❌ [ROUTES CRUD] Erro na exclusão:', error);
    }
  });

  const resetRoute = useMutation({
    mutationFn: async (id: string) => {
      console.log('🔄 [ROUTES CRUD] Resetando rota:', id);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/routes/${id}/reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        await handleErrorResponse(response, 'Erro ao resetar rota');
      }

      const result = await response.json();
      console.log('✅ [ROUTES CRUD] Rota resetada com sucesso');
      return result;
    },
    onSuccess: () => {
      console.log('✅ [ROUTES CRUD] Invalidando queries após reset');
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
    onError: (error) => {
      console.error('❌ [ROUTES CRUD] Erro no reset:', error);
    }
  });

  const optimizeRoute = useMutation({
    mutationFn: async (id: string) => {
      console.log(`🔄 [ROUTES CRUD] Otimizando rota ${id} manualmente`);
      
      // Otimização pode demorar mais, usar timeout maior
      const token = localStorage.getItem('auth_token');
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/routes/${id}/optimize-manual`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
        60000 // 60 segundos para otimização
      );

      if (!response.ok) {
        await handleErrorResponse(response, 'Erro ao otimizar rota');
      }

      const result = await response.json();
      console.log(`✅ [ROUTES CRUD] Rota otimizada com sucesso`);
      return result;
    },
    onSuccess: () => {
      console.log(`✅ [ROUTES CRUD] Invalidando queries após otimização`);
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
    onError: (error) => {
      console.error('❌ [ROUTES CRUD] Erro na otimização:', error);
    }
  });

  return {
    updateRoute: updateRoute.mutateAsync,
    deleteRoute: deleteRoute.mutateAsync,
    resetRoute: resetRoute.mutateAsync,
    optimizeRoute: optimizeRoute.mutateAsync,
    isLoading: updateRoute.isPending || deleteRoute.isPending || resetRoute.isPending || optimizeRoute.isPending,
  };
};
