import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, History, LogIn, LogOut, Loader2 } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { carretinhasService, Carretinha, CarretinhaLocacao } from '@/services/carretinhas';
import PageHeader from '@/components/PageHeader';

import { confirmDialog } from '@/lib/confirm';
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  galpao:      { label: 'No Galpão',  cls: 'bg-success/15 text-success border-success/30' },
  locada:      { label: 'Locada',     cls: 'bg-info/15 text-info border-info/30' },
  manutencao:  { label: 'Manutenção', cls: 'bg-warning/15 text-warning border-warning/30' },
};

const today = () => new Date().toISOString().slice(0, 10);

export default function Carretinhas() {
  const [list, setList] = useState<Carretinha[]>([]);
  const [loading, setLoading] = useState(false);

  // form
  const [editing, setEditing] = useState<Carretinha | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [notes, setNotes] = useState('');

  // locação
  const [locTarget, setLocTarget] = useState<Carretinha | null>(null);
  const [locCustomer, setLocCustomer] = useState('');
  const [locStart, setLocStart] = useState(today());
  const [locNotes, setLocNotes] = useState('');

  // baixa
  const [baixaTarget, setBaixaTarget] = useState<Carretinha | null>(null);
  const [baixaDate, setBaixaDate] = useState(today());
  const [baixaNotes, setBaixaNotes] = useState('');

  // histórico
  const [histTarget, setHistTarget] = useState<Carretinha | null>(null);
  const [historico, setHistorico] = useState<CarretinhaLocacao[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setList(await carretinhasService.list()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  usePolling(load, 15000);

  const openNew = () => {
    setEditing(null);
    setName(''); setPlate(''); setModel(''); setYear(''); setNotes('');
    setShowForm(true);
  };
  const openEdit = (c: Carretinha) => {
    setEditing(c);
    setName(c.name); setPlate(c.plate);
    setModel(c.model || ''); setYear(c.year ? String(c.year) : '');
    setNotes(c.notes || '');
    setShowForm(true);
  };
  const saveForm = async () => {
    if (!name.trim() || !plate.trim()) return toast.error('Nome e placa obrigatórios');
    try {
      const data = { name: name.trim(), plate: plate.trim().toUpperCase(),
        model: model || null, year: year ? Number(year) : null, notes: notes || null } as any;
      if (editing) await carretinhasService.update(editing.id, data);
      else await carretinhasService.create(data);
      toast.success('Salvo');
      setShowForm(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };
  const remove = async (c: Carretinha) => {
    if (!(await confirmDialog({ description: `Excluir carretinha ${c.name}? O histórico de locações também será removido.`, destructive: true }))) return;
    try { await carretinhasService.remove(c.id); toast.success('Excluída'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const openLocar = (c: Carretinha) => {
    setLocTarget(c); setLocCustomer(''); setLocStart(today()); setLocNotes('');
  };
  const confirmLocar = async () => {
    if (!locTarget) return;
    if (!locCustomer.trim()) return toast.error('Informe o cliente');
    try {
      await carretinhasService.locar(locTarget.id, {
        customerName: locCustomer.trim(), startDate: locStart, notes: locNotes || undefined,
      });
      toast.success('Locação registrada');
      setLocTarget(null); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const openBaixa = (c: Carretinha) => {
    setBaixaTarget(c); setBaixaDate(today()); setBaixaNotes('');
  };
  const confirmBaixa = async () => {
    if (!baixaTarget) return;
    try {
      await carretinhasService.baixa(baixaTarget.id, { endDate: baixaDate, notes: baixaNotes || undefined });
      toast.success('Baixa registrada — carretinha voltou ao galpão');
      setBaixaTarget(null); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const openHist = async (c: Carretinha) => {
    setHistTarget(c); setHistorico([]); setHistLoading(true);
    try { setHistorico(await carretinhasService.historico(c.id)); }
    catch (e: any) { toast.error(e.message); }
    finally { setHistLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Carretinhas" subtitle="Frota de carretinhas, locações e histórico">
        <Button onClick={openNew} className="transition-all duration-200">
          <Plus className="h-4 w-4 mr-2" />Nova Carretinha
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : list.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">Nenhuma carretinha cadastrada</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Ano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cliente Atual</TableHead>
                    <TableHead>Início Locação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map(c => {
                    const b = STATUS_BADGE[c.status] || STATUS_BADGE.galpao;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="font-mono">{c.plate}</TableCell>
                        <TableCell>{c.model || '-'}</TableCell>
                        <TableCell>{c.year || '-'}</TableCell>
                        <TableCell><Badge variant="outline" className={b.cls}>{b.label}</Badge></TableCell>
                        <TableCell>{c.currentCustomerName || '-'}</TableCell>
                        <TableCell>{c.currentRentalStart ? new Date(c.currentRentalStart).toLocaleDateString('pt-BR') : '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            {c.status === 'galpao' && (
                              <Button size="sm" variant="outline" onClick={() => openLocar(c)} title="Dar entrada/locar">
                                <LogIn className="h-4 w-4" />
                              </Button>
                            )}
                            {c.status === 'locada' && (
                              <Button size="sm" variant="outline" onClick={() => openBaixa(c)} title="Dar baixa (retorno)" className="text-warning">
                                <LogOut className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => openHist(c)} title="Histórico">
                              <History className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openEdit(c)} title="Editar">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => remove(c)} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form criar/editar */}
      <Dialog open={showForm} onOpenChange={o => !o && setShowForm(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Carretinha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome / Apelido</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Placa</Label><Input value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} className="uppercase" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Modelo</Label><Input value={model} onChange={e => setModel(e.target.value)} /></div>
              <div><Label>Ano</Label><Input type="number" value={year} onChange={e => setYear(e.target.value)} /></div>
            </div>
            <div><Label>Observações</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={saveForm}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Locar */}
      <Dialog open={!!locTarget} onOpenChange={o => !o && setLocTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Locar carretinha {locTarget?.plate}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Cliente</Label><Input value={locCustomer} onChange={e => setLocCustomer(e.target.value)} /></div>
            <div><Label>Início da locação</Label><Input type="date" value={locStart} onChange={e => setLocStart(e.target.value)} /></div>
            <div><Label>Observações</Label><Textarea rows={2} value={locNotes} onChange={e => setLocNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocTarget(null)}>Cancelar</Button>
            <Button onClick={confirmLocar}>Confirmar locação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Baixa */}
      <Dialog open={!!baixaTarget} onOpenChange={o => !o && setBaixaTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dar baixa — {baixaTarget?.plate}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Cliente atual: <b>{baixaTarget?.currentCustomerName || '-'}</b>
            </div>
            <div><Label>Data de retorno</Label><Input type="date" value={baixaDate} onChange={e => setBaixaDate(e.target.value)} /></div>
            <div><Label>Observações</Label><Textarea rows={2} value={baixaNotes} onChange={e => setBaixaNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixaTarget(null)}>Cancelar</Button>
            <Button onClick={confirmBaixa}>Confirmar retorno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={!!histTarget} onOpenChange={o => !o && setHistTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Histórico — {histTarget?.name} ({histTarget?.plate})</DialogTitle></DialogHeader>
          {histLoading ? (
            <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : historico.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma locação registrada</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.customerName}</TableCell>
                    <TableCell>{new Date(h.startDate).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{h.endDate ? new Date(h.endDate).toLocaleDateString('pt-BR') : <Badge variant="outline" className="bg-info/15 text-info border-info/30">Em curso</Badge>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{h.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
