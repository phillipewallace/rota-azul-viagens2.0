import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import MobileBottomNav from './MobileBottomNav';

/**
 * MobileFrame
 * ------------------------------------------------------------------
 * Casca mobile-first "cheia": header sticky compacto + bottom nav +
 * área de conteúdo com respiro para safe-area. Usada nas telas
 * mobile-nativas (Home, Menu). Páginas existentes usam MobileWrap.
 */

const ROOT_PATHS = new Set(['/', '/routes', '/trucks', '/erp', '/menu']);

const TITLES: Record<string, string> = {
  '/': 'Início',
  '/routes': 'Rotas',
  '/trucks': 'Caminhões',
  '/drivers': 'Motoristas',
  '/customers': 'Clientes',
  '/sanitarios': 'Sanitários',
  '/carretinhas': 'Carretinhas',
  '/maintenance': 'Manutenção',
  '/rotas-concluidas': 'Rotas concluídas',
  '/checklists': 'Checklists',
  '/gestao-interna': 'Gestão interna',
  '/settings': 'Configurações',
  '/menu': 'Menu',
  '/erp': 'ERP',
  '/erp/financeiro': 'Financeiro',
  '/erp/contratos': 'Contratos',
  '/erp/orcamentos': 'Orçamentos',
  '/erp/ordens-servico': 'Ordens de serviço',
  '/erp/clientes': 'Clientes',
  '/erp/empresas': 'Empresas',
  '/erp/estoque': 'Estoque',
};

interface MobileFrameProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  headerAction?: ReactNode;
}

const MobileFrame = ({ children, title, showBack, headerAction }: MobileFrameProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const inferredTitle = TITLES[location.pathname] ?? 'AlchemyRotas';
  const currentTitle = title ?? inferredTitle;
  const isRoot = ROOT_PATHS.has(location.pathname);
  // Auto: rotas-raiz nunca mostram back; sub-rotas mostram por padrão.
  const backVisible = (showBack ?? !isRoot) && !isRoot;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header
        className={cn(
          'sticky top-0 z-40 bg-background/80 backdrop-blur-xl',
          'border-b border-border/60 safe-area-top',
        )}
      >
        <div className="h-14 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {backVisible ? (
              <button
                onClick={() => navigate(-1)}
                aria-label="Voltar"
                className={cn(
                  'h-10 w-10 -ml-2 grid place-items-center rounded-full',
                  'text-foreground/80 hover:text-foreground hover:bg-muted',
                  'active:scale-95 transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <div
                aria-hidden
                className="h-8 w-8 rounded-lg shadow-sm bg-gradient-to-br from-[hsl(var(--brand))] via-[hsl(var(--brand-2))] to-[hsl(var(--brand-3))] grid place-items-center"
              >
                <span className="text-[13px] font-display font-bold text-brand-foreground">A</span>
              </div>
            )}
            <h1 className="font-display text-[17px] font-semibold tracking-tight truncate">
              {currentTitle}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {headerAction ?? (
              <button
                aria-label="Notificações"
                className={cn(
                  'h-10 w-10 grid place-items-center rounded-full',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  'active:scale-95 transition-all duration-200',
                )}
              >
                <Bell className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 pb-24">{children}</main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileFrame;
