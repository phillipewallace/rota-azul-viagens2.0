/**
 * StopDetailsPage - Tela de detalhes da parada
 * 
 * Exibe todas as informações do ponto:
 * - Nome do cliente
 * - Tipo de parada
 * - Endereço
 * - Quantidade de banheiros
 * - Quantidade de limpezas
 * - Nome do responsável
 * - Telefone (com botão para ligar)
 * - Observações
 */

import React from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  ArrowLeft, 
  MapPin, 
  User, 
  Phone, 
  Building2, 
  Sparkles,
  CheckCircle2,
  Clock,
  MessageSquare,
  Navigation
} from 'lucide-react';
import { RoutePoint, getPointDisplayName, isValidPhoneForCall, formatPhoneForCall } from '@/types/route';

const StopDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Receber dados do ponto via location.state OU URL params
  const stateData = location.state as { point?: RoutePoint; index?: number } | null;
  
  // Priorizar location.state, fallback para URL params
  let point: RoutePoint | null = null;
  let index = 0;
  
  if (stateData?.point) {
    point = stateData.point;
    index = stateData.index ?? 0;
  } else {
    const pointParam = searchParams.get('point');
    point = pointParam ? JSON.parse(decodeURIComponent(pointParam)) : null;
    index = parseInt(searchParams.get('index') || '0', 10);
  }

  if (!point) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 items-center justify-center p-4">
        <p className="text-gray-500">Dados da parada não encontrados</p>
        <Button onClick={() => navigate(-1)} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const displayName = getPointDisplayName(point);
  const canCall = isValidPhoneForCall(point.contactPhone);

  const handleCall = () => {
    if (canCall && point.contactPhone) {
      window.location.href = formatPhoneForCall(point.contactPhone);
    }
  };

  const handleNavigate = () => {
    if (point.lat && point.lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
      window.open(url, '_blank');
    }
  };

  const formatCoordinate = (coord: number | undefined): string => {
    if (!coord) return '–';
    return coord.toFixed(6);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="safe-top" />
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2 -ml-2"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Button>

            {point.lat && point.lng && (
              <Button
                onClick={handleNavigate}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Navigation className="h-4 w-4" />
                Navegar
              </Button>
            )}
          </div>
          
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <span className={`font-bold text-lg ${point.completed ? 'text-green-600' : 'text-blue-600'}`}>
                Parada {index + 1}
              </span>
              {point.completed && (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{displayName}</h1>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 overflow-y-auto p-4 pb-32 space-y-4">
        
        {/* Tipo de Operação e Categoria */}
        {(point.operationType || point.pointCategory) && (
          <Card className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs text-gray-500 uppercase">O que fazer aqui</p>
                <div className="flex gap-2 flex-wrap">
                  {point.operationType && (
                    <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                      point.operationType === 'entrega' ? 'bg-blue-100 text-blue-700' :
                      point.operationType === 'recolhimento' ? 'bg-orange-100 text-orange-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {point.operationType === 'entrega' ? '📦 Entrega' :
                       point.operationType === 'recolhimento' ? '🔄 Recolhimento' :
                       '🔧 Manutenção'}
                    </span>
                  )}
                  {point.pointCategory && (
                    <span className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700">
                      {point.pointCategory === 'obra' ? '🏗️ Obra' : '🎉 Evento'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Endereço */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase">Endereço</p>
              <p className="font-semibold">{point.address || '–'}</p>
              {point.cep && (
                <p className="text-sm text-gray-500 mt-1">CEP: {point.cep}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Lat: {formatCoordinate(point.lat)} | Lng: {formatCoordinate(point.lng)}
              </p>
            </div>
          </div>
        </Card>

        {/* Dados Operacionais */}
        {(point.restroomsQty !== undefined || point.cleaningsQty !== undefined) && (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase mb-2">Dados Operacionais</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Banheiros</p>
                    <p className="font-bold text-lg">{point.restroomsQty ?? '–'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Limpezas</p>
                    <p className="font-bold text-lg">{point.cleaningsQty ?? '–'}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Contato */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <User className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase mb-2">Responsável Local</p>
              <p className="font-semibold">{point.contactName || '–'}</p>
              
              {point.contactPhone && (
                <div className="flex items-center gap-2 mt-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{point.contactPhone}</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Observações */}
        {(point.notes || point.observation) && (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase mb-2">Observações</p>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {point.notes || point.observation}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Status de Conclusão */}
        {point.completed && point.completedAt && (
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-green-600 uppercase mb-1">Parada Concluída</p>
                <p className="font-semibold text-green-700">
                  {new Date(point.completedAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </Card>
        )}
      </main>

      {/* Footer com botão de ligar */}
      {canCall && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-10">
          <div className="p-4">
            <Button
              onClick={handleCall}
              className="w-full h-14 gap-2 text-base font-medium bg-green-600 hover:bg-green-700"
            >
              <Phone className="h-5 w-5" />
              Ligar para {point.contactName || 'Responsável'}
            </Button>
          </div>
          <div className="pb-safe bg-white" />
        </footer>
      )}
    </div>
  );
};

export default StopDetailsPage;
