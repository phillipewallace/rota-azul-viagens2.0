import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck as TruckIcon,
  Users,
  Route as RouteIcon,
  Wrench,
  ArrowUpRight,
  CircleDot,
  Container,
  Briefcase,
  FileText,
  Wallet,
  ClipboardList,
} from 'lucide-react';
import MobileFrame from './MobileFrame';
import { useTrucks } from '@/hooks/useTrucks';
import { useDrivers } from '@/hooks/useDrivers';
import { useRoutes } from '@/hooks/useRoutes';
import { cn } from '@/lib/utils';

/**
 * MobileHome
 * ------------------------------------------------------------------
 * Painel-início mobile: saudação, KPIs reais (frota/motoristas/rotas),
 * atalhos para os módulos, e status resumido da operação.
 * Reutiliza os mesmos hooks do desktop — nada novo no backend.
 */

const greet = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const KpiCard = ({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'success' | 'warning' | 'info';
  to?: string;
}) => {
  const toneMap = {
    default: 'text-foreground',
    success: 'text-[hsl(var(--success))]',
    warning: 'text-[hsl(var(--warning))]',
    info: 'text-[hsl(var(--info))]',
  } as const;

  const Wrapper: any = to ? Link : 'div';
  const wrapperProps = to ? { to } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        'group relative overflow-hidden rounded-2xl p-4',
        'bg-card border border-border/60',
        'shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]',
        'transition-all duration-200 active:scale-[0.98]',
        to && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span
          className={cn(
            'h-9 w-9 rounded-xl grid place-items-center',
            'bg-muted/70',
            toneMap[tone],
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        {to && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
        )}
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-1 font-display text-2xl font-bold nums-tabular', toneMap[tone])}>
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-muted-foreground truncate">{hint}</p>
      )}
    </Wrapper>
  );
};

const Shortcut = ({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <Link
    to={to}
    className={cn(
      'flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl',
      'bg-card border border-border/60',
      'hover:bg-accent/40 hover:border-border transition-colors duration-200',
      'active:scale-[0.97]',
    )}
  >
    <span className="h-11 w-11 rounded-full grid place-items-center bg-gradient-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-3))] shadow-[var(--shadow-sm)]">
      <Icon className="h-5 w-5 text-brand-foreground" />
    </span>
    <span className="text-[11.5px] font-medium text-foreground/90 text-center leading-tight">
      {label}
    </span>
  </Link>
);

const MobileHome = () => {
  const { trucks, loading: trucksLoading } = useTrucks();
  const { drivers, loading: driversLoading } = useDrivers();
  const { routes, loading: routesLoading } = useRoutes();

  const stats = useMemo(() => {
    const inRoute = trucks.filter((t) => t.status === 'in-route').length;
    const maint = trucks.filter((t) => t.status === 'maintenance').length;
    const activeDrivers = drivers.filter((d) => d.status === 'active').length;
    const activeRoutes = routes.filter((r: any) => r.status === 'active' || r.status === 'in-progress').length;
    return { inRoute, maint, total: trucks.length, activeDrivers, activeRoutes, routesTotal: routes.length };
  }, [trucks, drivers, routes]);

  const userName =
    (typeof window !== 'undefined' && localStorage.getItem('user_name')) || 'Operador';

  const loading = trucksLoading || driversLoading || routesLoading;

  return (
    <MobileFrame title="Início">
      <div className="px-4 pt-3 pb-6 space-y-6">
        {/* Saudação */}
        <section>
          <p className="text-sm text-muted-foreground">{greet()},</p>
          <h2 className="mt-0.5 font-display text-2xl font-bold tracking-tight">
            {userName.split(' ')[0]}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aqui está o resumo da operação hoje.
          </p>
        </section>

        {/* KPIs */}
        <section aria-label="Indicadores" className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Em rota"
            value={loading ? '—' : stats.inRoute}
            hint={loading ? 'Carregando…' : `${stats.total} caminhões no total`}
            icon={CircleDot}
            tone="success"
            to="/trucks"
          />
          <KpiCard
            label="Rotas ativas"
            value={loading ? '—' : stats.activeRoutes}
            hint={loading ? 'Carregando…' : `${stats.routesTotal} cadastradas`}
            icon={RouteIcon}
            tone="info"
            to="/routes"
          />
          <KpiCard
            label="Motoristas"
            value={loading ? '—' : stats.activeDrivers}
            hint={loading ? 'Carregando…' : `${drivers.length} cadastrados`}
            icon={Users}
            to="/drivers"
          />
          <KpiCard
            label="Em manutenção"
            value={loading ? '—' : stats.maint}
            hint="Caminhões parados"
            icon={Wrench}
            tone={stats.maint > 0 ? 'warning' : 'default'}
            to="/maintenance"
          />
        </section>

        {/* Ações rápidas */}
        <section aria-label="Ações rápidas" className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="text-sm font-semibold text-foreground">Ações rápidas</h3>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Shortcut to="/routes/create" label="Nova rota" icon={RouteIcon} />
            <Shortcut to="/trucks" label="Frota" icon={TruckIcon} />
            <Shortcut to="/sanitarios" label="Sanitários" icon={Container} />
            <Shortcut to="/customers" label="Clientes" icon={Users} />
          </div>
        </section>

        {/* Atalhos ERP */}
        <section aria-label="ERP" className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="text-sm font-semibold text-foreground">ERP</h3>
            <Link to="/erp" className="text-xs font-medium text-primary hover:underline">
              Ver tudo
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/erp/financeiro"
              className="rounded-2xl p-4 bg-gradient-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-2))] text-brand-foreground shadow-[var(--shadow-md)] active:scale-[0.98] transition-transform"
            >
              <Wallet className="h-5 w-5 opacity-90" />
              <p className="mt-3 font-display font-semibold">Financeiro</p>
              <p className="text-xs opacity-80 mt-0.5">Recibos e faturamento</p>
            </Link>
            <Link
              to="/erp/contratos"
              className="rounded-2xl p-4 bg-card border border-border/60 shadow-[var(--shadow-sm)] active:scale-[0.98] transition-transform"
            >
              <FileText className="h-5 w-5 text-primary" />
              <p className="mt-3 font-display font-semibold">Contratos</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ativos e vencimentos</p>
            </Link>
            <Link
              to="/erp/orcamentos"
              className="rounded-2xl p-4 bg-card border border-border/60 shadow-[var(--shadow-sm)] active:scale-[0.98] transition-transform"
            >
              <ClipboardList className="h-5 w-5 text-[hsl(var(--info))]" />
              <p className="mt-3 font-display font-semibold">Orçamentos</p>
              <p className="text-xs text-muted-foreground mt-0.5">Propostas em aberto</p>
            </Link>
            <Link
              to="/erp/ordens-servico"
              className="rounded-2xl p-4 bg-card border border-border/60 shadow-[var(--shadow-sm)] active:scale-[0.98] transition-transform"
            >
              <Briefcase className="h-5 w-5 text-[hsl(var(--success))]" />
              <p className="mt-3 font-display font-semibold">Ordens</p>
              <p className="text-xs text-muted-foreground mt-0.5">Serviços em execução</p>
            </Link>
          </div>
        </section>
      </div>
    </MobileFrame>
  );
};

export default MobileHome;
