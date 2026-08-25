import React, { useState } from 'react';
import { ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrucks } from '@/hooks/useTrucks';
import { cn } from '@/lib/utils';

const MobileTrackingDrawer = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { trucks, loading, loadTrucks } = useTrucks();

  const truckColors = [
    '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', 
    '#eab308', '#06b6d4', '#a16207', '#6366f1', '#84cc16', '#0891b2'
  ];

  const activeTrucks = trucks.filter(t => t.status === 'in-route');

  return (
    <div 
      className={cn(
        "fixed bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-all duration-300 z-30",
        isExpanded ? "h-[60vh]" : "h-24"
      )}
    >
      {/* Handle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex flex-col items-center pt-2 pb-1"
      >
        <div className="w-12 h-1 bg-gray-300 rounded-full mb-2" />
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {isExpanded ? (
            <>
              <ChevronDown className="h-4 w-4" />
              <span>Minimizar</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-4 w-4" />
              <span>
                {activeTrucks.length > 0 
                  ? `${activeTrucks.length} caminhão(ões) em rota`
                  : 'Rastreamento'
                }
              </span>
            </>
          )}
        </div>
      </button>

      {/* Content */}
      <div className={cn("px-4 overflow-hidden", isExpanded ? "h-[calc(60vh-4rem)] overflow-y-auto" : "h-12")}>
        {!isExpanded ? (
          /* Collapsed view - horizontal scroll */
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {trucks.slice(0, 5).map((truck, index) => (
              <Card 
                key={truck.id}
                className="flex-shrink-0 p-2 min-w-[120px] border-l-4"
                style={{ borderLeftColor: truckColors[index % truckColors.length] }}
                onClick={() => {
                  localStorage.setItem('selected-truck', truck.id);
                  window.dispatchEvent(new StorageEvent('storage', {
                    key: 'selected-truck',
                    newValue: truck.id
                  }));
                }}
              >
                <p className="text-xs font-medium truncate">{truck.name}</p>
                <Badge 
                  className={cn(
                    "text-[10px] px-1.5 py-0 mt-1",
                    truck.status === 'in-route' 
                      ? "bg-green-100 text-green-700" 
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  {truck.status === 'in-route' ? 'Em rota' : 'Parado'}
                </Badge>
              </Card>
            ))}
          </div>
        ) : (
          /* Expanded view - full list */
          <div className="space-y-3 pb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">Rastreamento</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={loadTrucks}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>

            {trucks.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                Nenhum caminhão encontrado
              </p>
            ) : (
              trucks.map((truck, index) => {
                const color = truckColors[index % truckColors.length];
                return (
                  <Card 
                    key={truck.id}
                    className="p-3 border-l-4 cursor-pointer active:bg-gray-50"
                    style={{ borderLeftColor: color }}
                    onClick={() => {
                      localStorage.setItem('selected-truck', truck.id);
                      window.dispatchEvent(new StorageEvent('storage', {
                        key: 'selected-truck',
                        newValue: truck.id
                      }));
                      setIsExpanded(false);
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm" style={{ color }}>
                        {truck.name}
                      </h4>
                      <Badge 
                        className={cn(
                          "text-xs",
                          truck.status === 'in-route' 
                            ? "bg-green-100 text-green-700 border-green-200" 
                            : truck.status === 'maintenance'
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        )}
                      >
                        {truck.status === 'in-route' ? 'Em rota' : 
                         truck.status === 'maintenance' ? 'Manutenção' : 'Disponível'}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Placa:</span>
                        <span className="font-medium">{truck.plate}</span>
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
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileTrackingDrawer;
