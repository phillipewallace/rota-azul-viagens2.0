/**
 * Modal de formulário para criação/edição de rotas no ERP.
 * Uma rota é um "card" (ex.: "Centro Barreiro") que agrupa vários pontos;
 * aqui só se define nome e status. Os pontos são adicionados dentro do card.
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Rota, RotaStatus, validateRota } from '@/types/rota';
import { toast } from 'sonner';

export interface RotaFormData {
  name: string;
  status: RotaStatus;
}

interface ErpRotaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rota: Rota | null;
  onSave: (data: RotaFormData) => Promise<void>;
  isLoading: boolean;
}

const statusLabel: Record<RotaStatus, string> = {
  ativa: 'Ativa',
  inativa: 'Inativa',
  concluida: 'Concluída',
};

const ErpRotaForm: React.FC<ErpRotaFormProps> = (
  { open, onOpenChange, rota, onSave, isLoading }
) => {
  const [name, setName] = useState(rota?.name || '');
  const [status, setStatus] = useState<RotaStatus>(rota?.status || 'ativa');
  const [errors, setErrors] = useState<string[]>([]);

  // Reiniciar o estado ao abrir (novo ou edição)
  useEffect(() => {
    if (open) {
      setName(rota?.name || '');
      setStatus(rota?.status || 'ativa');
      setErrors([]);
    }
  }, [open, rota]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateRota({ name });
    if (!validation.valid) {
      setErrors(validation.errors);
      toast.error('Preencha o nome da rota');
      return;
    }
    try {
      await onSave({ name: name.trim(), status });
      toast.success(rota ? 'Rota atualizada com sucesso!' : 'Rota criada com sucesso!');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Erro ao salvar rota:', err);
      toast.error(err.message || 'Erro ao salvar rota');
    }
  };

  const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rota ? 'Editar Rota' : 'Nova Rota'}
          </DialogTitle>
          <DialogDescription>
            {rota
              ? 'Altere o nome e o status da rota.'
              : 'Crie a rota (ex.: "Centro Barreiro") e depois adicione os pontos dentro do card.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name" className="text-sm font-semibold text-slate-700">Nome da Rota *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Centro Barreiro"
              className={inputClass}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="status" className="text-sm font-semibold text-slate-700">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as RotaStatus)}>
              <SelectTrigger id="status" className={inputClass}>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(statusLabel) as RotaStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {errors.length > 0 && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium">
                Corrija os seguintes erros:
              </p>
              <ul className="mt-1 list-disc list-inside text-sm text-destructive">
                {errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-primary to-primary-700 hover:from-primary/90 hover:to-primary-600"
            >
              {isLoading ? 'Salvando...' : (rota ? 'Atualizar Rota' : 'Criar Rota')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ErpRotaForm;