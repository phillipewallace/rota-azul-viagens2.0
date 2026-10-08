/**\n * Modal de formulário para criação/edição de rotas no ERP.\n * Contém todos os campos da rota: nome, empresa, endereço, limpezas, banheiros,\n * contato, observação, número do sanitário, modelo e cor.\n */\nimport React, { useState } from 'react';\nimport {\n  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,\n} from '@/components/ui/dialog';\nimport { Button } from '@/components/ui/button';\nimport { Input } from '@/components/ui/input';\nimport { Textarea } from '@/components/ui/textarea';\nimport { Label } from '@/components/ui/label';\nimport { Rota, validateRota } from '@/types/rota';\nimport { toast } from 'sonner';\n\ninterface ErpRotaFormProps {\n  open: boolean;\n  onOpenChange: (open: boolean) => void;\n  rota: Rota | null;\n  onSave: (data: Omit<Rota, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;\n  isLoading: boolean;\n}\n\nconst ErpRotaForm: React.FC<ErpRotaFormProps> = (\n  { open, onOpenChange, rota, onSave, isLoading }\n) => {\n  const [name, setName] = useState(rota?.name || '');\n  const [company, setCompany] = useState(rota?.company || '');\n  const [address, setAddress] = useState(rota?.address || '');\n  const [cleaning, setCleaning] = useState(rota?.cleaning || '');\n  const [bathrooms, setBathrooms] = useState(rota?.bathrooms || '');\n  const [contact, setContact] = useState(rota?.contact || '');\n  const [observation, setObservation] = useState(rota?.observation || '');\n  const [sanitarioNumber, setSanitarioNumber] = useState(rota?.sanitarioNumber || '');\n  const [model, setModel] = useState(rota?.model || '');\n  const [color, setColor] = useState(rota?.color || '');\n  const [errors, setErrors] = useState<string[]>([]);\n\n  const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    const validation = validateRota({ name, company, address });\n    if (!validation.valid) {\n      setErrors(validation.errors);\n      toast.error('Preencha os campos obrigatórios');\n      return;\n    }\n    try {\n      await onSave({\n        name, company, address, cleaning, bathrooms, contact,\n        observation, sanitarioNumber, model, color\n      });\n      toast.success(rota ? 'Rota atualizada com sucesso!' : 'Rota criada com sucesso!');\n      onOpenChange(false);\n    } catch (err: any) {\n      console.error('Erro ao salvar rota:', err);\n      toast.error(err.message || 'Erro ao salvar rota');\n    }\n  };\n\n  const inputClass = \"w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all\";\n\n  return (\n    <Dialog open={open} onOpenChange={onOpenChange}>\n      <DialogContent className=\"sm:max-w-2xl max-h-[90vh] overflow-y-auto\">\n        <DialogHeader>\n          <DialogTitle>\n            {rota ? 'Editar Rota' : 'Nova Rota'}\n          </DialogTitle>\n          <DialogDescription>\n            Preencha os dados da rota para {rota ? 'edição' : 'cadastro'}. Os campos obrigatórios são indicados com *.\n          </DialogDescription>\n        </DialogHeader>\n\n        <form onSubmit={handleSubmit} className=\"space-y-4\">\n          <div className=\"space-y-1\">\n            <Label htmlFor=\"name\" className=\"text-sm font-semibold text-slate-700\">Nome da Rota *</Label>\n            <Input\n              id=\"name\"\n              value={name}\n              onChange={(e) => setName(e.target.value)}\n              placeholder=\"Ex: Rota de Limpeza - Centro\"\n              className={inputClass}\n            />\n          </div>\n\n          <div className=\"space-y-1\">\n            <Label htmlFor=\"company\" className=\"text-sm font-semibold text-slate-700\">Empresa *</Label>\n            <Input\n              id=\"company\"\n              value={company}\n              onChange={(e) => setCompany(e.target.value)}\n              placeholder=\"Ex: Centro de Limpeza do Sul\"\n              className={inputClass}\n            />\n          </div>\n\n          <div className=\"space-y-1\">\n            <Label htmlFor=\"address\" className=\"text-sm font-semibold text-slate-700\">Endereço *</Label>\n            <Input\n              id=\"address\"\n              value={address}\n              onChange={(e) => setAddress(e.target.value)}\n              placeholder=\"Rua, número, bairro, cidade\"\n              className={inputClass}\n            />\n          </div>

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