import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, CheckCircle2, List } from 'lucide-react';

interface RouteInfoCardProps {
  routeName: string;
  totalStops: number;
  completedStops: number;
  onViewStops: () => void;
}

const RouteInfoCard: React.FC<RouteInfoCardProps> = ({
  routeName,
  totalStops,
  completedStops,
  onViewStops
}) => {
  const progressPercent = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-lg mb-2">{routeName}</h3>
          
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Progresso da Rota</span>
            <span className="font-medium">
              {completedStops} / {totalStops} paradas
            </span>
          </div>

          {/* Barra de Progresso */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>{totalStops} paradas</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              <span>{completedStops} concluídas</span>
            </div>
          </div>
        </div>

        {/* Área de Paradas da Rota */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-2 text-gray-700">
            Paradas da Rota
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Veja e organize as paradas do seu dia
          </p>
          
          <Button
            onClick={onViewStops}
            variant="outline"
            className="w-full gap-2"
          >
            <List className="h-4 w-4" />
            Ver lista completa de paradas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteInfoCard;
