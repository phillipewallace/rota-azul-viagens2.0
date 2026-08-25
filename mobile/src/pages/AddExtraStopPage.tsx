/**
 * AddExtraStopPage - Tela completa para adicionar parada extra
 * 
 * Funcionalidades:
 * - Campo de endereço com Google Maps Places Autocomplete
 * - Extração automática de coordenadas de links de mapa
 * - Pré-preenchimento via deep link (WhatsApp/Maps)
 * - Botão "Sugerir melhor posição" usando GPS
 * - Seleção manual de posição na rota
 * - Campos operacionais: banheiros, limpezas, contato, observações
 * 
 * IMPORTANTE: Não quebra o drag & drop existente na StopsList
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  MapPin, 
  Navigation, 
  Loader2, 
  Sparkles, 
  AlertCircle,
  Check,
  User,
  Tag,
  Phone,
  FileText,
  Droplets,
  Brush
} from 'lucide-react';
import { sharedLocationStore } from '@/store/sharedLocationStore';
import { GOOGLE_MAPS_API_KEY } from '@/services/config';
import { useMobile } from '@/hooks/useMobile';
import { toast } from 'sonner';

interface RoutePoint {
  id: string;
  name?: string;
  address: string;
  lat: number;
  lng: number;
  completed: boolean;
  order: number;
}

// Fórmula de Haversine para calcular distância entre dois pontos
const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Extrair coordenadas de texto/link
const extractCoordinatesFromText = (text: string): { lat?: number; lng?: number } => {
  const patterns = [
    /maps\?q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /maps\/place\/[^\/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /(-?\d+\.\d{4,}),\s*(-?\d+\.\d{4,})/,
    /geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return { lat, lng };
      }
    }
  }
  
  return {};
};

const AddExtraStopPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Dados da rota vindos dos params
  const routeId = searchParams.get('routeId') || '';
  const truckId = searchParams.get('truckId') || '';
  const pointsParam = searchParams.get('points');
  
  // Parse dos pontos
  const points: RoutePoint[] = pointsParam ? JSON.parse(decodeURIComponent(pointsParam)) : [];
  const pendingPoints = points.filter(p => !p.completed).sort((a, b) => a.order - b.order);
  
  // Estados do formulário - campos básicos
  const [name, setName] = useState('');
  const [stopType, setStopType] = useState('Entrega');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat?: number; lng?: number }>({});
  const [insertPosition, setInsertPosition] = useState<string>('end');
  
  // Estados do formulário - campos operacionais (VISÍVEIS por padrão)
  const [restroomsQty, setRestroomsQty] = useState('');
  const [cleaningsQty, setCleaningsQty] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  
  // Estados de UI
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [isCalculatingPosition, setIsCalculatingPosition] = useState(false);
  const [suggestedPosition, setSuggestedPosition] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showOperationalFields, setShowOperationalFields] = useState(true); // ✅ VISÍVEL por padrão
  
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  
  const { addExtraStop } = useMobile();

  // Inicializar Google Places Autocomplete
  useEffect(() => {
    const loadGoogleMaps = () => {
      if (!window.google?.maps?.places) {
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (!existingScript) {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
          script.async = true;
          script.onload = () => {
            setTimeout(initializeAutocomplete, 100);
          };
          document.head.appendChild(script);
        }
        return;
      }
      initializeAutocomplete();
    };

    loadGoogleMaps();
  }, []);

  const initializeAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places) return;
    
    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'br' },
        fields: ['formatted_address', 'geometry', 'name']
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const address = place.formatted_address || place.name || '';
          
          setLocation(address);
          setCoordinates({ lat, lng });
          
          console.log('📍 [ADD STOP PAGE] Endereço selecionado:', { address, lat, lng });
        }
      });
    } catch (error) {
      console.error('❌ [ADD STOP PAGE] Erro ao inicializar autocomplete:', error);
    }
  };

  // Função para processar localização recebida
  const processSharedLocation = (content: string) => {
    if (!content || content.trim() === '') return;
    
    console.log('📍 [ADD STOP PAGE] Processando localização:', content);
    setLocation(content);
    
    // Tentar extrair coordenadas
    const coords = extractCoordinatesFromText(content);
    if (coords.lat && coords.lng) {
      setCoordinates(coords);
      console.log('📍 [ADD STOP PAGE] Coordenadas extraídas:', coords);
      toast.success('Localização detectada!');
    }
  };

  // Pré-preencher com localização compartilhada (DEEP LINK)
  useEffect(() => {
    // Verificar store imediatamente
    const sharedState = sharedLocationStore.getState();
    console.log('📍 [ADD STOP PAGE] Estado inicial do store:', sharedState);
    
    if (sharedState.sharedContent) {
      processSharedLocation(sharedState.sharedContent);
    }
    
    // Verificar se há localização pendente do Android
    const pendingLocation = (window as any).pendingSharedLocation;
    if (pendingLocation) {
      console.log('📍 [ADD STOP PAGE] Localização pendente do Android:', pendingLocation);
      processSharedLocation(pendingLocation);
      delete (window as any).pendingSharedLocation;
    }
    
    // Escutar mudanças no store
    const unsubscribe = sharedLocationStore.subscribe((state) => {
      console.log('📍 [ADD STOP PAGE] Store atualizado:', state);
      if (state.sharedContent) {
        processSharedLocation(state.sharedContent);
      }
    });
    
    // Escutar evento customizado do Android
    const handleSharedLocationEvent = (event: any) => {
      console.log('📍 [ADD STOP PAGE] Evento sharedLocation recebido:', event.detail);
      if (event.detail) {
        processSharedLocation(event.detail);
      }
    };
    window.addEventListener('sharedLocation', handleSharedLocationEvent);
    
    return () => {
      unsubscribe();
      window.removeEventListener('sharedLocation', handleSharedLocationEvent);
    };
  }, []);

  // Monitorar mudanças no campo de localização
  const handleLocationChange = (value: string) => {
    setLocation(value);
    
    // Tentar extrair coordenadas se for um link
    const coords = extractCoordinatesFromText(value);
    if (coords.lat && coords.lng) {
      setCoordinates(coords);
    } else {
      setCoordinates({});
    }
  };

  // Obter localização atual via GPS
  const getCurrentPosition = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS não disponível neste dispositivo'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          let message = 'Erro ao obter localização';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Permissão de localização negada';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Localização não disponível';
              break;
            case error.TIMEOUT:
              message = 'Tempo esgotado ao obter localização';
              break;
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000
        }
      );
    });
  };

  // Calcular melhor posição usando Haversine
  const handleSuggestPosition = async () => {
    setIsCalculatingPosition(true);
    setGpsError(null);

    try {
      if (!coordinates.lat || !coordinates.lng) {
        throw new Error('Primeiro selecione um endereço com localização');
      }

      setIsLoadingGPS(true);
      const driverPosition = await getCurrentPosition();
      setIsLoadingGPS(false);

      console.log('📍 [SUGGEST] Posição motorista:', driverPosition);
      console.log('📍 [SUGGEST] Coordenadas parada:', coordinates);

      if (pendingPoints.length === 0) {
        setSuggestedPosition('end');
        setInsertPosition('end');
        toast.success('Sem paradas pendentes. Parada será no final.');
        return;
      }

      let bestPosition = 'end';
      let minExtraDistance = Infinity;

      for (let i = 0; i <= pendingPoints.length; i++) {
        let totalExtraDistance = 0;

        if (i === 0) {
          const distDriverToNew = haversineDistance(
            driverPosition.lat, driverPosition.lng,
            coordinates.lat!, coordinates.lng!
          );
          const distNewToFirst = haversineDistance(
            coordinates.lat!, coordinates.lng!,
            pendingPoints[0].lat, pendingPoints[0].lng
          );
          const distDriverToFirst = haversineDistance(
            driverPosition.lat, driverPosition.lng,
            pendingPoints[0].lat, pendingPoints[0].lng
          );
          
          totalExtraDistance = distDriverToNew + distNewToFirst - distDriverToFirst;
          
          if (totalExtraDistance < minExtraDistance) {
            minExtraDistance = totalExtraDistance;
            bestPosition = pendingPoints[0].id;
          }
        } else if (i === pendingPoints.length) {
          const lastPoint = pendingPoints[pendingPoints.length - 1];
          const distLastToNew = haversineDistance(
            lastPoint.lat, lastPoint.lng,
            coordinates.lat!, coordinates.lng!
          );
          
          totalExtraDistance = distLastToNew;
          
          if (totalExtraDistance < minExtraDistance) {
            minExtraDistance = totalExtraDistance;
            bestPosition = 'end';
          }
        } else {
          const prevPoint = pendingPoints[i - 1];
          const nextPoint = pendingPoints[i];
          
          const distPrevToNew = haversineDistance(
            prevPoint.lat, prevPoint.lng,
            coordinates.lat!, coordinates.lng!
          );
          const distNewToNext = haversineDistance(
            coordinates.lat!, coordinates.lng!,
            nextPoint.lat, nextPoint.lng
          );
          const distPrevToNext = haversineDistance(
            prevPoint.lat, prevPoint.lng,
            nextPoint.lat, nextPoint.lng
          );
          
          totalExtraDistance = distPrevToNew + distNewToNext - distPrevToNext;
          
          if (totalExtraDistance < minExtraDistance) {
            minExtraDistance = totalExtraDistance;
            bestPosition = nextPoint.id;
          }
        }
      }

      setSuggestedPosition(bestPosition);
      setInsertPosition(bestPosition);
      
      const positionLabel = bestPosition === 'end' 
        ? 'no final da rota'
        : `antes da parada ${pendingPoints.findIndex(p => p.id === bestPosition) + 1}`;
      
      toast.success(`Melhor posição: ${positionLabel} (+${minExtraDistance.toFixed(1)} km)`);

    } catch (error: any) {
      console.error('❌ [SUGGEST] Erro:', error);
      setGpsError(error.message);
      toast.error(error.message);
    } finally {
      setIsCalculatingPosition(false);
      setIsLoadingGPS(false);
    }
  };

  // Validar campos numéricos
  const validateNumericField = (value: string): number | undefined => {
    if (!value || value.trim() === '') return undefined;
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return undefined;
    return num;
  };

  // Salvar parada extra
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Preencha o nome do cliente/ponto');
      return;
    }

    if (!location.trim()) {
      toast.error('Preencha o endereço ou localização');
      return;
    }

    if (!routeId || !truckId) {
      toast.error('Dados da rota não encontrados');
      return;
    }

    // Validar campos numéricos
    const parsedRestroomsQty = validateNumericField(restroomsQty);
    const parsedCleaningsQty = validateNumericField(cleaningsQty);

    if (restroomsQty && parsedRestroomsQty === undefined) {
      toast.error('Quantidade de banheiros deve ser um número válido');
      return;
    }

    if (cleaningsQty && parsedCleaningsQty === undefined) {
      toast.error('Quantidade de limpezas deve ser um número válido');
      return;
    }

    setSaving(true);

    try {
      const data = {
        name: name.trim(),
        stopType,
        location: location.trim(),
        lat: coordinates.lat,
        lng: coordinates.lng,
        insertBeforeId: insertPosition !== 'end' ? insertPosition : undefined,
        // Novos campos operacionais
        restroomsQty: parsedRestroomsQty,
        cleaningsQty: parsedCleaningsQty,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined
      };

      console.log('📍 [ADD STOP PAGE] Salvando:', data);

      await addExtraStop(routeId, truckId, data);
      
      // Limpar localização compartilhada
      sharedLocationStore.clearSharedContent();
      
      toast.success('Parada extra adicionada com sucesso!');
      
      // Voltar para lista de paradas
      navigate(-1);

    } catch (error: any) {
      console.error('❌ [ADD STOP PAGE] Erro ao salvar:', error);
      toast.error(error?.message || 'Erro ao adicionar parada extra');
    } finally {
      setSaving(false);
    }
  };

  // Cancelar e voltar
  const handleCancel = () => {
    sharedLocationStore.clearSharedContent();
    navigate(-1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header fixo */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="safe-top" />
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="gap-2 -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar
          </Button>
          
          <h1 className="text-lg font-bold text-gray-900 absolute left-1/2 -translate-x-1/2">
            Adicionar Parada
          </h1>
          
          <div className="w-20" /> {/* Spacer */}
        </div>
      </header>

      {/* Conteúdo rolável */}
      <main className="flex-1 overflow-y-auto p-4 pb-40">
        <div className="max-w-lg mx-auto space-y-5">
          
          {/* Campo: Nome do cliente */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              Nome do cliente/ponto *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              className="h-14 text-base"
            />
          </div>

          {/* Campo: Tipo de parada */}
          <div className="space-y-2">
            <Label htmlFor="stopType" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-500" />
              Tipo de parada
            </Label>
            <select
              id="stopType"
              value={stopType}
              onChange={(e) => setStopType(e.target.value)}
              className="w-full h-14 border rounded-lg px-4 text-base bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Coleta">Coleta</option>
              <option value="Serviço">Serviço</option>
              <option value="Entrega">Entrega</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {/* Campo: Endereço com Autocomplete */}
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              Endereço *
            </Label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <Input
                ref={inputRef}
                id="location"
                value={location}
                onChange={(e) => handleLocationChange(e.target.value)}
                placeholder="Digite ou cole um endereço/link"
                className="pl-12 h-14 text-base"
              />
            </div>
            
            {/* Indicador de coordenadas */}
            {coordinates.lat && coordinates.lng ? (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                <Navigation className="h-4 w-4" />
                <span>Localização detectada: {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}</span>
              </div>
            ) : (
              <p className="text-xs text-gray-500 px-1">
                Selecione da lista ou cole um link do Google Maps/WhatsApp
              </p>
            )}
          </div>

          {/* Seção: Campos operacionais (expansível) */}
          <Card className="border-gray-200">
            <button
              type="button"
              onClick={() => setShowOperationalFields(!showOperationalFields)}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <span className="font-semibold text-gray-700">
                Dados operacionais (opcional)
              </span>
              <span className="text-gray-400">
                {showOperationalFields ? '▲' : '▼'}
              </span>
            </button>
            
            {showOperationalFields && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                {/* Banheiros e Limpezas em grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="restroomsQty" className="text-sm font-medium text-gray-600 flex items-center gap-1">
                      <Droplets className="h-3.5 w-3.5" />
                      Banheiros
                    </Label>
                    <Input
                      id="restroomsQty"
                      type="number"
                      min="0"
                      value={restroomsQty}
                      onChange={(e) => setRestroomsQty(e.target.value)}
                      placeholder="0"
                      className="h-12 text-base"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cleaningsQty" className="text-sm font-medium text-gray-600 flex items-center gap-1">
                      <Brush className="h-3.5 w-3.5" />
                      Limpezas
                    </Label>
                    <Input
                      id="cleaningsQty"
                      type="number"
                      min="0"
                      value={cleaningsQty}
                      onChange={(e) => setCleaningsQty(e.target.value)}
                      placeholder="0"
                      className="h-12 text-base"
                    />
                  </div>
                </div>
                
                {/* Nome do responsável */}
                <div className="space-y-2">
                  <Label htmlFor="contactName" className="text-sm font-medium text-gray-600 flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    Nome do responsável
                  </Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ex: Maria Souza"
                    className="h-12 text-base"
                  />
                </div>
                
                {/* Telefone do responsável */}
                <div className="space-y-2">
                  <Label htmlFor="contactPhone" className="text-sm font-medium text-gray-600 flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    Telefone
                  </Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="h-12 text-base"
                  />
                </div>
                
                {/* Observações */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium text-gray-600 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    Observações
                  </Label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Informações adicionais..."
                    rows={3}
                    className="w-full border rounded-lg px-4 py-3 text-base resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-400 text-right">{notes.length}/500</p>
                </div>
              </div>
            )}
          </Card>

          {/* Botão: Sugerir melhor posição */}
          <Card className="bg-blue-50 border-blue-200 p-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleSuggestPosition}
              disabled={isCalculatingPosition || !coordinates.lat}
              className="w-full h-14 gap-3 border-blue-300 text-blue-700 hover:bg-blue-100 text-base font-medium"
            >
              {isCalculatingPosition ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isLoadingGPS ? 'Obtendo GPS...' : 'Calculando...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Sugerir melhor posição na rota
                </>
              )}
            </Button>
            
            <p className="text-xs text-blue-600 mt-3 text-center">
              Usa sua localização GPS para otimizar a posição
            </p>
            
            {gpsError && (
              <div className="flex items-center gap-2 text-sm text-red-600 mt-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{gpsError}</span>
              </div>
            )}
            
            {suggestedPosition && (
              <div className="flex items-center gap-2 text-sm text-green-600 mt-3 font-medium">
                <Check className="h-4 w-4" />
                <span>Posição otimizada selecionada!</span>
              </div>
            )}
          </Card>

          {/* Seleção de posição na rota */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-700">
              Posição na rota
            </Label>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {pendingPoints.map((point, index) => (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => setInsertPosition(point.id)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    insertPosition === point.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      insertPosition === point.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {insertPosition === point.id && (
                        <Check className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">
                        Antes da parada {index + 1}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {point.name || point.address}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              
              {/* Opção: No final da rota */}
              <button
                type="button"
                onClick={() => setInsertPosition('end')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  insertPosition === 'end'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    insertPosition === 'end'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {insertPosition === 'end' && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">
                      No final da rota
                    </p>
                    <p className="text-xs text-gray-500">
                      Adicionar como última parada
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer fixo com botões */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-10">
        <div className="p-4 max-w-lg mx-auto">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1 h-14 text-base font-medium"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 h-14 text-base font-medium bg-blue-600 hover:bg-blue-700"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar parada'
              )}
            </Button>
          </div>
        </div>
        <div className="pb-safe bg-white" />
      </footer>
    </div>
  );
};

export default AddExtraStopPage;
