/**
 * Utilitários para tratamento de erros e validação
 */

import { toast } from 'sonner';

// Tipos de erro conhecidos
export type ErrorType = 
  | 'network' 
  | 'timeout' 
  | 'validation' 
  | 'conflict' 
  | 'notFound' 
  | 'unauthorized' 
  | 'server' 
  | 'unknown';

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: any;
  retryable: boolean;
}

// Classificar erro por tipo
export const classifyError = (error: any): AppError => {
  const errorMessage = error?.message || error?.toString() || '';
  
  // Erros de rede/conexão
  if (
    errorMessage.includes('fetch') ||
    errorMessage.includes('network') ||
    errorMessage.includes('conexão') ||
    errorMessage.includes('NetworkError')
  ) {
    return {
      type: 'network',
      message: 'Erro de conexão. Verifique sua internet.',
      originalError: error,
      retryable: true
    };
  }
  
  // Timeout
  if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
    return {
      type: 'timeout',
      message: 'A operação demorou muito. Tente novamente.',
      originalError: error,
      retryable: true
    };
  }
  
  // Conflito (edição simultânea)
  if (errorMessage.includes('409') || errorMessage.includes('conflito') || errorMessage.includes('conflict')) {
    return {
      type: 'conflict',
      message: 'Os dados foram alterados por outro usuário. Recarregue a página.',
      originalError: error,
      retryable: false
    };
  }
  
  // Não encontrado
  if (errorMessage.includes('404') || errorMessage.includes('não encontrad')) {
    return {
      type: 'notFound',
      message: 'Recurso não encontrado. Pode ter sido removido.',
      originalError: error,
      retryable: false
    };
  }
  
  // Não autorizado
  if (errorMessage.includes('401') || errorMessage.includes('403')) {
    return {
      type: 'unauthorized',
      message: 'Acesso negado. Faça login novamente.',
      originalError: error,
      retryable: false
    };
  }
  
  // Validação
  if (
    errorMessage.includes('400') ||
    errorMessage.includes('invalid') ||
    errorMessage.includes('obrigatório') ||
    errorMessage.includes('válido')
  ) {
    return {
      type: 'validation',
      message: errorMessage,
      originalError: error,
      retryable: false
    };
  }
  
  // Erro de servidor
  if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
    return {
      type: 'server',
      message: 'Erro no servidor. Tente novamente em alguns instantes.',
      originalError: error,
      retryable: true
    };
  }
  
  // Erro desconhecido
  return {
    type: 'unknown',
    message: errorMessage || 'Erro inesperado. Tente novamente.',
    originalError: error,
    retryable: true
  };
};

// Exibir toast de erro com ação de retry opcional
export const showErrorWithRetry = (
  error: any,
  onRetry?: () => void,
  customMessage?: string
): void => {
  const appError = classifyError(error);
  const message = customMessage || appError.message;
  
  if (appError.retryable && onRetry) {
    toast.error(message, {
      action: {
        label: 'Tentar novamente',
        onClick: onRetry
      },
      duration: 8000
    });
  } else {
    toast.error(message, { duration: 5000 });
  }
};

// Handler genérico para operações assíncronas com tratamento de erro
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  options?: {
    onError?: (error: AppError) => void;
    onRetry?: () => void;
    successMessage?: string;
    errorMessage?: string;
    showSuccessToast?: boolean;
  }
): Promise<{ success: boolean; data?: T; error?: AppError }> => {
  try {
    const data = await operation();
    
    if (options?.showSuccessToast && options?.successMessage) {
      toast.success(options.successMessage);
    }
    
    return { success: true, data };
  } catch (error) {
    const appError = classifyError(error);
    
    console.error('❌ [ERROR_HANDLER]', appError.type, ':', appError.message);
    
    if (options?.onError) {
      options.onError(appError);
    } else {
      showErrorWithRetry(error, options?.onRetry, options?.errorMessage);
    }
    
    return { success: false, error: appError };
  }
};

// Validação de campos antes de enviar
export interface FieldValidation {
  field: string;
  value: any;
  rules: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | null;
  };
}

export const validateFields = (validations: FieldValidation[]): { valid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  
  for (const v of validations) {
    const { field, value, rules } = v;
    
    // Required
    if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      errors[field] = `${field} é obrigatório`;
      continue;
    }
    
    // Se não é obrigatório e está vazio, pular outras validações
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      continue;
    }
    
    // MinLength
    if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
      errors[field] = `${field} deve ter pelo menos ${rules.minLength} caracteres`;
      continue;
    }
    
    // MaxLength
    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      errors[field] = `${field} deve ter no máximo ${rules.maxLength} caracteres`;
      continue;
    }
    
    // Min (número)
    if (rules.min !== undefined) {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(num) || num < rules.min) {
        errors[field] = `${field} deve ser no mínimo ${rules.min}`;
        continue;
      }
    }
    
    // Max (número)
    if (rules.max !== undefined) {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(num) || num > rules.max) {
        errors[field] = `${field} deve ser no máximo ${rules.max}`;
        continue;
      }
    }
    
    // Pattern
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      errors[field] = `${field} está em formato inválido`;
      continue;
    }
    
    // Custom
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        errors[field] = customError;
      }
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};
