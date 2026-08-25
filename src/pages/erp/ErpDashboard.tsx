/**
 * ERP · Command Center
 * Dashboard executivo com KPIs coloridos, séries financeiras,
 * distribuição de estoque, próximas entregas e recibos pendentes.
 * Tokens HSL semânticos (dark mode grátis). Zero cor chumbada em componentes.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, ClipboardList, Users, Boxes, AlertTriangle, TrendingUp, TrendingDown,
  ArrowUpRight, Building2, Activity, DollarSign, PackageCheck,
  TruckIcon, Wrench, Sparkles, CalendarClock, Receipt as ReceiptIcon,
  ArrowRight, BarChart3, PieChart as PieIcon, Wallet, Target,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { quotesService, serviceOrdersService, type ServiceOrder } from '@/services/quotes';
import { erpService, fetchSanitarioStockSummary, type SanitarioStockSummary } from '@/services/erp';
import { receiptsService, type ReceiptsSummaryPoint, type PendingReceipt } from '@/services/contracts';
import { useCustomers } from '@/hooks/useCustomers';
import { parseLocalDate } from '@/utils/dateFormat';

// ---------- helpers ----------
import { BRL, BRLc } from '@/utils/currency';
const NUM = (n: number) => (Number(n) || 0).toLocaleString('pt-BR');
const formatComp = (yyyyMm: string) => {
  const [y, m] = yyyyMm.split('-');
  const names = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${names[Number(m) - 1] || m}/${y.slice(-2)}`;
};

// ---------- tokens (evita `hsl(var(--x))` repetido) ----------
const T = {
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))',
  info: 'hsl(var(--info))',
  primary: 'hsl(var(--primary))',
  brand3: 'hsl(var(--brand-3))',
  muted: 'hsl(var(--muted-foreground))',
  border: 'hsl(var(--border))',
  card: 'hsl(var(--card))',
};

// ---------- KPI ----------
type Tone = 'primary' | 'success' | 'warning' | 'destructive' | 'info';
const toneMap: Record<Tone, { chip: string; icon: string; bar: string; dot: string }> = {
  primary:     { chip: 'bg-primary/10 text-primary',         icon: 'bg-primary/10 text-primary',         bar: 'bg-primary',       dot: 'bg-primary' },
  success:     { chip: 'bg-success/10 text-success',         icon: 'bg-success/10 text-success',         bar: 'bg-success',       dot: 'bg-success' },
  warning:     { chip: 'bg-warning/15 text-warning',         icon: 'bg-warning/15 text-warning',         bar: 'bg-warning',       dot: 'bg-warning' },
  destructive: { chip: 'bg-destructive/10 text-destructive', icon: 'bg-destructive/10 text-destructive', bar: 'bg-destructive',   dot: 'bg-destructive' },
  info:        { chip: 'bg-info/10 text-info',               icon: 'bg-info/10 text-info',               bar: 'bg-info',          dot: 'bg-info' },
};

const KpiCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  delta?: { value: string; positive?: boolean };
}> = ({ label, value, hint, icon: Icon, tone, delta }) => {
  const t = toneMap[tone];
  return (
    <Card className="group relative overflow-hidden border-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className={cn('absolute inset-x-0 top-0 h-[3px]', t.bar)} />
      <CardContent className="p-3.5 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] sm:text-[10.5px] font-semibold uppercase tracking-wider truncate max-w-[70%]', t.chip)}>
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', t.dot)} />
            <span className="truncate">{label}</span>
          </span>
          <span className={cn('inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl transition-transform group-hover:scale-105 shrink-0', t.icon)}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
        </div>
        <p className="mt-3 sm:mt-4 font-display text-[22px] sm:text-[2rem] leading-none font-semibold tabular-nums tracking-tight text-foreground truncate">
          {value}
        </p>
        <div className="mt-1.5 sm:mt-2 flex items-center justify-between gap-2">
          <p className="text-[10.5px] sm:text-xs text-muted-foreground leading-tight sm:leading-relaxed line-clamp-2">{hint}</p>
          {delta && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[10.5px] sm:text-[11px] font-semibold shrink-0',
              delta.positive ? 'text-success' : 'text-destructive',
            )}>
              {delta.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta.value}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};


// ---------- Section header ----------
const SectionHeader: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  tone?: Tone;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, tone = 'primary', action }) => {
  const t = toneMap[tone];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg', t.icon)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-foreground truncate">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
};

// ---------- Chart tooltip ----------
const ChartTip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-semibold text-foreground tabular-nums">{BRL(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- Modules ----------
const modulesConfig: Array<{
  to: string; icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; tone: Tone;
}> = [
  { to: '/erp/orcamentos',     icon: FileText,     title: 'Orçamentos',       desc: 'Propostas e conversões',          tone: 'info' },
  { to: '/erp/ordens-servico', icon: ClipboardList, title: 'Ordens de Serviço', desc: 'Execução e atrasos',              tone: 'primary' },
  { to: '/erp/contratos',      icon: PackageCheck, title: 'Contratos',        desc: 'Locação recorrente',              tone: 'success' },
  { to: '/erp/financeiro',     icon: DollarSign,   title: 'Financeiro',       desc: 'Recibos, gastos e resultado',     tone: 'warning' },
  { to: '/erp/clientes',       icon: Users,        title: 'Clientes',         desc: 'Cadastro unificado',              tone: 'info' },
  { to: '/sanitarios',         icon: TruckIcon,    title: 'Sanitários',       desc: 'Frota e alocação',                tone: 'destructive' },
  { to: '/erp/empresas',       icon: Building2,    title: 'Empresas',         desc: 'CNPJs emissores',                 tone: 'success' },
  { to: '/sanitarios',         icon: TruckIcon,    title: 'Sanitários',       desc: 'Frota e alocação',                tone: 'destructive' },
];

// ---------- Skeleton ----------
const Sk: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} />
);

// ============================================================================
// Page
// ============================================================================
const ErpDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [os, setOs] = useState<ServiceOrder[]>([]);
  const [stock, setStock] = useState<SanitarioStockSummary | null>(null);
  const [items, setItems] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [series, setSeries] = useState<ReceiptsSummaryPoint[]>([]);
  const [pending, setPending] = useState<PendingReceipt[]>([]);
  const [upcoming, setUpcoming] = useState<Array<any>>([]);
  const { customers } = useCustomers();

  useEffect(() => {
    (async () => {
      try {
        const [q, o, s, it, ov, sum, pend, up] = await Promise.all([
          quotesService.list().catch(() => []),
          serviceOrdersService.list().catch(() => []),
          fetchSanitarioStockSummary().catch(() => null),
          erpService.listItems().then((x) => x.length).catch(() => 0),
          serviceOrdersService.overdueCount().then((r) => r.overdue).catch(() => 0),
          receiptsService.summary(12).then((r) => r.series).catch(() => []),
          receiptsService.pending().then((r) => r.pendentes).catch(() => []),
          serviceOrdersService.upcoming().catch(() => []),
        ]);
        setQuotes(q); setOs(o); setStock(s); setItems(it); setOverdue(ov);
        setSeries(sum); setPending(pend); setUpcoming(up);
      } finally { setLoading(false); }
    })();
  }, []);

  const {
    receitaAberta, receitaFechada, orcAprovados, orcRascunho, orcEnviados,
    osAbertas, gastoMes, resultadoMes, deltaReceita,
  } = useMemo(() => {
    const last = series[series.length - 1];
    const prev = series[series.length - 2];
    const delta = last && prev && prev.recebido > 0
      ? ((last.recebido - prev.recebido) / prev.recebido) * 100
      : 0;
    return {
      receitaAberta:  os.filter((x) => x.status === 'aberta').reduce((a, b) => a + Number(b.valorTotal || 0), 0),
      receitaFechada: os.filter((x) => x.status === 'fechada').reduce((a, b) => a + Number(b.valorTotal || 0), 0),
      orcAprovados:   quotes.filter((q) => q.status === 'aprovado').length,
      orcRascunho:    quotes.filter((q) => q.status === 'rascunho').length,
      orcEnviados:    quotes.filter((q) => q.status === 'enviado').length,
      osAbertas:      os.filter((x) => x.status === 'aberta').length,
      gastoMes:       last?.gasto ?? 0,
      resultadoMes:   last?.resultado ?? 0,
      deltaReceita:   delta,
    };
  }, [os, quotes, series]);

  const chartData = useMemo(
    () => series.map(s => ({ ...s, label: formatComp(s.competencia) })),
    [series]
  );

  const stockPie = useMemo(() => {
    if (!stock) return [];
    return [
      { name: 'Disponíveis', value: stock.disponivel,          color: T.success },
      { name: 'Em cliente',  value: stock.em_cliente,          color: T.primary },
      { name: 'Em OS',       value: stock.em_os || 0,          color: T.info },
      { name: 'Manutenção',  value: stock.manutencao,          color: T.warning },
    ].filter(x => x.value > 0);
  }, [stock]);

  const totalPendente = useMemo(
    () => pending.reduce((a, b) => a + Number(b.valorMensal || 0), 0),
    [pending]
  );

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <Sk className="h-40 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <Sk key={i} className="h-36" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Sk className="h-80 lg:col-span-2" />
          <Sk className="h-80" />
        </div>
        <Sk className="h-64" />
      </div>
    );
  }

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">


        {/* ========= HERO ========= */}
        <section
          className="relative overflow-hidden rounded-2xl border border-border/50 p-5 sm:p-6 md:p-8 text-brand-foreground"
          style={{ background: 'var(--gradient-brand)' }}
        >
          {/* orbes decorativos */}
          <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/5 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm">
                <Activity className="h-3 w-3" /> Command Center
              </div>
              <h1 className="mt-3 font-display text-[22px] leading-[1.15] sm:text-3xl md:text-[2.5rem] font-semibold tracking-tight">
                Bom dia. Aqui está o seu ERP.
              </h1>
              <p className="mt-1.5 text-[12px] sm:text-sm md:text-base opacity-80 capitalize">{today}</p>
            </div>

            {/* stats inline hero */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 min-w-0 md:min-w-[420px]">
              <div className="rounded-xl bg-white/10 backdrop-blur-sm px-2.5 py-2.5 sm:px-3 sm:py-3 md:px-4 md:py-4 border border-white/10">
                <p className="text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-wider opacity-70 truncate">Recebido</p>
                <p className="mt-1 font-display text-base sm:text-xl md:text-2xl font-semibold tabular-nums leading-none">{BRLc(series[series.length - 1]?.recebido || 0)}</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm px-2.5 py-2.5 sm:px-3 sm:py-3 md:px-4 md:py-4 border border-white/10">
                <p className="text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-wider opacity-70">OS ativas</p>
                <p className="mt-1 font-display text-base sm:text-xl md:text-2xl font-semibold tabular-nums leading-none">{NUM(osAbertas)}</p>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm px-2.5 py-2.5 sm:px-3 sm:py-3 md:px-4 md:py-4 border border-white/10">
                <p className="text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-wider opacity-70">Clientes</p>
                <p className="mt-1 font-display text-base sm:text-xl md:text-2xl font-semibold tabular-nums leading-none">{NUM(customers.length)}</p>
              </div>
            </div>
          </div>

          {overdue > 0 && (
            <div className="relative mt-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-white/20 bg-destructive/25 backdrop-blur-sm px-3.5 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-[13px] sm:text-sm font-medium">
                <strong>{overdue} OS em atraso</strong> — ação imediata.
              </span>
              <Button asChild size="sm" variant="secondary" className="ml-auto h-8 bg-white text-destructive hover:bg-white/90">
                <Link to="/erp/ordens-servico">Ver <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
              </Button>
            </div>
          )}
        </section>


        {/* ========= KPIs ========= */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

          <KpiCard
            label="Receita fechada"
            value={BRLc(receitaFechada)}
            hint="Somatório de OS finalizadas"
            icon={TrendingUp}
            tone="success"
            delta={deltaReceita !== 0 ? { value: `${deltaReceita > 0 ? '+' : ''}${deltaReceita.toFixed(1)}%`, positive: deltaReceita >= 0 } : undefined}
          />
          <KpiCard
            label="Receita em aberto"
            value={BRLc(receitaAberta)}
            hint={`${osAbertas} OS aguardando fechamento`}
            icon={Wallet}
            tone="primary"
          />
          <KpiCard
            label="Recibos pendentes"
            value={BRLc(totalPendente)}
            hint={`${pending.length} a emitir neste ciclo`}
            icon={ReceiptIcon}
            tone="warning"
          />
          <KpiCard
            label={overdue > 0 ? 'OS em atraso' : 'Tudo em dia'}
            value={NUM(overdue)}
            hint={overdue > 0 ? 'Requer atenção imediata' : 'Nenhuma OS atrasada'}
            icon={overdue > 0 ? AlertTriangle : Target}
            tone={overdue > 0 ? 'destructive' : 'success'}
          />
        </section>

        {/* ========= CHART FINANCEIRO + PIE ESTOQUE (desktop only) ========= */}
        <section className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

          {/* Composed chart */}
          <Card className="lg:col-span-2 border-border/60 overflow-hidden">
            <CardContent className="p-5 md:p-6">
              <SectionHeader
                icon={BarChart3}
                title="Fluxo financeiro"
                subtitle="Recebido, gasto e resultado dos últimos 12 meses"
                tone="info"
                action={
                  <div className="hidden sm:flex items-center gap-3 text-[11px]">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" /> Recebido</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-destructive" /> Gasto</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-primary" /> Resultado</span>
                  </div>
                }
              />
              {chartData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer>
                    <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={T.primary} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={T.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.muted }} axisLine={{ stroke: T.border }} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: T.muted }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                      />
                      <Tooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                      <Bar dataKey="recebido" name="Recebido" fill={T.success} radius={[6, 6, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="gasto"    name="Gasto"    fill={T.destructive} radius={[6, 6, 0, 0]} maxBarSize={26} />
                      <Area type="monotone" dataKey="resultado" name="Resultado" stroke="transparent" fill="url(#gRes)" />
                      <Line type="monotone" dataKey="resultado" name="Resultado" stroke={T.primary} strokeWidth={2.5} dot={{ r: 3, fill: T.primary }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                  Sem dados financeiros no período.
                </div>
              )}
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recebido (mês)</p>
                  <p className="mt-0.5 font-display text-lg font-semibold text-success tabular-nums">{BRL(series[series.length - 1]?.recebido || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gasto (mês)</p>
                  <p className="mt-0.5 font-display text-lg font-semibold text-destructive tabular-nums">{BRL(gastoMes)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Resultado</p>
                  <p className={cn('mt-0.5 font-display text-lg font-semibold tabular-nums', resultadoMes >= 0 ? 'text-primary' : 'text-destructive')}>
                    {BRL(resultadoMes)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pie: estoque */}
          <Card className="border-border/60 overflow-hidden">
            <CardContent className="p-5 md:p-6">
              <SectionHeader
                icon={PieIcon}
                title="Estoque de sanitários"
                subtitle={stock ? `${NUM(stock.total)} unidades no total` : 'Sem dados'}
                tone="primary"
                action={
                  <Link to="/sanitarios" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
                    Detalhar <ArrowUpRight className="h-3 w-3" />
                  </Link>
                }
              />
              {stockPie.length > 0 ? (
                <>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={stockPie}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          stroke={T.card}
                          strokeWidth={2}
                        >
                          {stockPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: `1px solid ${T.border}`,
                            background: 'hsl(var(--popover))',
                            color: 'hsl(var(--popover-foreground))',
                            fontSize: 12,
                          }}
                          formatter={(v: any, n: any) => [`${NUM(Number(v))} un`, n]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {stockPie.map((s) => {
                      const total = stockPie.reduce((a, b) => a + b.value, 0);
                      const pct = total ? (s.value / total) * 100 : 0;
                      return (
                        <div key={s.name} className="flex items-center gap-3 text-xs">
                          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                          <span className="text-muted-foreground flex-1 truncate">{s.name}</span>
                          <span className="font-semibold text-foreground tabular-nums">{NUM(s.value)}</span>
                          <span className="text-muted-foreground tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                  Sem dados de estoque.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ========= UPCOMING + PENDENTES ========= */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Próximas entregas */}
          <Card className="border-border/60">
            <CardContent className="p-5 md:p-6">
              <SectionHeader
                icon={CalendarClock}
                title="Próximas entregas & recolhimentos"
                subtitle="OS agendadas para os próximos dias"
                tone="info"
                action={
                  <Link to="/erp/ordens-servico" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
                    Ver todas <ArrowUpRight className="h-3 w-3" />
                  </Link>
                }
              />
              {upcoming.length > 0 ? (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-hidden rounded-lg border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-semibold">OS</th>
                          <th className="text-left px-3 py-2.5 font-semibold">Cliente</th>
                          <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Endereço</th>
                          <th className="text-right px-3 py-2.5 font-semibold">Quando</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {upcoming.slice(0, 6).map((u) => (
                          <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2.5">
                              <Link to="/erp/ordens-servico" className="font-mono text-xs font-semibold text-primary hover:underline">
                                #{u.numero}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 text-foreground truncate max-w-[200px]">{u.customerName || '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[240px] hidden md:table-cell">
                              {u.enderecoEntrega || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {u.hoje ? (
                                <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/15 border-transparent">Hoje</Badge>
                              ) : u.amanha ? (
                                <Badge className="bg-warning/15 text-warning hover:bg-warning/20 border-transparent">Amanhã</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {(parseLocalDate(u.dataEntrega) ?? new Date()).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <ul className="md:hidden divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden">
                    {upcoming.slice(0, 6).map((u) => (
                      <li key={u.id}>
                        <Link
                          to="/erp/ordens-servico"
                          className="flex items-center gap-3 px-3 py-3 active:bg-muted/40 transition-colors"
                        >
                          <span className="inline-flex flex-col items-center justify-center h-11 w-11 shrink-0 rounded-lg bg-info/10 text-info">
                            <span className="text-[9px] font-semibold uppercase tracking-wider leading-none">
                              {(parseLocalDate(u.dataEntrega) ?? new Date()).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                            </span>
                            <span className="font-display text-sm font-bold leading-none mt-0.5 tabular-nums">
                              {(parseLocalDate(u.dataEntrega) ?? new Date()).getDate()}
                            </span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">{u.customerName || '—'}</p>
                              <span className="font-mono text-[10.5px] text-muted-foreground">#{u.numero}</span>
                            </div>
                            <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">{u.enderecoEntrega || 'Sem endereço'}</p>
                          </div>
                          {u.hoje ? (
                            <Badge className="bg-destructive/10 text-destructive border-transparent text-[10.5px] shrink-0">Hoje</Badge>
                          ) : u.amanha ? (
                            <Badge className="bg-warning/15 text-warning border-transparent text-[10.5px] shrink-0">Amanhã</Badge>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-center text-sm text-muted-foreground gap-2">
                  <CalendarClock className="h-8 w-8 text-muted-foreground/40" />
                  Nenhuma entrega agendada.
                </div>
              )}

            </CardContent>
          </Card>

          {/* Recibos pendentes */}
          <Card className="border-border/60">
            <CardContent className="p-5 md:p-6">
              <SectionHeader
                icon={ReceiptIcon}
                title="Recibos pendentes"
                subtitle={`${pending.length} contratos aguardando emissão`}
                tone="warning"
                action={
                  <Link to="/erp/financeiro" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
                    Emitir <ArrowUpRight className="h-3 w-3" />
                  </Link>
                }
              />
              {pending.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {pending.slice(0, 6).map((p) => (
                    <li key={p.contractId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning font-semibold text-xs">
                        {String(p.diaVencimento || 0).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{p.customerName || 'Cliente'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Contrato #{p.contractNumero} · vence dia {p.diaVencimento}
                        </p>
                      </div>
                      <span className="font-display text-sm font-semibold text-foreground tabular-nums">
                        {BRL(p.valorMensal)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-center text-sm text-muted-foreground gap-2">
                  <ReceiptIcon className="h-8 w-8 text-success/50" />
                  Nenhum recibo pendente. 🎉
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ========= MÓDULOS ========= */}
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">Módulos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Acesso rápido às áreas do ERP</p>
            </div>
            <span className="text-xs text-muted-foreground">{modulesConfig.length} áreas</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {modulesConfig.map((m) => {
              const t = toneMap[m.tone];
              return (
                <Link
                  key={m.to}
                  to={m.to}
                  className={cn(
                    'group relative flex flex-col rounded-xl border border-border/60 bg-card p-4 md:p-5 transition-all duration-200',
                    'hover:-translate-y-0.5 hover:shadow-md hover:border-border',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105', t.icon)}>
                      <m.icon className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:text-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <h3 className="mt-3 font-display text-sm font-semibold text-foreground">{m.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ========= INTEGRAÇÃO ========= */}
        <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-info/5 to-transparent p-5 md:p-6">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-sm font-semibold text-foreground">Integração AlchemyRotas</h3>
                <Badge className="bg-success/10 text-success border-transparent hover:bg-success/15 text-[10px] uppercase tracking-wider">Ativa</Badge>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-3xl">
                Clientes, sanitários e frota sincronizados em tempo real. Toda OS reserva estoque real e devolve automaticamente ao fechamento.
              </p>
            </div>
            <Wrench className="hidden md:block h-5 w-5 text-primary/30 shrink-0" />
          </div>
        </section>

      </div>
    </div>
  );
};

export default ErpDashboard;
