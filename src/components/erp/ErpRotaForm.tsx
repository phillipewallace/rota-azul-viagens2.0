/**
 * Modal de formulário para criação/edição de rotas no ERP.
 * Contém todos os campos da rota: nome, empresa, endereço, limpezas, banheiros,
 * contato, observação, número do sanitário, modelo e cor.
 */
import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Rota, validateRota } from '@/types/rota';
import { toast } from 'sonner';

interface ErpRotaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rota: Rota | null;
  onSave: (data: Omit<Rota, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  isLoading: boolean;
}

const ErpRotaForm: React.FC<ErpRotaFormProps> = (
  { open, onOpenChange, rota, onSave, isLoading }
) => {
  const [name, setName] = useState(rota?.name || '');
  const [company, setCompany] = useState(rota?.company || '');
  const [address, setAddress] = useState(rota?.address || '');
  const [cleaning, setCleaning] = useState(rota?.cleaning || '');
  const [bathrooms, setBathrooms] = useState(rota?.bathrooms || '');
  const [contact, setContact] = useState(rota?.contact || '');
  const [observation, setObservation] = useState(rota?.observation || '');
  const [sanitarioNumber, setSanitarioNumber] = useState(rota?.sanitarioNumber || '');
  const [model, setModel] = useState(rota?.model || '');
  const [color, setColor] = useState(rota?.color || '');
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateRota({ name, company, address });
    if (!validation.valid) {
      setErrors(validation.errors);
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    try {
      await onSave({
        name, company, address, cleaning, bathrooms, contact,
        observation, sanitarioNumber, model, color
      });
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rota ? 'Editar Rota' : 'Nova Rota'}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da rota para {rota ? 'edição' : 'cadastro'}. Os campos obrigatórios são indicados com *.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name" className="text-sm font-semibold text-slate-700">Nome da Rota *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Rota de Limpeza - Centro"
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="company" className="text-sm font-semibold text-slate-700">Empresa *</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Ex: Centro de Limpeza do Sul"
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="address" className="text-sm font-semibold text-slate-700">Endereço *</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade"
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cleaning" className="text-sm font-semibold text-slate-700">Limpezas</Label>
            <Textarea
              id="cleaning"
              value={cleaning}
              onChange={(e) => setCleaning(e.target.value)}
              placeholder="Ex: Limpeza geral, pás, pia, pátio..."
              rows={2}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bathrooms" className="text-sm font-semibold text-slate-700">Banheiros</Label>
            <Input
              id="bathrooms"
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              placeholder="Ex: 2 banheiros, 1 sanitário..."
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="contact" className="text-sm font-semibold text-slate-700">Contato</Label>
            <Input
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Nome e telefone do responsável"
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="observation" className="text-sm font-semibold text-slate-700">Observação</Label>
            <Textarea
              id="observation"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Informações adicionais importantes..."
              rows={3}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="sanitarioNumber" className="text-sm font-semibold text-slate-700">Número do Sanitário</Label>
            <Input
              id="sanitarioNumber"
              value={sanitarioNumber}
              onChange={(e) => setSanitarioNumber(e.target.value)}
              placeholder="Ex: 32, A-10, Principal..."
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="model" className="text-sm font-semibold text-slate-700">Modelo</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ex: Van, Caminhão, Carro..."
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="color" className="text-sm font-semibold text-slate-700">Cor</Label>
            <Input
              id="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Ex: Branco, Prata, Preto..."
              className={inputClass}
            />
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