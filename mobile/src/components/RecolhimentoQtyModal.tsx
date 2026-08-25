/**
 * Modal para informar quantidade recolhida em pontos de recolhimento.
 * Se recolher tudo, o ponto sai da rota automaticamente.
 */
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  totalQty: number;
  onClose: () => void;
  onConfirm: (recolhidoQty: number, autoRemove: boolean) => void;
}

const RecolhimentoQtyModal: React.FC<Props> = ({ open, totalQty, onClose, onConfirm }) => {
  const [qty, setQty] = useState<number>(totalQty);
  if (!open) return null;

  const handle = () => {
    const n = Math.max(0, Math.min(qty, totalQty));
    onConfirm(n, n >= totalQty);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-lg">Quantidade recolhida</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600">
            Total no local: <strong>{totalQty}</strong>
          </p>
          <input
            type="number"
            min={0}
            max={totalQty}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value) || 0)}
            className="w-full text-center text-3xl font-bold border-2 rounded-lg p-3"
          />
          {qty >= totalQty && (
            <p className="text-xs text-green-600 text-center">
              ✓ Recolhimento completo — o ponto sairá da rota
            </p>
          )}
          {qty > 0 && qty < totalQty && (
            <p className="text-xs text-orange-600 text-center">
              Recolhimento parcial — restam {totalQty - qty} no local
            </p>
          )}
        </div>
        <div className="p-4 border-t">
          <Button onClick={handle} className="w-full h-12 bg-green-600 hover:bg-green-700">
            <Check className="h-5 w-5 mr-2" />
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RecolhimentoQtyModal;
