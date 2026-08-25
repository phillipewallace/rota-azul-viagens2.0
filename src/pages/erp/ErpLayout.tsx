/**
 * ERP Shell — layout dedicado para o módulo ERP.
 * Sidebar fixa com identidade própria (Indigo/Slate) para diferenciar visualmente
 * do sistema principal de roteirização (Azul). Compartilha dados via API.
 */
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ClipboardList, Users, Boxes, Building2,
  ExternalLink, AlertTriangle, ArrowLeft, Sparkles, DollarSign, FileSignature, LogOut, Files,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { serviceOrdersService } from '@/services/quotes';
import { useAuth } from '@/hooks/useAuth';
import { confirmDialog } from '@/lib/confirm';

const navItems = [
  { to: '/erp', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/erp/orcamentos', label: 'Orçamentos', icon: FileText },
  { to: '/erp/ordens-servico', label: 'Ordens de Serviço', icon: ClipboardList, badge: 'overdue' as const },
  { to: '/erp/contratos', label: 'Contratos', icon: FileSignature },
  { to: '/erp/assinatura', label: 'Assinatura', icon: FileSignature },
  { to: '/erp/assinados', label: 'Assinados', icon: Files },
  { to: '/erp/financeiro', label: 'Financeiro', icon: DollarSign },
  { to: '/erp/clientes', label: 'Clientes', icon: Users },
  { to: '/erp/funcionarios', label: 'Funcionários', icon: Users },
  { to: '/sanitarios', label: 'Sanitários', icon: Boxes },
  { to: '/erp/empresas', label: 'Empresas Emissoras', icon: Building2 },
];

const ErpLayout: React.FC = () => {
  const [overdue, setOverdue] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    const ok = await confirmDialog({
      title: 'Sair da conta?',
      description: 'Você precisará entrar novamente para acessar o sistema.',
      confirmLabel: 'Sair',
      destructive: true,
    });
    if (!ok) return;
    setLoggingOut(true);
    try { await Promise.resolve(logout()); } finally { setLoggingOut(false); }
  };

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const r = await serviceOrdersService.overdueCount();
        if (mounted) setOverdue(r.overdue || 0);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-slate-100 border-r border-slate-800 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">ERP Suite</h1>
              <p className="text-[10px] uppercase tracking-wider text-indigo-300/80">Locação & Gestão</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/30 to-indigo-500/10 text-white border border-indigo-500/40 shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                  }`
                }
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge === 'overdue' && overdue > 0 && (
                  <Badge className="bg-red-500/90 text-white text-[10px] h-5 gap-1 px-1.5">
                    <AlertTriangle className="h-3 w-3" />{overdue}
                  </Badge>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/80 space-y-3">
          {user && (
            <div className="px-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Conectado como</p>
              <p className="text-xs font-medium text-slate-100 truncate">{user.name || user.username}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full justify-start gap-2 text-destructive hover:bg-destructive/15 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40 transition-colors duration-200 active:scale-[0.98] disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? 'Saindo…' : 'Sair da conta'}
          </Button>
          <p className="text-[10px] text-slate-500 px-2 leading-snug">
            ERP conectado em tempo real ao AlchemyRotas — clientes, sanitários e frota são compartilhados.
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/60 safe-area-top">
        <div className="flex items-center gap-3 px-4 h-14">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-brand-3 grid place-items-center shadow-sm">
            <Sparkles className="h-[18px] w-[18px] text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-[15px] font-semibold leading-none tracking-tight text-foreground">ERP Suite</h1>
            <p className="text-[10.5px] mt-1 leading-none uppercase tracking-[0.14em] text-muted-foreground">Locação &amp; Gestão</p>
          </div>
          {overdue > 0 && (
            <Badge className="bg-destructive/10 text-destructive border-destructive/20 border h-6 px-2 gap-1 text-[10.5px] font-semibold">
              <AlertTriangle className="h-3 w-3" />{overdue}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Sair da conta"
            className="h-11 w-11 text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40 transition-colors duration-200 active:scale-[0.95] disabled:opacity-50"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </Button>
        </div>
        <nav className="flex overflow-x-auto no-scrollbar px-3 pb-2.5 gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-medium whitespace-nowrap border transition-all duration-200 active:scale-[0.97] ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/60 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted'
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {item.badge === 'overdue' && overdue > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">{overdue}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <main key={location.pathname} className="flex-1 min-w-0 pt-[92px] md:pt-0 pb-20 md:pb-0">
        <Outlet />
      </main>

    </div>
  );
};

export default ErpLayout;
