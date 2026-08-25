import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Download, MapPin, Camera, Clock, User, Truck, CheckCircle2,
  Search, RefreshCw, Calendar, Filter, Route as RouteIcon,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { API_CONFIG } from '@/services/config';

interface CompletedRoute {
  id: string;
  route_id: string;
  route_name: string;
  truck_plate?: string;
  driver_name?: string;
  started_at?: string;
  finished_at?: string;
  total_distance?: number;
  total_duration?: number;
  points_snapshot: any[];
  photos_count: number;
  status: string;
}

interface Photo {
  id: string;
  point_id: string;
  file_url: string;
  operation_type?: string;
  uploaded_at: string;
}

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleString('pt-BR') : '—');
const norm = (s?: string) =>
  (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const CompletedRoutes: React.FC = () => {
  const [routes, setRoutes] = useState<CompletedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<(CompletedRoute & { photos: Photo[] }) | null>(null);

  // filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'finished' | 'in_progress'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const r = await fetch(`${API_CONFIG.BASE_URL}/completed-routes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await r.json();
      setRoutes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erro ao carregar rotas concluídas:', e);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetails = async (id: string) => {
    const token = localStorage.getItem('auth_token');
    const r = await fetch(`${API_CONFIG.BASE_URL}/completed-routes/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setSelected(await r.json());
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const q = norm(search);
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 3600 * 1000 : null;

    return routes.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q) {
        const hay = norm([r.route_name, r.truck_plate, r.driver_name].filter(Boolean).join(' '));
        if (!hay.includes(q)) return false;
      }
      const ts = r.started_at ? new Date(r.started_at).getTime() : 0;
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      return true;
    });
  }, [routes, search, statusFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const finished = filtered.filter(r => r.status === 'finished').length;
    const photos = filtered.reduce((acc, r) => acc + (r.photos_count || 0), 0);
    const km = filtered.reduce((acc, r) => acc + (Number(r.total_distance) || 0), 0);
    return { total, finished, photos, km };
  }, [filtered]);

  const clearFilters = () => {
    setSearch(''); setStatusFilter('all'); setDateFrom(''); setDateTo('');
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Rotas Concluídas"
        subtitle="Histórico de execuções com fotos e linha do tempo"
      >
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Rotas', value: stats.total, icon: RouteIcon, color: 'text-primary' },
            { label: 'Finalizadas', value: stats.finished, icon: CheckCircle2, color: 'text-green-600' },
            { label: 'Fotos', value: stats.photos, icon: Camera, color: 'text-blue-600' },
            { label: 'Quilômetros', value: stats.km.toFixed(1), icon: MapPin, color: 'text-orange-600' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filtros</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="relative md:col-span-5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por rota, placa ou motorista..."
                  className="pl-9"
                />
              </div>
              <div className="md:col-span-3">
                <SearchableSelect
                  value={statusFilter}
                  onValueChange={(v: any) => setStatusFilter(v)}
                  placeholder="Status"
                  options={[
                    { value: 'all', label: 'Todos os status' },
                    { value: 'finished', label: 'Finalizadas' },
                    { value: 'in_progress', label: 'Em andamento' },
                  ]}
                />
              </div>
              <div className="md:col-span-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="pl-9" />
                </div>
              </div>
            </div>
            {(search || statusFilter !== 'all' || dateFrom || dateTo) && (
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4 h-44 animate-pulse bg-muted/30" /></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <RouteIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhuma rota encontrada</p>
              <p className="text-sm">Ajuste os filtros ou aguarde execuções de motoristas.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => {
              const completedPts = (r.points_snapshot || []).filter((p: any) => p.completed).length;
              const totalPts = (r.points_snapshot || []).length;
              const progress = totalPts ? (completedPts / totalPts) * 100 : 0;
              const isFinished = r.status === 'finished';
              return (
                <Card
                  key={r.id}
                  className="cursor-pointer hover:shadow-md hover:border-primary/40 transition group"
                  onClick={() => openDetails(r.id)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight line-clamp-2 group-hover:text-primary">
                        {r.route_name}
                      </h3>
                      <Badge
                        variant={isFinished ? 'default' : 'secondary'}
                        className={isFinished ? 'bg-green-600 hover:bg-green-600' : ''}
                      >
                        {isFinished ? 'Finalizada' : 'Em andamento'}
                      </Badge>
                    </div>

                    <div className="text-sm space-y-1.5 text-muted-foreground">
                      <div className="flex items-center gap-2 truncate"><Truck className="h-4 w-4 shrink-0" />{r.truck_plate || '—'}</div>
                      <div className="flex items-center gap-2 truncate"><User className="h-4 w-4 shrink-0" />{r.driver_name || '—'}</div>
                      <div className="flex items-center gap-2 truncate"><Clock className="h-4 w-4 shrink-0" />{fmtDate(r.started_at)}</div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{completedPts}/{totalPts} pontos</span>
                        <span className="text-muted-foreground">{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${isFinished ? 'bg-green-600' : 'bg-primary'} transition-all`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Camera className="h-3 w-3" />{r.photos_count} fotos</span>
                      {r.total_distance ? <span>{Number(r.total_distance).toFixed(1)} km</span> : <span>—</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal detalhes */}
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl">{selected.route_name}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-4 p-3 bg-muted/40 rounded-lg">
                  <div><span className="text-muted-foreground">Motorista:</span> <strong>{selected.driver_name || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Caminhão:</span> <strong>{selected.truck_plate || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Distância:</span> <strong>{selected.total_distance ? Number(selected.total_distance).toFixed(1) + ' km' : '—'}</strong></div>
                  <div><span className="text-muted-foreground">Início:</span> <strong>{fmtDate(selected.started_at)}</strong></div>
                  <div><span className="text-muted-foreground">Fim:</span> <strong>{fmtDate(selected.finished_at)}</strong></div>
                  <div><span className="text-muted-foreground">Fotos:</span> <strong>{selected.photos_count}</strong></div>
                </div>
                <Button asChild className="mb-4">
                  <a
                    href={`${API_CONFIG.BASE_URL}/completed-routes/${selected.id}/photos.zip?token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`}
                    target="_blank" rel="noreferrer"
                  >
                    <Download className="h-4 w-4 mr-2" />Baixar todas as fotos (ZIP)
                  </a>
                </Button>
                <h3 className="font-semibold mb-2">Linha do tempo dos pontos</h3>
                <div className="space-y-3">
                  {(selected.points_snapshot || []).map((p: any, i: number) => {
                    const photos = (selected.photos || []).filter(ph => ph.point_id === p.id);
                    return (
                      <Card key={p.id || i}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{i + 1}. {p.customer_name || p.address}</div>
                              <div className="text-xs text-muted-foreground truncate">{p.address}</div>
                              <div className="text-xs flex flex-wrap gap-2 mt-1">
                                {p.point_category && <Badge variant="outline">{p.point_category}</Badge>}
                                {p.operation_type && <Badge variant="outline">{p.operation_type}</Badge>}
                                {p.completed && (
                                  <Badge className="bg-green-600 hover:bg-green-600">
                                    Concluído {p.completed_at ? new Date(p.completed_at).toLocaleString('pt-BR') : ''}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {photos.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                              {photos.map(ph => (
                                <a key={ph.id} href={`${API_CONFIG.BASE_URL.replace('/api', '')}${ph.file_url}`} target="_blank" rel="noreferrer">
                                  <img
                                    src={`${API_CONFIG.BASE_URL.replace('/api', '')}${ph.file_url}`}
                                    alt=""
                                    className="w-full h-24 object-cover rounded border hover:opacity-90 transition"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CompletedRoutes;
