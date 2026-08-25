import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import {
  MaintenanceRecord,
  FileAttachment,
  MaintenanceItem,
} from '@/hooks/useMaintenanceManagement';
import { FileUpload } from './FileUpload';

interface MaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecord?: MaintenanceRecord | null;
  onSave: (record: any) => void;
  trucks: Array<{ id: string; name: string; plate: string }>;
  loading: boolean;
}

const emptyForm = {
  truck_id: '',
  maintenance_type: '',
  description: '',
  scheduled_date: '',
  cost: '',
  mileage: '',
  next_maintenance_km: '',
  supplier: '',
  invoice_number: '',
  status: 'scheduled',
};

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  open,
  onOpenChange,
  editingRecord,
  onSave,
  trucks,
  loading,
}) => {
  const [formData, setFormData] = useState(emptyForm);
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);

  const maintenanceTypes = [
    { value: 'preventiva', label: 'Preventiva' },
    { value: 'corretiva', label: 'Corretiva' },
    { value: 'preditiva', label: 'Preditiva' },
    { value: 'revisao', label: 'Revisão' },
    { value: 'inspecao', label: 'Inspeção' },
  ];

  const statusOptions = [
    { value: 'scheduled', label: 'Agendada' },
    { value: 'in_progress', label: 'Em andamento' },
    { value: 'completed', label: 'Concluída' },
  ];

  useEffect(() => {
    if (editingRecord) {
      setFormData({
        truck_id: editingRecord.truck_id,
        maintenance_type: editingRecord.maintenance_type,
        description: editingRecord.description,
        scheduled_date: editingRecord.scheduled_date
          ? editingRecord.scheduled_date.split('T')[0]
          : '',
        cost: editingRecord.cost ? String(editingRecord.cost) : '',
        mileage: editingRecord.mileage != null ? String(editingRecord.mileage) : '',
        next_maintenance_km:
          editingRecord.next_maintenance_km != null
            ? String(editingRecord.next_maintenance_km)
            : '',
        supplier: editingRecord.supplier || '',
        invoice_number: editingRecord.invoice_number || '',
        status: editingRecord.status || 'scheduled',
      });
      setItems(editingRecord.items || []);
      setAttachedFiles(editingRecord.files || []);
    } else {
      setFormData(emptyForm);
      setItems([]);
      setAttachedFiles([]);
    }
  }, [editingRecord, open]);

  const itemsTotal = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0,
  );

  const addItem = () =>
    setItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0 }]);

  const updateItem = (i: number, patch: Partial<MaintenanceItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const costNum = parseFloat(formData.cost);
    onSave({
      ...formData,
      cost: !isNaN(costNum) && costNum > 0 ? costNum : itemsTotal,
      mileage: formData.mileage === '' ? null : parseInt(formData.mileage),
      next_maintenance_km:
        formData.next_maintenance_km === ''
          ? null
          : parseInt(formData.next_maintenance_km),
      supplier: formData.supplier || null,
      invoice_number: formData.invoice_number || null,
      items: items.filter((it) => it.description?.trim()),
      files: attachedFiles,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData(emptyForm);
    setItems([]);
    setAttachedFiles([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRecord ? 'Editar manutenção' : 'Nova manutenção'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Caminhão + tipo + status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-1">
              <Label>Caminhão *</Label>
              <SearchableSelect
                value={formData.truck_id}
                onValueChange={(v) => setFormData((p) => ({ ...p, truck_id: v }))}
                placeholder="Selecione"
                searchPlaceholder="Buscar caminhão..."
                options={trucks.map((t) => ({ value: t.id, label: t.name, hint: t.plate }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo *</Label>
              <SearchableSelect
                value={formData.maintenance_type}
                onValueChange={(v) => setFormData((p) => ({ ...p, maintenance_type: v }))}
                placeholder="Selecione"
                options={maintenanceTypes}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <SearchableSelect
                value={formData.status}
                onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}
                placeholder="Selecione"
                options={statusOptions}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Descreva o serviço executado..."
              required
              rows={3}
            />
          </div>

          {/* Datas + km */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data agendada *</Label>
              <Input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, scheduled_date: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Km no momento</Label>
              <Input
                type="number"
                min="0"
                value={formData.mileage}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, mileage: e.target.value }))
                }
                placeholder="Ex.: 125000"
              />
            </div>
            <div className="space-y-2">
              <Label>Próxima revisão (km)</Label>
              <Input
                type="number"
                min="0"
                value={formData.next_maintenance_km}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    next_maintenance_km: e.target.value,
                  }))
                }
                placeholder="Ex.: 135000"
              />
            </div>
          </div>

          {/* Fornecedor + NF */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fornecedor / Oficina</Label>
              <Input
                value={formData.supplier}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, supplier: e.target.value }))
                }
                placeholder="Ex.: Oficina Central"
              />
            </div>
            <div className="space-y-2">
              <Label>Nº da nota fiscal</Label>
              <Input
                value={formData.invoice_number}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    invoice_number: e.target.value,
                  }))
                }
                placeholder="NF-1234"
              />
            </div>
          </div>

          {/* Itens */}
          <Card className="border-dashed">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Peças e serviços</Label>
                  <p className="text-xs text-muted-foreground">
                    Detalhe os itens — o total é calculado automaticamente.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  Nenhum item adicionado.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <Input
                        className="col-span-6"
                        placeholder="Descrição da peça/serviço"
                        value={it.description}
                        onChange={(e) =>
                          updateItem(i, { description: e.target.value })
                        }
                      />
                      <Input
                        className="col-span-2"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Qtd"
                        value={it.quantity}
                        onChange={(e) =>
                          updateItem(i, {
                            quantity: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <Input
                        className="col-span-3"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Vlr unit."
                        value={it.unit_price}
                        onChange={(e) =>
                          updateItem(i, {
                            unit_price: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="col-span-1 text-destructive"
                        aria-label="Remover item"
                        onClick={() => removeItem(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-end pt-2 text-sm">
                    <span className="text-muted-foreground mr-2">
                      Subtotal de itens:
                    </span>
                    <span className="font-semibold">
                      R${' '}
                      {itemsTotal.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custo final */}
          <div className="space-y-2 max-w-xs">
            <Label>Custo total (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.cost}
              onChange={(e) =>
                setFormData((p) => ({ ...p, cost: e.target.value }))
              }
              placeholder={
                itemsTotal > 0
                  ? itemsTotal.toFixed(2)
                  : '0.00'
              }
            />
            <p className="text-xs text-muted-foreground">
              Se vazio, usa o total dos itens automaticamente.
            </p>
          </div>

          {/* Anexos */}
          <div className="space-y-2">
            <Label>Documentos anexos</Label>
            <FileUpload
              files={attachedFiles}
              onFilesChange={setAttachedFiles}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
