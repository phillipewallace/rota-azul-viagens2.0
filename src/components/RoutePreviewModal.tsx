
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Route } from 'lucide-react';

interface RoutePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: any;
  onSave: () => void;
  onBack: () => void;
  loading: boolean;
  isEditing: boolean;
}

const RoutePreviewModal: React.FC<RoutePreviewModalProps> = ({
  open,
  onOpenChange,
  previewData,
  onSave,
  onBack,
  loading,
  isEditing
}) => {
  if (!previewData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview da Rota</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Informações da Rota */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">{previewData.name}</h3>
              {previewData.description && (
                <p className="text-gray-600 text-sm">{previewData.description}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-blue-600" />
                <span className="text-sm">
                  <strong>Distância:</strong> {previewData.totalDistance?.toFixed(2) || 0} km
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm">
                  <strong>Tempo estimado:</strong> {previewData.estimatedTime || 'N/A'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-sm">
                  <strong>Pontos:</strong> {previewData.points?.length || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Lista de Pontos */}
          {previewData.points && previewData.points.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Pontos da Rota (Ordem Otimizada):</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {previewData.points.map((point: any, index: number) => (
                  <div key={point.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      point.type === 'origin' ? 'bg-green-500' :
                      point.type === 'destination' ? 'bg-red-500' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{point.address}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {point.type === 'origin' ? 'Origem' :
                           point.type === 'destination' ? 'Destino' : 'Parada'}
                        </Badge>
                        {point.cep && (
                          <span className="text-xs text-gray-500">CEP: {point.cep}</span>
                        )}
                      </div>
                      {point.observation && (
                        <p className="text-xs text-gray-600 mt-2 p-2 bg-slate-50 rounded border border-slate-200">
                          <strong>Obs:</strong> {point.observation}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onBack} disabled={loading}>
              Voltar para Edição
            </Button>
            
            <Button onClick={onSave} disabled={loading}>
              {loading ? 'Salvando...' : isEditing ? 'Atualizar Rota' : 'Criar Rota'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoutePreviewModal;
