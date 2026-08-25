import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, checkAuthStatus, user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const interval = setInterval(() => {
      checkAuthStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, [checkAuthStatus]);

  if (loading) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-3"
        style={{ background: 'var(--gradient-brand)' }}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-brand-foreground" aria-hidden />
        <p className="text-sm font-medium text-brand-foreground/90">Carregando…</p>
      </div>
    );
  }

  if (!isAuthenticated()) {
    const isAppFuncionarios = location.pathname.startsWith('/app-funcionarios');
    if (isAppFuncionarios) return <>{children}</>;
    return <Navigate to="/login" replace />;
  }

  // Funcionários só acessam o módulo de Ponto.
  if (user?.role === 'funcionario' && !location.pathname.startsWith('/ponto')) {
    return <Navigate to="/ponto" replace />;
  }

  // Conta demonstrativa: pode navegar por tudo — dados são fictícios,
  // servidos pelo interceptor de fetch (src/lib/demoMode.ts).



  return <>{children}</>;
};

export default ProtectedRoute;

