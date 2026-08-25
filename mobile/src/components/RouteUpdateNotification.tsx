
import React from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { RefreshCw, X, AlertCircle } from 'lucide-react';
import type { TruckMobileData } from '../hooks/useMobile';

interface RouteUpdateNotificationProps {
  isVisible: boolean;
  newRouteData: TruckMobileData | null;
  onAccept: (newData: TruckMobileData) => void;
  onDismiss: () => void;
  isChecking: boolean;
}

const RouteUpdateNotification: React.FC<RouteUpdateNotificationProps> = ({
  isVisible,
  newRouteData,
  onAccept,
  onDismiss,
  isChecking
}) => {
  if (!isVisible || !newRouteData) return null;

  const currentRoute = newRouteData.currentRoute;
  const completedCount = currentRoute?.points?.filter(p => p.completed).length || 0;
  const totalCount = currentRoute?.points?.length || 0;
  const newPointsCount = totalCount - completedCount;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-in slide-in-from-top-2">
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <RefreshCw className={`w-5 h-5 text-white ${isChecking ? 'animate-spin' : ''}`} />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-blue-900">Rota Atualizada!</h3>
                <AlertCircle className="w-4 h-4 text-blue-600" />
              </div>
              
              <p className="text-sm text-blue-800 mb-3">
                Sua rota foi atualizada com novos pontos. Seus pontos concluídos foram preservados.
              </p>
              
              <div className="bg-white/60 rounded-lg p-3 mb-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-blue-900">{completedCount}</div>
                    <div className="text-blue-700">Concluídos</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-green-900">{newPointsCount}</div>
                    <div className="text-green-700">Novos Pontos</div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => onAccept(newRouteData)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar Rota
                </Button>
                
                <Button
                  onClick={onDismiss}
                  variant="outline"
                  className="px-3 border-blue-300 text-blue-700 hover:bg-blue-50"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RouteUpdateNotification;
