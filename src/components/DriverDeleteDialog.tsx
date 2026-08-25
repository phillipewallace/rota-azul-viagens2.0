
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Truck, Activity } from 'lucide-react';
import { DriverDependencies } from '@/hooks/useDriversCRUD';

interface DriverDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverName: string;
  dependencies: DriverDependencies | null;
  onConfirm: (force: boolean) => void;
  isLoading: boolean;
}

export const DriverDeleteDialog: React.FC<DriverDeleteDialogProps> = ({
  open,
  onOpenChange,
  driverName,
  dependencies,
  onConfirm,
  isLoading
}) => {
  const handleConfirm = () => {
    // Always force delete if there are dependencies
    const shouldForce = dependencies?.trucks.length > 0;
    onConfirm(shouldForce);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!dependencies) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verificando dependências...</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 animate-spin" />
              <span>Verificando vínculos do motorista...</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Confirmar Exclusão
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p>Tem certeza que deseja excluir o motorista <strong>{driverName}</strong>?</p>
          
          {dependencies.trucks.length > 0 && (
            <Alert>
              <Truck className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Atenção:</strong> Este motorista está vinculado a {dependencies.trucks.length} caminhão(ões):</p>
                  <ul className="list-disc list-inside space-y-1">
                    {dependencies.trucks.map(truck => (
                      <li key={truck.id} className="text-sm">
                        {truck.name} - {truck.plate}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800">
                      ⚠️ Ao confirmar, o motorista será automaticamente desvinculado dos caminhões e então excluído.
                    </p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {dependencies.tripsCount > 0 && (
            <Alert>
              <AlertDescription>
                <strong>Histórico:</strong> Este motorista possui {dependencies.tripsCount} viagem(ens) registrada(s).
                O histórico será mantido mesmo após a exclusão.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
