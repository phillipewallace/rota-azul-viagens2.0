
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TruckForm } from './TruckForm';
import { Truck } from '@/hooks/useTrucks';

interface TruckModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  truck?: Truck;
  onSubmit: (data: Omit<Truck, 'id'>) => Promise<void>;
  isLoading?: boolean;
}

export const TruckModal: React.FC<TruckModalProps> = ({
  open,
  onOpenChange,
  truck,
  onSubmit,
  isLoading = false
}) => {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {truck ? 'Editar Caminhão' : 'Novo Caminhão'}
          </DialogTitle>
        </DialogHeader>
        <TruckForm
          truck={truck}
          onSubmit={onSubmit}
          onCancel={handleClose}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
};
