import { API_BASE_URL } from './config';

// Configurações de timeout e retry
const REQUEST_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 3; // Aumentado para 3 tentativas
const RETRY_DELAY = 1500; // 1.5 segundos entre tentativas

// Erros amigáveis ao usuário
const ERROR_MESSAGES: Record<string, string> = {
  'Failed to fetch': 'Erro de conexão. Verifique sua internet.',
  'NetworkError': 'Servidor indisponível. Tentando novamente...',
  'TypeError': 'Erro de comunicação com o servidor.',
  'AbortError': 'Operação demorou muito. Tente novamente.',
  '400': 'Dados inválidos.',
  '401': 'Sessão expirada. Faça login novamente.',
  '403': 'Acesso negado.',
  '404': 'Recurso não encontrado.',
  '409': 'Conflito: dados alterados por outro usuário. Recarregue a página.',
  '500': 'Erro no servidor. Aguarde e tente novamente.',
  '502': 'Servidor temporariamente indisponível.',
  '503': 'Serviço indisponível.',
};

// Helper para criar timeout com AbortController
const createTimeoutController = (ms: number): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return { controller, timeoutId };
};

// Helper para delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Verificar se erro é recuperável (retry faz sentido)
const isRetryableError = (error: any, statusCode?: number): boolean => {
  // Erros de rede são sempre retryable
  if (error?.name === 'AbortError' || error?.message?.includes('fetch')) {
    return true;
  }
  // Erros 5xx são retryable
  if (statusCode && statusCode >= 500) {
    return true;
  }
  // Erros 4xx NÃO são retryable (problema nos dados)
  return false;
};

// Obter mensagem de erro amigável - PRIORIZA mensagem do backend
const getErrorMessage = (error: any, statusCode?: number, backendMessage?: string): string => {
  // Se o backend mandou uma mensagem específica, usar ela
  if (backendMessage && backendMessage.trim()) {
    return backendMessage;
  }
  
  if (statusCode && ERROR_MESSAGES[statusCode.toString()]) {
    return ERROR_MESSAGES[statusCode.toString()];
  }
  
  const errorString = error?.message || error?.toString() || '';
  
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorString.includes(key)) {
      return message;
    }
  }
  
  return 'Erro inesperado. Tente novamente.';
};

export class BaseApiService {
  protected async request<T>(
    endpoint: string, 
    options?: RequestInit & { 
      timeout?: number;
      retries?: number;
      skipRetry?: boolean;
    }
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const timeout = options?.timeout || REQUEST_TIMEOUT;
    const maxRetries = options?.skipRetry ? 0 : (options?.retries ?? MAX_RETRIES);
    
    console.log('🔍 [BASE_API] Fazendo requisição para:', url);
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const { controller, timeoutId } = createTimeoutController(timeout);
      
      try {
        if (attempt > 0) {
          console.log(`🔄 [BASE_API] Tentativa ${attempt + 1} de ${maxRetries + 1}...`);
          await delay(RETRY_DELAY * attempt);
        }
        
        const token = localStorage.getItem('auth_token');
        const config: RequestInit = {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options?.headers,
          },
          credentials: 'omit',
          signal: controller.signal,
          ...options,
        };

        const response = await fetch(url, config);
        clearTimeout(timeoutId);
        
        console.log('📡 [BASE_API] Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [BASE_API] Erro na resposta:', response.status, errorText);
          
          // Tentar extrair mensagem do backend
          let backendMessage = '';
          try {
            const errorData = JSON.parse(errorText);
            backendMessage = errorData.error || errorData.message || '';
          } catch {
            // Corpo não é JSON
          }
          
          // Erros de cliente (4xx) - NÃO fazer retry, erro nos dados
          if (response.status >= 400 && response.status < 500) {
            const errorMessage = getErrorMessage(null, response.status, backendMessage);
            throw new Error(errorMessage);
          }
          
          // Para erros de servidor (5xx), permitir retry
          if (isRetryableError(null, response.status)) {
            console.log(`⚠️ [BASE_API] Erro ${response.status}, tentando novamente...`);
            lastError = new Error(getErrorMessage(null, response.status, backendMessage));
            continue;
          }
          
          throw new Error(getErrorMessage(null, response.status, backendMessage));
        }

        // Verificar se há conteúdo
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          console.log('✅ [BASE_API] Dados recebidos');
          return data;
        }
        
        // Retorno vazio é válido para algumas operações
        return {} as T;
        
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        // Erro de abort (timeout)
        if (error.name === 'AbortError') {
          console.error('⏱️ [BASE_API] Timeout na requisição');
          lastError = new Error(ERROR_MESSAGES['AbortError']);
          continue;
        }
        
        // Erro de rede
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.error('🌐 [BASE_API] Erro de conexão');
          lastError = new Error(ERROR_MESSAGES['Failed to fetch']);
          continue;
        }
        
        // Outros erros - não fazer retry
        console.error('❌ [BASE_API] Erro na requisição:', error);
        throw error;
      }
    }
    
    // Todas as tentativas falharam
    console.error('❌ [BASE_API] Todas as tentativas falharam');
    throw lastError || new Error('Erro inesperado após múltiplas tentativas');
  }
}

// Utilitários de validação para uso em componentes
export const ValidationUtils = {
  // Validar campo numérico
  validateNumber: (value: any, min = 0, max = 99999): { valid: boolean; value?: number; error?: string } => {
    if (value === null || value === undefined || value === '') {
      return { valid: true, value: undefined };
    }
    
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    
    if (isNaN(num)) {
      return { valid: false, error: 'Valor deve ser um número' };
    }
    
    if (num < min) {
      return { valid: false, error: `Valor mínimo é ${min}` };
    }
    
    if (num > max) {
      return { valid: false, error: `Valor máximo é ${max}` };
    }
    
    return { valid: true, value: num };
  },
  
  // Validar telefone
  validatePhone: (value: string | undefined): { valid: boolean; value?: string; error?: string } => {
    if (!value || value.trim() === '') {
      return { valid: true, value: undefined };
    }
    
    const cleaned = value.replace(/\D/g, '');
    
    if (cleaned.length < 8) {
      return { valid: false, error: 'Telefone deve ter pelo menos 8 dígitos' };
    }
    
    if (cleaned.length > 15) {
      return { valid: false, error: 'Telefone muito longo' };
    }
    
    return { valid: true, value: value.trim() };
  },
  
  // Validar texto obrigatório
  validateRequired: (value: string | undefined, fieldName: string): { valid: boolean; error?: string } => {
    if (!value || value.trim() === '') {
      return { valid: false, error: `${fieldName} é obrigatório` };
    }
    return { valid: true };
  },
  
  // Validar comprimento máximo
  validateMaxLength: (value: string | undefined, maxLength: number, fieldName: string): { valid: boolean; error?: string } => {
    if (value && value.length > maxLength) {
      return { valid: false, error: `${fieldName} deve ter no máximo ${maxLength} caracteres` };
    }
    return { valid: true };
  }
};
