/**
 * Modal para informar a numeração dos sanitários (banheiros químicos)
 * usados em uma operação de entrega/recolhimento.
 *
 * Em entrega: motorista informa quais números foram instalados.
 * Em recolhimento: motorista informa quais números foram recolhidos
 *                  (pré-preenchido com os entregues, se conhecidos).
 */
import React, { useState, useEffect } from 'react';
import { X, Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  operationType: 'entrega' | 'recolhimento' | 'manutencao';
  expectedQty: number;            // qtd. de banheiros do ponto
  initialNumbers?: string[];      // pré-preencher (ex: já entregues)
  onClose: () => void;
  onConfirm: (numeros: string[]) => void;
}

const SanitarioNumberModal: React.FC<Props> = ({
  open, operationType, expectedQty, initialNumbers, onClose, onConfirm,
}) => {
  const [nums, setNums] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (open) {
      const base = initialNumbers && initialNumbers.length
        ? initialNumbers
        : Array.from({ length: Math.max(expectedQty, 1) }, () => '');
      setNums(base);
    }
  }, [open, expectedQty, initialNumbers]);

  if (!open) return null;

  const update = (i: number, v: string) =>
    setNums((prev) => prev.map((n, idx) => (idx === i ? v : n)));

  const add = () => {
    if (draft.trim()) {
      setNums((p) => [...p, draft.trim()]);
      setDraft('');
    } else {
      setNums((p) => [...p, '']);
    }
  };

  const remove = (i: number) => setNums((p) => p.filter((_, idx) => idx !== i));

  const handle = () => {
    const filled = nums.map((n) => n.trim()).filter(Boolean);
    if (!filled.length) return;
    onConfirm(filled);
  };

  const title = operationType === 'recolhimento'
    ? 'Números recolhidos'
    : operationType === 'manutencao'
    ? 'Sanitário em manutenção'
    : 'Numeração dos sanitários';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          <p className="text-sm text-gray-600 mb-2">
            Informe o número de cada sanitário ({nums.filter((n) => n.trim()).length}/{expectedQty || nums.length})
          </p>
          {nums.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6">#{i + 1}</span>
              <input
                value={n}
                onChange={(e) => update(i, e.target.value)}
                placeholder="ex: 1024"
                inputMode="numeric"
                className="flex-1 border-2 rounded-lg px-3 py-2 font-mono"
              />
              <button onClick={() => remove(i)} className="p-2 text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Adicionar número avulso"
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <Button variant="outline" onClick={add} className="gap-1">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        <div className="p-4 border-t pb-safe">
          <Button
            onClick={handle}
            disabled={!nums.some((n) => n.trim())}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700"
          >
            <Check className="h-5 w-5 mr-2" />
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SanitarioNumberModal;
