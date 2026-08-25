
import React, { useEffect, useState } from 'react';
import { Menu, MapPin, Route, Truck, Settings, Users, ClipboardCheck, Container, FileText, AlertTriangle, Clock, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Map from '@/components/Map';
import TrackingPanel from '@/components/TrackingPanel';
import LinkRouteModal from '@/components/LinkRouteModal';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileHome from '@/mobile/MobileHome';
import { serviceOrdersService } from '@/services/quotes';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { confirmDialog } from '@/lib/confirm';

const Index = () => {
  const isMobile = useIsMobile();
  const [isLinkRouteOpen, setIsLinkRouteOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
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
    if (isMobile) return;
    let mounted = true;
    const check = async () => {
      try {
        const r = await serviceOrdersService.overdueCount();
        if (!mounted) return;
        if (r.overdue > 0 && r.overdue !== overdueCount) {
          toast.warning(`${r.overdue} diária(s) em atraso para recolhimento`, {
            duration: 8000,
            action: { label: 'Ver OS', onClick: () => { window.location.href = '/erp/ordens-servico'; } },
          });
        }
        setOverdueCount(r.overdue);
      } catch {}
    };
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Render mobile version for operator
  if (isMobile) {
    return <MobileHome />;
  }

  const menuItems = [
    { icon: Truck, label: 'Vincular Rota ao Caminhão', action: () => setIsLinkRouteOpen(true) },
  ];

  const navigationItems = [
    { icon: MapPin, label: 'Mapa Principal', to: '/' },
    { icon: Route, label: 'Rotas', to: '/routes' },
    { icon: Route, label: 'Rotas Concluídas', to: '/rotas-concluidas' },
    { icon: Settings, label: 'Sanitários', to: '/sanitarios' },
    { icon: Truck, label: 'Caminhões', to: '/trucks' },
    { icon: Container, label: 'Carretinhas', to: '/carretinhas' },
    { icon: ClipboardCheck, label: 'Checklists', to: '/checklists' },
    { icon: Users, label: 'Clientes', to: '/customers' },
    { icon: Settings, label: 'Gerenciamento', to: '/management' },
    { icon: Users, label: 'Funcionários', to: '/funcionarios' },
    
    { icon: Settings, label: 'Configurações', to: '/settings' },
  ];

  // ERP é um módulo separado e abre em nova aba — compartilha dados com o sistema principal


  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="fixed top-4 left-4 z-20 min-h-11 min-w-11 rounded-lg bg-primary text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Abrir menu de navegação"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 max-w-[85vw] p-0">
          <div className="flex flex-col h-full bg-gray-900 text-white">
            <div className="p-4 sm:p-6 border-b border-gray-700">
              <h2 className="text-lg sm:text-xl font-bold text-blue-400">AlchemyRotas</h2>
              <p className="text-xs sm:text-sm text-gray-400">Sistema de Roteirização</p>
            </div>
            
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
              <div className="space-y-2">
                {menuItems.map((item) => (
                  <Button
                    key={item.label}
                    variant="ghost"
                    className="w-full justify-start text-left text-white hover:bg-gray-800 hover:text-blue-400 text-sm"
                    onClick={item.action}
                  >
                    <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Button>
                ))}
              </div>
              
              <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-700">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-400 mb-3">NAVEGAÇÃO</h3>
                <div className="space-y-2">
                  {navigationItems.map((item) => (
                    <Button key={item.to} variant="ghost" className="w-full justify-start text-white hover:bg-gray-800 text-sm" asChild>
                      <Link to={item.to}>
                        <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                        <span className="truncate flex-1">{item.label}</span>
                        {item.to === '/erp/ordens-servico' && overdueCount > 0 && (
                          <Badge className="bg-red-600 text-white text-[10px] h-5 gap-1 ml-auto">
                            <AlertTriangle className="h-3 w-3" />{overdueCount}
                          </Badge>
                        )}
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-700">
                <a
                  href="/erp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block rounded-xl p-4 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-500 hover:via-indigo-600 hover:to-purple-600 shadow-lg shadow-indigo-900/40 transition-all overflow-hidden"
                >
                  <div className="absolute -right-6 -top-6 h-24 w-24 bg-white/10 rounded-full blur-2xl" />
                  <div className="relative flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Abrir ERP Suite</span>
                        {overdueCount > 0 && (
                          <Badge className="bg-red-500 text-white text-[10px] h-5 gap-1">
                            <AlertTriangle className="h-3 w-3" />{overdueCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-indigo-100/90 mt-0.5">Orçamentos, OS, Estoque · nova aba</p>
                    </div>
                    <span className="text-indigo-100 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </a>
                <a
                  href="/app-funcionarios"
                  className="mt-3 group relative block rounded-xl p-4 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 border border-slate-600 hover:from-slate-600 hover:via-slate-700 hover:to-slate-800 shadow-lg shadow-black/20 transition-all overflow-hidden"
                >
                  <div className="absolute -right-6 -top-6 h-24 w-24 bg-white/5 rounded-full blur-2xl" />
                  <div className="relative flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-white block">App Funcionários</span>
                      <p className="text-[10px] text-slate-300 mt-0.5 italic">Agenda de campo · Offline ready</p>
                    </div>
                    <span className="text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </a>
                
                <p className="text-[10px] text-gray-500 mt-2 text-center">
                  Sistemas operacionais · dados sincronizados em tempo real
                </p>


              </div>

            </div>

            {/* Rodapé — usuário logado + logout */}
            <div className="border-t border-white/10 p-3 sm:p-4 space-y-2">
              {user && (
                <div className="px-1 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">Conectado como</p>
                    <p className="text-sm font-medium text-white truncate">{user.name || user.username}</p>
                  </div>
                </div>
              )}
              <Button
                variant="ghost"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full justify-start gap-3 text-destructive hover:bg-destructive/15 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40 transition-colors duration-200 active:scale-[0.98] disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                <span>{loggingOut ? 'Saindo…' : 'Sair da conta'}</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 relative w-full">
        <Map />
        <TrackingPanel />
      </div>

      {/* Modals */}
      <LinkRouteModal open={isLinkRouteOpen} onOpenChange={setIsLinkRouteOpen} />
    </div>
  );
};

export default Index;
