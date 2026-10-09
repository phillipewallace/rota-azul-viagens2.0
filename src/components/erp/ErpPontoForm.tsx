/**
 * Modal de formulário para criação/edição de um Ponto dentro de uma Rota.
 * Cada ponto é uma parada/entrega (empresa, endereço, limpezas, banheiros, etc.).
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Ponto, validatePonto } from '@/types/rota';
import { toast } from 'sonner';

export type PontoFormData = Omit<Ponto, 'id'>;

interface ErpPontoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ponto: Ponto | null;
  /** Nome da rota pai, exibido no cabeçalho do modal */
  rotaName: string;
  onSave: (data: PontoFormData) => Promise<void>;
  isLoading: boolean;
}

const ErpPontoForm: React.FC<ErpPontoFormProps> = (
  { open, onOpenChange, ponto, rotaName, onSave, isLoading }
) => {
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [cleaning, setCleaning] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [toilets, setToilets] = useState('');
  const [pieces, setPieces] = useState('');
  const [contact, setContact] = useState('');
  const [observation, setObservation] = useState('');
  const [sanitarioNumber, setSanitarioNumber] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  // Reiniciar o estado ao abrir (novo ou edição)
  useEffect(() => {
    if (open) {
      setCompany(ponto?.company || '');
      setAddress(ponto?.address || '');
      setCleaning(ponto?.cleaning || '');
      setBathrooms(ponto?.bathrooms || '');
      setToilets((ponto as any)?.toilets || '');
      setPieces((ponto as any)?.pieces || '');
      setContact(ponto?.contact || '');
      setObservation(ponto?.observation || '');
      setSanitarioNumber(ponto?.sanitarioNumber || '');
      setModel(ponto?.model || '');
      setColor(ponto?.color || '');
      setErrors([]);
    }
  }, [open, ponto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: PontoFormData = {
      company, address, cleaning, bathrooms, contact,
      observation, sanitarioNumber, model, color,
      toilets, pieces,
    } as PontoFormData;
    const validation = validatePonto(data);
    if (!validation.valid) {
      setErrors(validation.errors);
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    try {
      await onSave(data);
      toast.success(ponto ? 'Ponto atualizado com sucesso!' : 'Ponto adicionado com sucesso!');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Erro ao salvar ponto:', err);
      toast.error(err.message || 'Erro ao salvar ponto');
    }
  };

  const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ponto ? 'Editar Ponto' : 'Novo Ponto'}
          </DialogTitle>
          <DialogDescription>
            Ponto da rota <span className="font-semibold text-slate-700">“{rotaName}”</span>.
            Os campos obrigatórios são indicados com *.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ponto-company" className="text-sm font-semibold text-slate-700">Empresa *</Label>
            <Input
              id="ponto-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Ex: Padaria Estrela"
              className={inputClass}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ponto-address" className="text-sm font-semibold text-slate-700">Endereço *</Label>
            <Input
              id="ponto-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex: Rua das Flores, 123 - Centro"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="ponto-cleaning" className="text-sm font-semibold text-slate-700">Limpezas</Label>
              <Input
                id="ponto-cleaning"
                value={cleaning}
                onChange={(e) => setCleaning(e.target.value)}
                placeholder="Ex: 2x por semana"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ponto-bathrooms" className="text-sm font-semibold text-slate-700">Banheiros</Label>
              <Input
                id="ponto-bathrooms"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                placeholder="Qtd. de banheiros"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ponto-toilets" className="text-sm font-semibold text-slate-700">Sanitários</Label>
              <Input
                id="ponto-toilets"
                value={toilets}
                onChange={(e) => setToilets(e.target.value)}
                placeholder="Qtd. de sanitários"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ponto-pieces" className="text-sm font-semibold text-slate-700">Peças</Label>
              <Input
                id="ponto-pieces"
                value={pieces}
                onChange={(e) => setPieces(e.target.value)}
                placeholder="Qtd. de peças"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="ponto-contact" className="text-sm font-semibold text-slate-700">Contato</Label>
              <Input
                id="ponto-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Nome e telefone do responsável"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ponto-sanitario" className="text-sm font-semibold text-slate-700">Número do Sanitário</Label>
              <Input
                id="ponto-sanitario"
                value={sanitarioNumber}
                onChange={(e) => setSanitarioNumber(e.target.value)}
                placeholder="Ex: 32, A-10, Principal..."
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="ponto-model" className="text-sm font-semibold text-slate-700">Modelo</Label>
              <Input
                id="ponto-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex: Van, Caminhão, Carro..."
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ponto-color" className="text-sm font-semibold text-slate-700">Cor</Label>
              <Input
                id="ponto-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Ex: Branco, Prata, Preto..."
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ponto-observation" className="text-sm font-semibold text-slate-700">Observação</Label>
            <Textarea
              id="ponto-observation"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Informações adicionais importantes..."
              rows={3}
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
              {isLoading ? 'Salvando...' : (ponto ? 'Atualizar Ponto' : 'Adicionar Ponto')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ErpPontoForm;

