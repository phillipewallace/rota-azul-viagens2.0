import React, { useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, Car, MessageSquare, AlertCircle, CheckCircle2,
  Calendar, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { erpService, ErpVehicle, ErpVehicleComment } from '@/services/erp';

import { confirmDialog } from '@/lib/confirm';
import { formatDateBR } from '@/utils/dateFormat';
const VEHICLE_TYPES = [
  { value: 'caminhao',   label: 'Caminhão' },
  { value: 'carretinha', label: 'Carretinha' },
  { value: 'carro',      label: 'Carro' },
  { value: 'van',        label: 'Van' },
  { value: 'moto',       label: 'Moto' },
  { value: 'outro',      label: 'Outro' },
];

const COMMENT_CATEGORIES = [
  { value: 'multa',         label: 'Multa', color: 'bg-red-100 text-red-700' },
  { value: 'manutencao',    label: 'Manutenção', color: 'bg-amber-100 text-amber-700' },
  { value: 'abastecimento', label: 'Abastecimento', color: 'bg-blue-100 text-blue-700' },
  { value: 'observacao',    label: 'Observação', color: 'bg-gray-100 text-gray-700' },
  { value: 'documento',     label: 'Documento', color: 'bg-purple-100 text-purple-700' },
];

const VehiclesView: React.FC = () => {
  const [vehicles, setVehicles] = useState<ErpVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ErpVehicle | null>(null);
  const [openCard, setOpenCard] = useState<ErpVehicle | null>(null);

  const load = async () => {
    setLoading(true);
    try { setVehicles(await erpService.listVehicles()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ description: 'Excluir veículo? Isso apaga também todos os comentários.', destructive: true }))) return;
    try { await erpService.deleteVehicle(id); toast.success('Veículo excluído'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setEditing({
          id: '', name: '', vehicleType: 'caminhao', active: true,
        } as ErpVehicle)}>
          <Plus className="h-4 w-4 mr-2" /> Novo veículo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : vehicles.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Nenhum veículo cadastrado.
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Marca/Modelo</TableHead>
              <TableHead className="text-center">Comentários</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {vehicles.map(v => (
                <TableRow key={v.id} className="cursor-pointer"
                  onClick={() => setOpenCard(v)}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      {v.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {VEHICLE_TYPES.find(t => t.value === v.vehicleType)?.label || v.vehicleType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{v.plate || '-'}</TableCell>
                  <TableCell className="text-sm">
                    {[v.brand, v.model].filter(Boolean).join(' ') || '-'}
                    {v.year ? ` · ${v.year}` : ''}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <MessageSquare className="h-3 w-3" /> {v.commentsCount ?? 0}
                      </Badge>
                      {!!v.openCount && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" /> {v.openCount} aberto(s)
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600"
                      onClick={() => handleDelete(v.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {editing && (
        <VehicleModal
          vehicle={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {openCard && (
        <VehicleCardModal
          vehicle={openCard}
          onClose={() => { setOpenCard(null); load(); }}
        />
      )}
    </div>
  );
};

/* ---------- Modal: cadastro/edição ---------- */
const VehicleModal: React.FC<{
  vehicle: ErpVehicle; onClose: () => void; onSaved: () => void;
}> = ({ vehicle, onClose, onSaved }) => {
  const [form, setForm] = useState(vehicle);
  const [saving, setSaving] = useState(false);
  const isNew = !vehicle.id;
  const save = async () => {
    if (!form.name.trim()) return toast.error('Nome obrigatório');
    setSaving(true);
    try {
      if (isNew) await erpService.createVehicle(form);
      else await erpService.updateVehicle(vehicle.id, form);
      toast.success('Veículo salvo'); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{isNew ? 'Novo' : 'Editar'} veículo</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><Label>Nome / Apelido *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Tipo</Label>
            <SearchableSelect
              value={form.vehicleType}
              onValueChange={v => setForm({ ...form, vehicleType: v })}
              placeholder="Tipo"
              options={VEHICLE_TYPES}
            />
          </div>
          <div><Label>Placa</Label>
            <Input value={form.plate || ''} onChange={e => setForm({ ...form, plate: e.target.value.toUpperCase() })} />
          </div>
          <div><Label>Marca</Label>
            <Input value={form.brand || ''} onChange={e => setForm({ ...form, brand: e.target.value })} />
          </div>
          <div><Label>Modelo</Label>
            <Input value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value })} />
          </div>
          <div><Label>Ano</Label>
            <Input type="number" value={form.year || ''}
              onChange={e => setForm({ ...form, year: parseInt(e.target.value) || undefined })} />
          </div>
          <div><Label>Cor</Label>
            <Input value={form.color || ''} onChange={e => setForm({ ...form, color: e.target.value })} />
          </div>
          <div><Label>Combustível</Label>
            <Input value={form.fuel || ''}
              placeholder="Diesel, Gasolina, Etanol, Flex..."
              onChange={e => setForm({ ...form, fuel: e.target.value })} />
          </div>
          <div><Label>RENAVAM</Label>
            <Input value={form.renavam || ''} onChange={e => setForm({ ...form, renavam: e.target.value })} />
          </div>
          <div><Label>Chassi</Label>
            <Input value={form.chassis || ''} onChange={e => setForm({ ...form, chassis: e.target.value })} />
          </div>
          <div><Label>Aquisição</Label>
            <Input type="date" value={form.acquisitionDate ? form.acquisitionDate.substring(0,10) : ''}
              onChange={e => setForm({ ...form, acquisitionDate: e.target.value })} />
          </div>
          <div className="md:col-span-2"><Label>Observações gerais</Label>
            <Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ---------- Card do veículo: timeline de comentários ---------- */
const VehicleCardModal: React.FC<{ vehicle: ErpVehicle; onClose: () => void }> =
({ vehicle, onClose }) => {
  const [comments, setComments] = useState<ErpVehicleComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<ErpVehicleComment>>({
    comment: '', category: 'observacao', status: 'open',
    referenceDate: new Date().toISOString().substring(0,10),
  });

  const load = async () => {
    setLoading(true);
    try { setComments(await erpService.listVehicleComments(vehicle.id)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [vehicle.id]);

  const addComment = async () => {
    if (!draft.comment?.trim()) return toast.error('Escreva um comentário');
    setAdding(true);
    try {
      await erpService.createVehicleComment(vehicle.id, draft);
      setDraft({
        comment: '', category: 'observacao', status: 'open',
        referenceDate: new Date().toISOString().substring(0,10),
      });
      toast.success('Comentário registrado');
      load();
    } catch (e: any) { toast.error(e.message); } finally { setAdding(false); }
  };

  const toggleStatus = async (c: ErpVehicleComment) => {
    try {
      await erpService.updateVehicleComment(vehicle.id, c.id, {
        status: c.status === 'open' ? 'closed' : 'open',
      });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const removeComment = async (c: ErpVehicleComment) => {
    if (!(await confirmDialog({ description: 'Excluir esse registro?', destructive: true }))) return;
    try { await erpService.deleteVehicleComment(vehicle.id, c.id); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-blue-600" />
            {vehicle.name}
            {vehicle.plate && <Badge variant="outline" className="font-mono">{vehicle.plate}</Badge>}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {[VEHICLE_TYPES.find(t => t.value === vehicle.vehicleType)?.label,
              vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' · ')}
          </p>
        </DialogHeader>

        {/* Form de novo comentário */}
        <Card><CardContent className="pt-4 space-y-3">
          <Label className="text-base font-semibold">Novo registro</Label>
          <Textarea
            placeholder="Ex.: Multa de R$ 195 emitida no dia 02/05, em aberto..."
            value={draft.comment || ''}
            onChange={e => setDraft({ ...draft, comment: e.target.value })}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Categoria</Label>
              <SearchableSelect
                value={draft.category || 'observacao'}
                onValueChange={v => setDraft({ ...draft, category: v })}
                placeholder="Categoria"
                options={COMMENT_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
              />
            </div>
            <div>
              <Label className="text-xs">Data do evento</Label>
              <Input type="date" value={draft.referenceDate || ''}
                onChange={e => setDraft({ ...draft, referenceDate: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" placeholder="opcional"
                value={draft.amount ?? ''}
                onChange={e => setDraft({ ...draft, amount: e.target.value ? parseFloat(e.target.value) : undefined })} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={addComment} disabled={adding}>
              {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
          </div>
        </CardContent></Card>

        {/* Timeline */}
        <div className="space-y-3 mt-4">
          <Label className="text-base font-semibold">Histórico</Label>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum registro ainda. Adicione o primeiro acima.
            </p>
          ) : comments.map(c => {
            const cat = COMMENT_CATEGORIES.find(x => x.value === c.category);
            return (
              <Card key={c.id} className={c.status === 'open' ? 'border-l-4 border-l-amber-500' : ''}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {cat && (
                          <span className={`px-2 py-0.5 text-xs rounded font-medium ${cat.color}`}>
                            <Tag className="inline h-3 w-3 mr-1" />{cat.label}
                          </span>
                        )}
                        {c.referenceDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateBR(c.referenceDate)}
                          </span>
                        )}
                        {c.amount != null && (
                          <Badge variant="secondary">
                            R$ {Number(c.amount).toFixed(2).replace('.', ',')}
                          </Badge>
                        )}
                        <Badge variant={c.status === 'open' ? 'destructive' : 'outline'}>
                          {c.status === 'open' ? 'Em aberto' : 'Resolvido'}
                        </Badge>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
                      <p className="text-xs text-muted-foreground">
                        Registrado por {c.author || 'sistema'} em{' '}
                        {new Date(c.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(c)}
                        title={c.status === 'open' ? 'Marcar como resolvido' : 'Reabrir'}>
                        <CheckCircle2 className={`h-4 w-4 ${c.status === 'open' ? 'text-muted-foreground' : 'text-green-600'}`} />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600"
                        onClick={() => removeComment(c)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VehiclesView;
