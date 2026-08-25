import { Link, useLocation } from 'react-router-dom';
import { Home, Route as RouteIcon, Truck, Briefcase, Menu as MenuIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * MobileBottomNav
 * ------------------------------------------------------------------
 * Bottom nav global do app mobile. Usado tanto pelo shell "cheio"
 * (MobileFrame) quanto pelo wrapper leve (MobileWrap) que apenas
 * complementa páginas com header próprio.
 */

const ITEMS = [
  { to: '/', label: 'Início', icon: Home, match: (p: string) => p === '/' },
  {
    to: '/routes',
    label: 'Rotas',
    icon: RouteIcon,
    match: (p: string) => p.startsWith('/routes') || p.startsWith('/rotas'),
  },
  {
    to: '/trucks',
    label: 'Frota',
    icon: Truck,
    match: (p: string) =>
      p.startsWith('/trucks') || p.startsWith('/funcionarios') || p.startsWith('/carretinhas'),
  },
  { to: '/erp', label: 'ERP', icon: Briefcase, match: (p: string) => p.startsWith('/erp') },
  {
    to: '/menu',
    label: 'Menu',
    icon: MenuIcon,
    match: (p: string) => p.startsWith('/menu') || p.startsWith('/settings'),
  },
];

const HIDDEN_PREFIXES = ['/login', '/mobile', '/checklist', '/operator'];

const MobileBottomNav = () => {
  const location = useLocation();
  if (HIDDEN_PREFIXES.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))) {
    return null;
  }
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'bg-background/85 backdrop-blur-xl',
        'border-t border-border/60 safe-area-bottom',
      )}
    >
      <ul className="grid grid-cols-5 h-16">
        {ITEMS.map((item) => {
          const active = item.match(location.pathname);
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={cn(
                  'group flex-1 flex flex-col items-center justify-center gap-0.5 relative',
                  'transition-colors duration-200 ease-out',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-1.5 h-9 w-14 rounded-full',
                    'bg-primary/10',
                    'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    active ? 'opacity-100 scale-100' : 'opacity-0 scale-90',
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-primary',
                    'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    active ? 'w-8 opacity-100' : 'w-0 opacity-0',
                  )}
                />
                <Icon
                  className={cn(
                    'relative h-[22px] w-[22px]',
                    'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    active ? 'scale-110 -translate-y-0.5' : 'scale-100 group-active:scale-95',
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span
                  className={cn(
                    'relative text-[10.5px] leading-none tracking-tight',
                    'transition-all duration-200',
                    active ? 'font-semibold opacity-100' : 'font-medium opacity-80',
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
