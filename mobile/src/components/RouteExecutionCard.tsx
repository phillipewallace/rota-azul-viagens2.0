import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MapPin, Navigation, CheckCircle2, Clock,
  Building2, Hammer, PackageOpen, Wrench, Hash,
} from 'lucide-react';

interface RoutePoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  completed: boolean;
  name?: string;
  customerName?: string;
  pointCategory?: 'obra' | 'evento';
  operationType?: 'entrega' | 'recolhimento' | 'manutencao';
  restroomsQty?: number;
  sanitarioNumbers?: string[];
  sanitario_numbers?: string[];
  autoRemoved?: boolean;
}

interface RouteExecutionCardProps {
  points: RoutePoint[];
  onPointComplete: (pointId: string, completed: boolean) => Promise<void> | void;
  onFinishRoute: () => Promise<void>;
}

const operationLabels: Record<string, { label: string; icon: any; color: string }> = {
  entrega: { label: 'Entrega', icon: PackageOpen, color: 'bg-blue-100 text-blue-700' },
  recolhimento: { label: 'Recolhimento', icon: Hammer, color: 'bg-orange-100 text-orange-700' },
  manutencao: { label: 'Manutenção', icon: Wrench, color: 'bg-purple-100 text-purple-700' },
};

const RouteExecutionCard: React.FC<RouteExecutionCardProps> = ({
  points, onPointComplete, onFinishRoute,
}) => {
  const [routeStarted, setRouteStarted] = useState(false);
  const [loading, setLoading] = useState(false);

  const visible = points.filter((p) => !p.autoRemoved);
  const nextPoint = visible.find((p) => !p.completed);
  const allCompleted = visible.length > 0 && visible.every((p) => p.completed);

  const handleCompletePoint = async (id: string) => {
    setLoading(true);
    try { await onPointComplete(id, true); } finally { setLoading(false); }
  };

  const handleOpenInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const handleFinish = async () => {
    if (!window.confirm('Deseja finalizar a rota?')) return;
    setLoading(true);
    try { await onFinishRoute(); setRouteStarted(false); } finally { setLoading(false); }
  };

  if (!routeStarted) {
    return (
      <Card>
        <CardContent className="p-4">
          <Button onClick={() => setRouteStarted(true)} className="w-full gap-2" size="lg">
            <Clock className="h-5 w-5" />
            Iniciar Rota
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (allCompleted) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h3 className="font-semibold text-lg mb-2">Todas as paradas concluídas!</h3>
          <Button onClick={handleFinish} disabled={loading} className="w-full">
            {loading ? 'Finalizando...' : 'Finalizar Rota'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!nextPoint) return null;

  const op = nextPoint.operationType
    ? operationLabels[nextPoint.operationType]
    : null;
  const OpIcon = op?.icon;
  const numeros = nextPoint.sanitarioNumbers || nextPoint.sanitario_numbers || [];
  const idx = visible.indexOf(nextPoint);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <MapPin className="h-5 w-5 text-blue-600" />
            <span className="font-semibold">
              Próxima ({idx + 1}/{visible.length})
            </span>

            {nextPoint.pointCategory && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100">
                <Building2 className="h-3 w-3" />
                {nextPoint.pointCategory === 'obra' ? 'Obra' : 'Evento'}
              </span>
            )}

            {op && OpIcon && (
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${op.color}`}>
                <OpIcon className="h-3 w-3" />
                {op.label}
              </span>
            )}
          </div>

          {(nextPoint.customerName || nextPoint.name) && (
            <p className="font-medium text-gray-900 mb-1">
              {nextPoint.customerName || nextPoint.name}
            </p>
          )}

          <p className="text-sm text-gray-600">{nextPoint.address}</p>

          {!!nextPoint.restroomsQty && (
            <p className="text-xs text-gray-500 mt-1">
              Banheiros previstos: <strong>{nextPoint.restroomsQty}</strong>
            </p>
          )}

          {numeros.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-2">
              <Hash className="h-3 w-3 text-gray-400" />
              {numeros.map((n) => (
                <span key={n} className="text-xs font-mono bg-gray-100 rounded px-1.5 py-0.5">
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Button
            onClick={() => handleOpenInMaps(nextPoint.lat, nextPoint.lng)}
            variant="outline"
            className="w-full gap-2"
          >
            <Navigation className="h-4 w-4" />
            Abrir no Google Maps
          </Button>

          <Button
            onClick={() => handleCompletePoint(nextPoint.id)}
            disabled={loading}
            className="w-full gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {loading
              ? 'Marcando...'
              : nextPoint.operationType === 'recolhimento'
              ? 'Concluir recolhimento'
              : nextPoint.operationType === 'manutencao'
              ? 'Concluir manutenção'
              : 'Concluir entrega'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteExecutionCard;
