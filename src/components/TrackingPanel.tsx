
import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTrucks } from '@/hooks/useTrucks';
import { Button } from "@/components/ui/button";
import { RefreshCw } from 'lucide-react';

const TrackingPanel = () => {
  const { trucks, loading, error, loadTrucks } = useTrucks();

  if (loading) {
    return (
      <div className="fixed top-4 right-4 w-80 max-w-[90vw] bg-white rounded-lg shadow-xl p-4 z-50">
        <div className="animate-pulse">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="h-4 bg-gray-300 rounded w-32"></div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed top-4 right-4 w-80 max-w-[90vw] bg-white rounded-lg shadow-xl p-4 z-50">
        <div className="text-red-500 text-sm mb-2">{error}</div>
        <Button size="sm" onClick={loadTrucks} variant="outline" className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 w-80 max-w-[90vw] bg-white rounded-lg shadow-xl p-4 z-50 max-h-[80vh] overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <h2 className="font-semibold text-gray-800 text-sm lg:text-base">Rastreamento em Tempo Real</h2>
        </div>
        <Button size="sm" onClick={loadTrucks} variant="ghost" className="p-2">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      
      {trucks.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">Nenhum caminhão encontrado</p>
          <p className="text-xs mt-1">Verifique a conexão com o servidor</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {trucks.map((truck, index) => {
            const truckColors = [
              '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', 
              '#eab308', '#06b6d4', '#a16207', '#6366f1', '#84cc16', '#0891b2'
            ];
            const truckColor = truckColors[index % truckColors.length];
            
            return (
              <Card 
                key={truck.id} 
                className="p-3 border-l-4 cursor-pointer hover:shadow-md transition-all"
                style={{ borderLeftColor: truckColor }}
                onClick={() => {
                  localStorage.setItem('selected-truck', truck.id);
                  window.dispatchEvent(new StorageEvent('storage', {
                    key: 'selected-truck',
                    newValue: truck.id
                  }));
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm" style={{ color: truckColor }}>{truck.name}</h3>
                   <Badge 
                    className={`text-xs ${
                      truck.status === 'in-route' ? 'bg-green-500/10 text-green-700 border-green-200' : 
                      truck.status === 'maintenance' ? 'bg-amber-500/10 text-amber-700 border-amber-200' : 
                      'bg-slate-500/10 text-slate-700 border-slate-200'
                    } border backdrop-blur-sm`}
                  >
                    <div className={`w-2 h-2 rounded-full mr-1 ${
                      truck.status === 'in-route' ? 'bg-green-500 animate-pulse' : 
                      truck.status === 'maintenance' ? 'bg-amber-500' : 
                      'bg-slate-400'
                    }`}></div>
                    {truck.status === 'in-route' ? (
                      <span className="flex items-center gap-1">
                        Em movimento
                      </span>
                    ) : truck.status === 'maintenance' ? (
                      <span className="flex items-center gap-1">
                        🔧 Manutenção
                      </span>
                    ) : 'Disponível'}
                  </Badge>
                </div>
              
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Placa:</span>
                  <span className="font-medium">{truck.plate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Modelo:</span>
                  <span className="font-medium">{truck.model} ({truck.year})</span>
                </div>
                {truck.driver && (
                  <div className="flex justify-between">
                    <span>Motorista:</span>
                    <span className="font-medium truncate ml-2">{truck.driver}</span>
                  </div>
                )}
                {truck.currentRoute && (
                  <div className="flex justify-between">
                    <span>Rota:</span>
                    <span className="font-medium truncate ml-2">{truck.currentRoute}</span>
                  </div>
                )}
                {truck.location && (
                  <div className="flex justify-between">
                    <span>Localização:</span>
                    <span className="font-medium text-xs">
                      {truck.location.lat.toFixed(4)}, {truck.location.lng.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          );
          })}
        </div>
      )}
    </div>
  );
};

export default TrackingPanel;
