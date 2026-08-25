
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/config';
import { installDemoFetch, uninstallDemoFetch } from '@/lib/demoMode';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');

      if (token && userData) {
        try {
          console.log('🔍 [AUTH] Verificando token com URL:', `${API_BASE_URL}/auth/verify`);
          
          const response = await fetch(`${API_BASE_URL}/auth/verify`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            credentials: 'omit',
          });

          console.log('📡 [AUTH] Verify response status:', response.status);

          if (response.ok) {
            const data = await response.json();
            console.log('✅ [AUTH] Token válido, dados do usuário:', data.user);
            localStorage.setItem('user_data', JSON.stringify(data.user));
            if (data.user?.role === 'demo' || data.user?.username === 'demo') installDemoFetch();
            else uninstallDemoFetch();
            setUser(data.user);
          } else {
            console.log('❌ [AUTH] Token inválido, limpando dados');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            uninstallDemoFetch();
            setUser(null);
          }
        } catch (error) {
          console.warn('⚠️ [AUTH] Erro ao verificar token, usando dados locais:', error);
          const parsedUser = JSON.parse(userData);
          if (parsedUser?.role === 'demo' || parsedUser?.username === 'demo') installDemoFetch();
          else uninstallDemoFetch();
          setUser(parsedUser);
        }
      }
    } catch (error) {
      console.error('❌ [AUTH] Erro no checkAuthStatus:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      console.log('🔍 [AUTH] Fazendo login com URL:', `${API_BASE_URL}/auth/login`);
      console.log('🔍 [AUTH] Dados do login:', { username, password: '***' });
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
        body: JSON.stringify({ username, password }),
      });

      console.log('📡 [AUTH] Login response status:', response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ [AUTH] Erro no login:', errorData);
        throw new Error('Credenciais inválidas');
      }

      const data = await response.json();
      console.log('✅ [AUTH] Login bem-sucedido:', data);
      
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user_data', JSON.stringify(data.user));

      if (data.user?.role === 'demo' || data.user?.username === 'demo') installDemoFetch();
      else uninstallDemoFetch();

      setUser(data.user);
      toast.success('Login realizado com sucesso!');
      
      return data;
    } catch (error) {
      console.error('❌ [AUTH] Erro no login:', error);
      toast.error('Erro ao fazer login');
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    uninstallDemoFetch();
    setUser(null);
    navigate('/login');
    toast.success('Logout realizado com sucesso');
  };

  const isAuthenticated = () => {
    return !!user && !!localStorage.getItem('auth_token');
  };

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated,
    checkAuthStatus,
  };
};
