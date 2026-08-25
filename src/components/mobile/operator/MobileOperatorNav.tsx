import { Link, useLocation } from 'react-router-dom';
import { MapPin, Route, Truck, Users, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigationItems = [
  { icon: MapPin, label: 'Mapa', to: '/' },
  { icon: Route, label: 'Rotas', to: '/routes' },
  { icon: Truck, label: 'Caminhões', to: '/trucks' },
  { icon: Users, label: 'Motoristas', to: '/drivers' },
  { icon: Menu, label: 'Menu', to: '/menu' },
];

const MobileOperatorNav = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border z-50 safe-area-bottom"
    >
      <ul className="flex justify-around items-stretch h-16">
        {navigationItems.map((item) => {
          const active = isActive(item.to);
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={cn(
                  'group relative flex flex-col items-center justify-center h-full px-2 min-h-11',
                  'transition-colors duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground active:text-primary',
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary"
                  />
                )}
                <item.icon
                  className={cn(
                    'h-5 w-5 mb-0.5 transition-transform duration-200',
                    active && 'scale-110',
                  )}
                />
                <span className="text-[11px] font-medium leading-tight">
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

export default MobileOperatorNav;
