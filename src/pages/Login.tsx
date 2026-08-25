import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff, Truck, Lock, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { PageMeta } from '@/components/PageMeta';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated()) navigate('/');
  }, [navigate, isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await login(username, password);
      // Funcionário só acessa o Ponto
      if (res?.user?.role === 'funcionario') navigate('/ponto');
      else navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
      toast.error('Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };


  return (
    <>
    <PageMeta
      title="Entrar"
      description="Acesse a plataforma AlchemyRotas para gerenciar rotas, frota e operações."
    />
    <main
      className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden"
      style={{ background: 'var(--gradient-brand)' }}
    >
      {/* Camada decorativa — orbes suaves, sem distrair */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-brand-foreground/10 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-4rem] h-80 w-80 rounded-full bg-brand-foreground/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-foreground/5 blur-3xl" />
      </div>

      <Card
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border-border/40 bg-card/95 backdrop-blur-md"
        style={{ boxShadow: 'var(--shadow-brand)' }}
      >
        <CardHeader className="px-6 pt-8 pb-4 text-center sm:px-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md transition-transform duration-200 hover:rotate-3">
            <Truck className="h-8 w-8" aria-hidden />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            AlchemyRotas
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Sistema de Gerenciamento</p>
        </CardHeader>

        <CardContent className="px-6 pb-8 sm:px-10">
          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            {/* Usuário */}
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Usuário
              </Label>
              <div className="relative">
                <User
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Digite seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="h-11 rounded-lg pl-10 transition-colors duration-200"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Senha
              </Label>
              <div className="relative">
                <Lock
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="h-11 rounded-lg pl-10 pr-10 transition-colors duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                <span className="font-medium leading-snug">{error}</span>
              </div>
            )}

            {/* Botão */}
            <Button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className="h-11 w-full rounded-lg text-sm font-semibold tracking-wide transition-all duration-200 hover:shadow-md active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Entrando...
                </>
              ) : (
                'Entrar no Sistema'
              )}
            </Button>
          </form>

          <div className="pt-6 text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              Versão 2.0 · Powered by Alchemy
            </p>
            <div className="pt-2 border-t border-border/40">
              <Button variant="outline" size="sm" className="w-full text-[10px] h-8 font-bold uppercase tracking-tighter" asChild>
                <a href="/app-funcionarios">Acessar App Operacional</a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
    </>
  );
};

export default Login;
