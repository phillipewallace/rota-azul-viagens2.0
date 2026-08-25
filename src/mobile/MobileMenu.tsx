import { Link, useNavigate } from 'react-router-dom';
import {
  Truck,
  Users,
  Route as RouteIcon,
  Wrench,
  Container,
  Package,
  ClipboardCheck,
  Building2,
  Wallet,
  FileText,
  ClipboardList,
  Briefcase,
  Boxes,
  Settings,
  LogOut,
  CheckSquare,
  ChevronRight,
} from 'lucide-react';
import MobileFrame from './MobileFrame';
import { cn } from '@/lib/utils';

/**
 * MobileMenu
 * ------------------------------------------------------------------
 * Índice completo do app organizado por seções. Cobre toda a
 * navegação existente com tap-targets grandes e agrupamento claro.
 */

type Item = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
};

const OPERATION: Item[] = [
  { to: '/routes', label: 'Rotas', icon: RouteIcon, hint: 'Roteirização e histórico' },
  { to: '/rotas-concluidas', label: 'Rotas concluídas', icon: CheckSquare, hint: 'Consultas e comprovantes' },
  { to: '/trucks', label: 'Caminhões', icon: Truck, hint: 'Frota e rastreamento' },
  { to: '/drivers', label: 'Motoristas', icon: Users, hint: 'Cadastro e status' },
  { to: '/carretinhas', label: 'Carretinhas', icon: Package, hint: 'Equipamentos rebocáveis' },
  { to: '/sanitarios', label: 'Sanitários', icon: Container, hint: 'Estoque e locação' },
  { to: '/maintenance', label: 'Manutenção', icon: Wrench, hint: 'Custos e histórico' },
  { to: '/checklists', label: 'Checklists', icon: ClipboardCheck, hint: 'Vistorias' },
];

const ERP: Item[] = [
  { to: '/erp', label: 'Dashboard ERP', icon: Briefcase },
  { to: '/erp/orcamentos', label: 'Orçamentos', icon: ClipboardList },
  { to: '/erp/ordens-servico', label: 'Ordens de serviço', icon: Briefcase },
  { to: '/erp/contratos', label: 'Contratos', icon: FileText },
  { to: '/erp/financeiro', label: 'Financeiro', icon: Wallet },
  { to: '/customers', label: 'Clientes', icon: Users },
  { to: '/sanitarios', label: 'Sanitários', icon: Container },
  { to: '/erp/empresas', label: 'Empresas emissoras', icon: Building2 },
];

const SYSTEM: Item[] = [
  { to: '/settings', label: 'Configurações', icon: Settings },
];

const Row = ({ item }: { item: Item }) => (
  <Link
    to={item.to}
    className={cn(
      'flex items-center gap-3 px-4 py-3.5',
      'active:bg-muted/70 transition-colors duration-150',
      'focus-visible:outline-none focus-visible:bg-muted',
    )}
  >
    <span className="h-10 w-10 rounded-xl grid place-items-center bg-muted/60 text-foreground/80 shrink-0">
      <item.icon className="h-[18px] w-[18px]" />
    </span>
    <div className="flex-1 min-w-0">
      <p className="text-[14.5px] font-medium text-foreground leading-tight">{item.label}</p>
      {item.hint && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.hint}</p>
      )}
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
  </Link>
);

const Section = ({ title, items }: { title: string; items: Item[] }) => (
  <section className="space-y-2">
    <h3 className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {title}
    </h3>
    <div className="bg-card border border-border/60 rounded-2xl divide-y divide-border/60 overflow-hidden shadow-[var(--shadow-sm)]">
      {items.map((item) => (
        <Row key={item.to} item={item} />
      ))}
    </div>
  </section>
);

const MobileMenu = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_role');
    } catch {
      /* noop */
    }
    navigate('/login', { replace: true });
  };

  return (
    <MobileFrame title="Menu">
      <div className="px-4 pt-3 pb-6 space-y-6">
        <Section title="Operação" items={OPERATION} />
        <Section title="ERP" items={ERP} />
        <Section title="Sistema" items={SYSTEM} />

        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl',
            'bg-destructive/10 text-destructive font-semibold text-sm',
            'active:bg-destructive/15 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40',
          )}
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>

        <p className="text-center text-[11px] text-muted-foreground pt-1">
          AlchemyRotas · v2.0
        </p>
      </div>
    </MobileFrame>
  );
};

export default MobileMenu;
