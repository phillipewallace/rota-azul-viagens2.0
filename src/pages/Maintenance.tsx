import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  FileText,
  Wrench,
  Calendar,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Clock,
  Truck as TruckIcon,
  Edit,
  Trash2,
  Filter,
  RefreshCw,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

import PageHeader from '@/components/PageHeader';
import { MaintenanceModal } from '@/components/MaintenanceModal';
import {
  useMaintenanceManagement,
  MaintenanceRecord,
} from '@/hooks/useMaintenanceManagement';
import { useTrucks } from '@/hooks/useTrucks';
import {
  generateMaintenanceOrderPdf,
  generateMaintenanceReportPdf,
} from '@/utils/maintenancePdf';
import { formatDateBR } from '@/utils/dateFormat';

import { confirmDialog } from '@/lib/confirm';
const TYPE_LABEL: Record<string, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
  preditiva: 'Preditiva',
  revisao: 'Revisão',
  inspecao: 'Inspeção',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendada',
  pending: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
};

const TYPE_COLORS = [
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(217 91% 60%)',
  'hsl(0 84% 60%)',
  'hsl(280 65% 60%)',
];

const formatBRL = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const Maintenance = () => {
  const { toast } = useToast();
  const today = new Date().toISOString().split('T')[0];
  const ninetyAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  })();

  const [startDate, setStartDate] = useState(ninetyAgo);
  const [endDate, setEndDate] = useState(today);
  const [selectedTruck, setSelectedTruck] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);

  const {
    maintenanceRecords,
    loading,
    loadMaintenanceRecords,
    createMaintenance,
    updateMaintenance,
    deleteMaintenance,
  } = useMaintenanceManagement();
  const { trucks } = useTrucks();

  useEffect(() => {
    loadMaintenanceRecords({
      startDate,
      endDate,
      truckId: selectedTruck !== 'all' ? selectedTruck : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      type: selectedType !== 'all' ? selectedType : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, selectedTruck, selectedStatus, selectedType]);

  const records = maintenanceRecords || [];

  // KPIs
  const kpis = useMemo(() => {
    const total = records.reduce((s, r) => s + (Number(r.cost) || 0), 0);
    const completed = records.filter((r) => r.status === 'completed').length;
    const pending = records.filter((r) => r.status !== 'completed').length;
    const avg = records.length ? total / records.length : 0;
    return { total, completed, pending, avg, count: records.length };
  }, [records]);

  // Alertas
  const alerts = useMemo(() => {
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + 30);

    const overdue: MaintenanceRecord[] = [];
    const upcoming: MaintenanceRecord[] = [];
    records.forEach((r) => {
      if (r.status === 'completed') return;
      if (!r.scheduled_date) return;
      const d = new Date(r.scheduled_date);
      if (d < now) overdue.push(r);
      else if (d <= limit) upcoming.push(r);
    });

    // próxima revisão por km (vs. próximo registro do mesmo caminhão)
    const kmAlerts = records
      .filter((r) => r.next_maintenance_km)
      .map((r) => {
        const truck = trucks.find((t) => t.id === r.truck_id);
        const currentKm = Number(truck?.mileage) || 0;
        const left = (r.next_maintenance_km || 0) - currentKm;
        return { ...r, currentKm, left };
      })
      .filter((r) => r.left <= 5000)
      .sort((a, b) => a.left - b.left);

    return { overdue, upcoming, kmAlerts };
  }, [records, trucks]);

  // Charts
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach((r) => {
      const k = TYPE_LABEL[r.maintenance_type] || r.maintenance_type || '—';
      map[k] = (map[k] || 0) + (Number(r.cost) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [records]);

  const byTruck = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach((r) => {
      const k = r.truck_name || r.truck_plate || '—';
      map[k] = (map[k] || 0) + (Number(r.cost) || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [records]);

  const monthly = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach((r) => {
      if (!r.scheduled_date) return;
      const d = new Date(r.scheduled_date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[k] = (map[k] || 0) + (Number(r.cost) || 0);
    });
    return Object.entries(map)
      .sort()
      .map(([month, value]) => ({ month, value }));
  }, [records]);

  // Handlers
  const handleSave = async (data: any) => {
    try {
      if (editing) {
        await updateMaintenance(editing.id, data);
        toast({ title: 'Manutenção atualizada' });
      } else {
        await createMaintenance(data);
        toast({ title: 'Manutenção criada' });
      }
      setShowModal(false);
      setEditing(null);
      loadMaintenanceRecords({ startDate, endDate });
    } catch (e: any) {
      toast({
        title: 'Erro ao salvar',
        description: e?.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ description: 'Excluir este registro de manutenção?', destructive: true }))) return;
    try {
      await deleteMaintenance(id);
      toast({ title: 'Registro excluído' });
      loadMaintenanceRecords({ startDate, endDate });
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' });
    }
  };

  const resetFilters = () => {
    setStartDate(ninetyAgo);
    setEndDate(today);
    setSelectedTruck('all');
    setSelectedStatus('all');
    setSelectedType('all');
  };

  const exportReport = () => {
    if (!records.length) {
      toast({
        title: 'Sem dados para exportar',
        description: 'Ajuste o período ou os filtros.',
      });
      return;
    }
    generateMaintenanceReportPdf(records, { startDate, endDate });
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      scheduled: { label: 'Agendada', className: 'bg-info/15 text-info border-info/30' },
      pending: { label: 'Agendada', className: 'bg-info/15 text-info border-info/30' },
      in_progress: {
        label: 'Em andamento',
        className: 'bg-warning/15 text-warning border-warning/30',
      },
      completed: {
        label: 'Concluída',
        className: 'bg-success/15 text-success border-success/30',
      },
    };
    const m = map[status] || { label: status, className: '' };
    return (
      <Badge variant="outline" className={m.className}>
        {m.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader
        title="Gestão de Manutenção"
        subtitle="Controle completo da manutenção da frota"
      >
        <Button variant="outline" onClick={exportReport}>
          <Download className="w-4 h-4 mr-2" />
          Relatório PDF
        </Button>
        <Button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova manutenção
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            label="Registros"
            value={String(kpis.count)}
            icon={Wrench}
            accent="text-primary"
          />
          <KpiCard
            label="Custo total"
            value={formatBRL(kpis.total)}
            icon={DollarSign}
            accent="text-success"
          />
          <KpiCard
            label="Custo médio"
            value={formatBRL(kpis.avg)}
            icon={TrendingUp}
            accent="text-indigo-600"
          />
          <KpiCard
            label="Concluídas"
            value={String(kpis.completed)}
            icon={CheckCircle2}
            accent="text-success"
          />
          <KpiCard
            label="Pendentes"
            value={String(kpis.pending)}
            icon={Clock}
            accent="text-warning"
          />
        </div>

        {/* Alertas */}
        {(alerts.overdue.length > 0 ||
          alerts.upcoming.length > 0 ||
          alerts.kmAlerts.length > 0) && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-5 h-5" />
                Alertas de manutenção
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AlertList
                title={`Vencidas (${alerts.overdue.length})`}
                tone="destructive"
                items={alerts.overdue.map((r) => ({
                  title: r.truck_name || r.truck_plate || '—',
                  subtitle: `${TYPE_LABEL[r.maintenance_type] || r.maintenance_type} · ${formatDateBR(r.scheduled_date)}`,
                }))}
              />
              <AlertList
                title={`Próximas 30 dias (${alerts.upcoming.length})`}
                tone="warning"
                items={alerts.upcoming.map((r) => ({
                  title: r.truck_name || r.truck_plate || '—',
                  subtitle: `${TYPE_LABEL[r.maintenance_type] || r.maintenance_type} · ${formatDateBR(r.scheduled_date)}`,
                }))}
              />
              <AlertList
                title={`Próximas por km (${alerts.kmAlerts.length})`}
                tone="info"
                items={alerts.kmAlerts.map((r) => ({
                  title: r.truck_name || r.truck_plate || '—',
                  subtitle: `Faltam ${(r.left || 0).toLocaleString('pt-BR')} km`,
                }))}
              />
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="lista">Lista de manutenções</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Custo por tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  {byType.length ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={byType}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={(e: any) => e.name}
                        >
                          {byType.map((_, i) => (
                            <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top caminhões (custo)</CardTitle>
                </CardHeader>
                <CardContent>
                  {byTruck.length ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={byTruck}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                        <Bar dataKey="value" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Evolução mensal de custos</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthly.length ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={monthly}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="Custo"
                          stroke="hsl(142 71% 45%)"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="lista" className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Filter className="w-4 h-4" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Início</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Caminhão</Label>
                    <SearchableSelect
                      value={selectedTruck}
                      onValueChange={setSelectedTruck}
                      placeholder="Caminhão"
                      searchPlaceholder="Buscar caminhão..."
                      options={[
                        { value: 'all', label: 'Todos' },
                        ...trucks.map((t: any) => ({ value: t.id, label: t.name, hint: t.plate })),
                      ]}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <SearchableSelect
                      value={selectedStatus}
                      onValueChange={setSelectedStatus}
                      placeholder="Status"
                      options={[
                        { value: 'all', label: 'Todos' },
                        { value: 'pending', label: 'Agendada' },
                        { value: 'in_progress', label: 'Em andamento' },
                        { value: 'completed', label: 'Concluída' },
                      ]}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <SearchableSelect
                      value={selectedType}
                      onValueChange={setSelectedType}
                      placeholder="Tipo"
                      options={[
                        { value: 'all', label: 'Todos' },
                        ...Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l as string })),
                      ]}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" className="w-full" onClick={resetFilters}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Limpar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabela */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="w-4 h-4" />
                  Manutenções ({records.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
                ) : records.length === 0 ? (
                  <div className="text-center py-10">
                    <Wrench className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma manutenção no período selecionado.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Caminhão</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Km</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium">{r.truck_name || '—'}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.truck_plate || '—'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal">
                              {TYPE_LABEL[r.maintenance_type] || r.maintenance_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[240px]">
                            <div className="truncate" title={r.description}>
                              {r.description}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.scheduled_date ? formatDateBR(r.scheduled_date) : '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.mileage != null
                              ? `${Number(r.mileage).toLocaleString('pt-BR')} km`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-sm max-w-[160px] truncate" title={r.supplier || ''}>
                            {r.supplier || '—'}
                          </TableCell>
                          <TableCell>{getStatusBadge(r.status)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatBRL(r.cost)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Gerar PDF"
                                aria-label="Gerar PDF da manutenção"
                                onClick={() => generateMaintenanceOrderPdf(r)}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Editar"
                                aria-label="Editar manutenção"
                                onClick={() => {
                                  setEditing(r);
                                  setShowModal(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                title="Excluir"
                                aria-label="Excluir manutenção"
                                onClick={() => handleDelete(r.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <MaintenanceModal
        open={showModal}
        onOpenChange={(o) => {
          setShowModal(o);
          if (!o) setEditing(null);
        }}
        editingRecord={editing}
        onSave={handleSave}
        trucks={trucks as any}
        loading={loading}
      />
    </div>
  );
};

const KpiCard: React.FC<{
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = ({ label, value, icon: Icon, accent }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg bg-muted/60 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const AlertList: React.FC<{
  title: string;
  tone: 'destructive' | 'warning' | 'info';
  items: { title: string; subtitle: string }[];
}> = ({ title, tone, items }) => {
  const dot =
    tone === 'destructive'
      ? 'bg-destructive'
      : tone === 'warning'
      ? 'bg-warning'
      : 'bg-info';
  return (
    <div>
      <p className="text-sm font-semibold mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum item.</p>
      ) : (
        <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {items.slice(0, 8).map((it, i) => (
            <li key={i} className="text-xs">
              <span className="font-medium">{it.title}</span>
              <span className="text-muted-foreground"> · {it.subtitle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const EmptyChart = () => (
  <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
    Sem dados no período.
  </div>
);

export default Maintenance;
