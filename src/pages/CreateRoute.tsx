import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { RoutePointsTable } from '@/components/RoutePointsTable';
import SanitarioPickerModal, { AllocatedSanitario } from '@/components/SanitarioPickerModal';
import RouteMapPreview from '@/components/RouteMapPreview';
import { useRoutes, RoutePoint } from '@/hooks/useRoutes';
import { useRoutesCRUD } from '@/hooks/useRoutesCRUD';
import { useRouteAutoSave } from '@/hooks/useRouteAutoSave';
import { googleMapsService } from '@/services/googleMaps';
import { toast } from 'sonner';
import { ArrowLeft, Save, MapPin, Eraser, Eye, Clock, Map, ChevronUp, ChevronDown, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileOperatorCreateRoute from '@/components/mobile/operator/MobileOperatorCreateRoute';

const CreateRoute = () => {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return <MobileOperatorCreateRoute />;
  }

  return <DesktopCreateRoute />;
};

const DesktopCreateRoute = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [optimizationMode, setOptimizationMode] = useState<'fixed' | 'optimized'>('optimized');
  const [allPoints, setAllPoints] = useState<RoutePoint[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState<number | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [showSettings, setShowSettings] = useState(true);

  const pointIdCounter = useRef(0);

  const { getAddressByCep, optimizeRoute, createRoute, routes, loadRoutes } = useRoutes();
  const { updateRoute } = useRoutesCRUD();
  const { scheduleAutoSave, loadFromStorage, clearStorage } = useRouteAutoSave(editId || undefined);

  const isEditing = !!editId;

  const generateUniqueId = useCallback((prefix: string = 'point') => {
    pointIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${pointIdCounter.current}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const recalculatePointTypes = useCallback((points: RoutePoint[]): RoutePoint[] => {
    if (points.length === 0) return points;
    
    return points.map((point, index) => {
      let type: 'origin' | 'destination' | 'waypoint';
      
      if (index === 0) {
        type = 'origin';
      } else if (index === points.length - 1) {
        type = 'destination';
      } else {
        type = 'waypoint';
      }
      
      return {
        ...point,
        type,
        order: index
      };
    });
  }, []);

  // Inicializar Google Maps ao carregar o componente
  useEffect(() => {
    googleMapsService.initialize().catch(err => {
      console.error('❌ Erro ao inicializar Google Maps:', err);
    });
  }, []);

  // Carregar rota para edição
  useEffect(() => {
    if (isEditing && editId) {
      loadRoutes();
    }
  }, [isEditing, editId, loadRoutes]);

  useEffect(() => {
    if (isEditing && editId && routes.length > 0) {
      const routeToEdit = routes.find(r => r.id === editId);
      if (routeToEdit) {
        console.log('✏️ [CREATE ROUTE] Carregando rota para edição:', routeToEdit.name);
        setRouteName(routeToEdit.name || '');
        setRouteDescription(routeToEdit.description || '');
        setOptimizationMode(routeToEdit.optimizationMode || 'optimized');

        const points = routeToEdit.points || [];
        console.log('📋 [CREATE ROUTE] Pontos da rota para edição:', points);
        
        const pointsWithUniqueIds = points.map((point: any, index: number) => ({
          id: point.id || generateUniqueId(`existing-${index}`),
          order: point.order ?? index,
          cep: point.cep || '',
          address: point.address || '',
          lat: point.lat || 0,
          lng: point.lng || 0,
          type: point.type,
          customerName: point.customerName || '',
          restroomsQty: point.restroomsQty,
          cleaningsQty: point.cleaningsQty,
          contactName: point.contactName || '',
          contactPhone: point.contactPhone || '',
          notes: point.notes || point.observation || '',
          observation: point.notes || point.observation || '',
          stopType: point.stopType || '',
          pointCategory: point.pointCategory || 'obra',
          operationType: point.operationType || 'entrega',
          recolhidoQty: point.recolhidoQty,
          autoRemoved: point.autoRemoved || false,
          sanitarioNumbers: point.sanitarioNumbers || [],
          sanitarioRecolhidos: point.sanitarioRecolhidos || [],
          completed: point.completed || false,
          completedAt: point.completedAt || null
        }));

        const sortedPoints = [...pointsWithUniqueIds].sort((a: any, b: any) => a.order - b.order);
        const pointsWithCorrectTypes = recalculatePointTypes(sortedPoints);
        
        console.log('✅ [CREATE ROUTE] Pontos carregados com campos operacionais:', pointsWithCorrectTypes.length);
        setAllPoints(pointsWithCorrectTypes);
      }
    } else if (!isEditing) {
      // Verificar se veio da cópia de pontos
      const fromCopy = searchParams.get('fromCopy');
      const copiedPoints = localStorage.getItem('copiedRoutePoints');
      const copiedFromRoute = localStorage.getItem('copiedFromRoute');
      
      if (fromCopy === 'true' && copiedPoints) {
        try {
          const points = JSON.parse(copiedPoints);
          if (points && points.length > 0) {
            console.log('📋 [CREATE ROUTE] Carregando pontos copiados:', points.length);
            
            clearStorage();
            
            const convertedPoints = points.map((point: any, index: number) => ({
              id: generateUniqueId(`copied-${index}`),
              order: index,
              address: point.address || '',
              lat: point.lat || 0,
              lng: point.lng || 0,
              cep: point.cep || '',
              customerName: point.customerName || '',
              restroomsQty: point.restroomsQty,
              cleaningsQty: point.cleaningsQty,
              contactName: point.contactName || '',
              contactPhone: point.contactPhone || '',
              notes: point.notes || point.observation || '',
              observation: point.observation || point.notes || '',
              stopType: point.stopType || '',
              pointCategory: point.pointCategory || 'obra',
              operationType: point.operationType || 'entrega',
              recolhidoQty: point.recolhidoQty,
              autoRemoved: point.autoRemoved || false,
              sanitarioNumbers: point.sanitarioNumbers || [],
              sanitarioRecolhidos: point.sanitarioRecolhidos || [],
              type: index === 0 ? 'origin' : (index === points.length - 1 ? 'destination' : 'waypoint')
            }));
            
            const pointsWithTypes = recalculatePointTypes(convertedPoints);
            setAllPoints(pointsWithTypes);
            setRouteName('');
            
            if (copiedFromRoute) {
              setRouteDescription(`Baseada na rota: ${copiedFromRoute}`);
            }
            
            console.log('✅ [CREATE ROUTE] Pontos copiados carregados com todos os campos operacionais');
            toast.success(`${points.length} ponto(s) carregado(s) da rota original!`);
            
            localStorage.removeItem('copiedRoutePoints');
            localStorage.removeItem('copiedFromRoute');
            return;
          }
        } catch (e) {
          console.error('Erro ao carregar pontos copiados:', e);
        }
      }
      
      // Tentar carregar do autosave
      const saved = loadFromStorage();
      if (saved && saved.points.length > 0) {
        // Usar confirm com mensagem mais clara
        const shouldRestore = window.confirm(
          `Encontramos um rascunho salvo:\n\n` +
          `📝 "${saved.routeName || 'Sem nome'}"\n` +
          `📍 ${saved.points.length} pontos\n\n` +
          `Clique OK para restaurar ou CANCELAR para descartar e criar nova rota.`
        );
        
        if (shouldRestore) {
          setRouteName(saved.routeName);
          setRouteDescription(saved.routeDescription);
          setOptimizationMode(saved.optimizationMode);
          setAllPoints(saved.points);
          if (saved.scrollPosition) {
            setTimeout(() => {
              window.scrollTo(0, saved.scrollPosition);
            }, 100);
          }
          toast.success('Rascunho restaurado!');
          return; // IMPORTANTE: sair após restaurar
        } else {
          // Usuário recusou - limpar rascunho e criar nova rota
          clearStorage();
          toast.info('Rascunho descartado. Criando nova rota.');
        }
      }
      
      // Inicializar com 2 pontos para nova rota
      const initialPoints: RoutePoint[] = [
        {
          id: generateUniqueId('origin'),
          address: '',
          lat: 0,
          lng: 0,
          order: 0,
          type: 'origin' as const,
          cep: '',
          observation: ''
        },
        {
          id: generateUniqueId('destination'),
          address: '',
          lat: 0,
          lng: 0,
          order: 1,
          type: 'destination' as const,
          cep: '',
          observation: ''
        }
      ];
      setAllPoints(initialPoints);
    }
  }, [isEditing, editId, routes, searchParams]);

  // AutoSave
  useEffect(() => {
    if (routeName || allPoints.length > 0) {
      const scrollPosition = window.scrollY;
      scheduleAutoSave({
        routeName,
        routeDescription,
        optimizationMode,
        points: allPoints,
        scrollPosition
      });
      setLastSaveTime(new Date());
    }
  }, [routeName, routeDescription, optimizationMode, allPoints]);

  const addPoint = () => {
    const newPoint: RoutePoint = {
      id: generateUniqueId('new'),
      address: '',
      lat: 0,
      lng: 0,
      order: allPoints.length,
      type: 'waypoint',
      cep: '',
      observation: ''
    };
    
    const updatedPoints = recalculatePointTypes([...allPoints, newPoint]);
    setAllPoints(updatedPoints);
  };

  // Picker de sanitários alocados
  const [sanPickerOpen, setSanPickerOpen] = useState(false);
  const addPointFromSanitario = (s: AllocatedSanitario) => {
    const newPoint: RoutePoint = {
      id: generateUniqueId('san'),
      address: s.current_address || '',
      lat: s.current_lat || 0,
      lng: s.current_lng || 0,
      order: allPoints.length,
      type: 'waypoint',
      cep: '',
      observation: '',
      customerName: s.current_customer_name || '',
      operationType: 'recolhimento',
      sanitarioRecolhidos: [s.numero],
    } as any;
    setAllPoints(recalculatePointTypes([...allPoints, newPoint]));
    toast.success(`Sanitário ${s.numero} adicionado à rota (recolhimento)`);
  };

  const removePoint = (id: string) => {
    if (allPoints.length <= 2) {
      toast.error('É necessário pelo menos 2 pontos (origem e destino)');
      return;
    }
    
    const filteredPoints = allPoints.filter(p => p.id !== id);
    const reorderedPoints = recalculatePointTypes(filteredPoints);
    setAllPoints(reorderedPoints);
  };

  const updatePoint = (id: string, field: keyof RoutePoint, value: any) => {
    setAllPoints(prev => prev.map(point => 
      point.id === id ? { ...point, [field]: value } : point
    ));

    if (field === 'cep' && typeof value === 'string') {
      const cleanCep = value.replace(/\D/g, '');
      if (cleanCep.length === 8) {
        searchAddressByCep(id, cleanCep);
      }
    }
  };

  const reorderPoints = (newPoints: RoutePoint[]) => {
    const reorderedPoints = recalculatePointTypes(newPoints);
    setAllPoints(reorderedPoints);
  };

  const searchAddressByCep = async (pointId: string, cep: string) => {
    if (!pointId || !cep || cep.length < 8) return;

    try {
      setSearchingAddress(-1);
      const addressData = await getAddressByCep(cep);
      
      setAllPoints(prev => prev.map(point => 
        point.id === pointId 
          ? { 
              ...point, 
              cep: cep,
              address: addressData.address,
              lat: addressData.lat,
              lng: addressData.lng
            }
          : point
      ));
      
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('❌ Erro ao buscar CEP:', error);
      toast.error('CEP não encontrado');
    } finally {
      setSearchingAddress(null);
    }
  };

  const searchAddressByText = async (pointId: string, address: string) => {
    if (!pointId || !address || address.length < 5) return;

    try {
      setSearchingAddress(-1);
      
      // Garantir que o Google Maps está inicializado
      await googleMapsService.initialize();
      
      if (!window.google || !window.google.maps) {
        toast.error('Erro ao carregar Google Maps. Tente novamente.');
        return;
      }

      const geocoder = new window.google.maps.Geocoder();
      const results = await new Promise<any>((resolve, reject) => {
        geocoder.geocode({ address: address }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            resolve(results[0]);
          } else {
            reject(new Error('Endereço não encontrado'));
          }
        });
      });

      const location = results.geometry.location;
      const formattedAddress = results.formatted_address;

      setAllPoints(prev => prev.map(point => 
        point.id === pointId 
          ? { 
              ...point, 
              address: formattedAddress,
              lat: location.lat(),
              lng: location.lng()
            }
          : point
      ));
      
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('❌ Erro ao buscar endereço:', error);
      toast.error('Endereço não encontrado');
    } finally {
      setSearchingAddress(null);
    }
  };

  const duplicatePoint = (id: string) => {
    const pointToDuplicate = allPoints.find(p => p.id === id);
    if (!pointToDuplicate) return;

    const newPoint: RoutePoint = {
      ...pointToDuplicate,
      id: generateUniqueId('duplicate'),
      order: allPoints.length,
      observation: pointToDuplicate.observation || ''
    };

    const updatedPoints = recalculatePointTypes([...allPoints, newPoint]);
    setAllPoints(updatedPoints);
    toast.success('Ponto duplicado!');
  };

  const clearIntermediatePoints = () => {
    if (allPoints.length <= 2) {
      toast.error('Não há pontos intermediários para limpar');
      return;
    }

    const confirmed = window.confirm('Deseja remover todos os pontos intermediários?');
    if (!confirmed) return;

    const origin = allPoints[0];
    const destination = allPoints[allPoints.length - 1];
    const newPoints = recalculatePointTypes([origin, destination]);
    setAllPoints(newPoints);
    toast.success('Pontos intermediários removidos!');
  };

  const calculateSimpleDistance = (points: RoutePoint[]): number => {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const R = 6371;
      const dLat = (points[i+1].lat - points[i].lat) * Math.PI / 180;
      const dLng = (points[i+1].lng - points[i].lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(points[i].lat * Math.PI / 180) * Math.cos(points[i+1].lat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      total += R * c;
    }
    return total;
  };

  const generatePreview = async () => {
    try {
      setLoading(true);

      const pointsWithCorrectTypes = recalculatePointTypes(allPoints);
      
      const validPoints = pointsWithCorrectTypes.filter(p => {
        const isValid = p.lat && p.lng && p.address && 
                       typeof p.lat === 'number' && typeof p.lng === 'number' &&
                       p.lat !== 0 && p.lng !== 0;
        return isValid;
      });

      if (validPoints.length < 2) {
        toast.error('É necessário pelo menos 2 pontos válidos (origem e destino)');
        return;
      }

      let finalPoints;
      let totalDistance = 0;
      let estimatedTime = '0min';
      
      if (optimizationMode === 'fixed') {
        console.log('🔒 [PREVIEW] Modo FIXO');
        finalPoints = validPoints;
        totalDistance = calculateSimpleDistance(validPoints);
        estimatedTime = `${Math.round(totalDistance * 60 / 50)} min`;
      } else {
        console.log('🔄 [PREVIEW] Modo OTIMIZADO');
        const optimizedData = await optimizeRoute(validPoints, isEditing ? editId : undefined);
        finalPoints = optimizedData.points;
        totalDistance = optimizedData.totalDistance;
        estimatedTime = optimizedData.estimatedTime;
      }

      const preview = {
        name: routeName,
        description: routeDescription,
        points: finalPoints.map((processedPoint: RoutePoint) => {
          const original = allPoints.find(p => p.id === processedPoint.id);
          return {
            ...processedPoint,
            cep: processedPoint.cep || original?.cep || '',
            completed: original?.completed ?? false,
            completedAt: original?.completedAt ?? null,
            customerName: processedPoint.customerName || original?.customerName || '',
            restroomsQty: processedPoint.restroomsQty ?? original?.restroomsQty,
            cleaningsQty: processedPoint.cleaningsQty ?? original?.cleaningsQty,
            contactName: processedPoint.contactName || original?.contactName || '',
            contactPhone: processedPoint.contactPhone || original?.contactPhone || '',
            notes: processedPoint.notes || processedPoint.observation || original?.notes || original?.observation || '',
            observation: processedPoint.notes || processedPoint.observation || original?.notes || original?.observation || '',
            stopType: processedPoint.stopType || original?.stopType || '',
            pointCategory: processedPoint.pointCategory || original?.pointCategory || 'obra',
            operationType: processedPoint.operationType || original?.operationType || 'entrega',
            recolhidoQty: processedPoint.recolhidoQty ?? original?.recolhidoQty,
            autoRemoved: processedPoint.autoRemoved ?? original?.autoRemoved ?? false,
            sanitarioNumbers: processedPoint.sanitarioNumbers || original?.sanitarioNumbers || [],
            sanitarioRecolhidos: processedPoint.sanitarioRecolhidos || original?.sanitarioRecolhidos || []
          };
        }),
        totalDistance: totalDistance,
        estimatedTime: estimatedTime,
        optimizedOrder: finalPoints.map((p: any) => p.id),
        optimizationMode: optimizationMode,
        status: 'active'
      };
      
      console.log('📋 [CREATE ROUTE] Preview gerado com campos operacionais:', preview.points.length);

      setPreviewData(preview);
      setShowPreview(true);
    } catch (error) {
      console.error('❌ Erro ao gerar preview:', error);
      toast.error('Erro ao gerar preview da rota');
    } finally {
      setLoading(false);
    }
  };

  // Validação rigorosa dos pontos antes de salvar
  const validatePoints = (points: any[]): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!points || points.length < 2) {
      errors.push('É necessário pelo menos 2 pontos (origem e destino)');
      return { valid: false, errors };
    }

    points.forEach((point, index) => {
      const pointLabel = index === 0 ? 'Origem' : (index === points.length - 1 ? 'Destino' : `Parada ${index}`);
      const hasCoords = point.lat && point.lng && point.lat !== 0 && point.lng !== 0;
      const addr = (point.address || '').trim();

      // Coordenadas: obrigatórias
      if (!hasCoords) {
        errors.push(`${pointLabel}: Busque o endereço para obter as coordenadas`);
      }

      // Endereço: aceita qualquer coisa não-vazia se já tiver coordenadas válidas
      // (rotas salvas podem ter address curto vindo de geocoding reverso)
      if (!addr) {
        errors.push(`${pointLabel}: Endereço vazio`);
      } else if (!hasCoords && addr.length < 5) {
        errors.push(`${pointLabel}: Endereço inválido ou muito curto`);
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const handleSave = async () => {
    // Validação do nome
    if (!routeName.trim()) {
      toast.error('Digite um nome para a rota');
      return;
    }

    // Validação do preview
    if (!previewData) {
      toast.error('Gere o preview antes de salvar');
      return;
    }

    // Validação rigorosa dos pontos
    const validation = validatePoints(previewData.points);
    if (!validation.valid) {
      validation.errors.forEach((error, index) => {
        setTimeout(() => toast.error(error), index * 500);
      });
      return;
    }

    try {
      setLoading(true);
      
      // Mapear pontos garantindo todos os campos
      const routeData = {
        name: routeName.trim(),
        description: routeDescription.trim(),
        points: previewData.points.map((p: any, index: number) => ({
          id: p.id,
          order: index,
          type: index === 0 ? 'origin' : (index === previewData.points.length - 1 ? 'destination' : 'waypoint'),
          address: p.address || '',
          lat: parseFloat(p.lat) || 0,
          lng: parseFloat(p.lng) || 0,
          cep: p.cep || '',
          customerName: p.customerName || '',
          restroomsQty: p.restroomsQty !== undefined && p.restroomsQty !== '' ? parseInt(p.restroomsQty) : null,
          cleaningsQty: p.cleaningsQty !== undefined && p.cleaningsQty !== '' ? parseInt(p.cleaningsQty) : null,
          contactName: p.contactName || '',
          contactPhone: p.contactPhone || '',
          notes: p.notes || p.observation || '',
          observation: p.notes || p.observation || '',
          stopType: p.stopType || '',
          pointCategory: p.pointCategory || 'obra',
          operationType: p.operationType || 'entrega',
          recolhidoQty: p.recolhidoQty ?? null,
          autoRemoved: p.autoRemoved ?? false,
          sanitarioNumbers: Array.isArray(p.sanitarioNumbers) ? p.sanitarioNumbers : [],
          sanitarioRecolhidos: Array.isArray(p.sanitarioRecolhidos) ? p.sanitarioRecolhidos : [],
          completed: p.completed || false,
          completedAt: p.completedAt || null
        })),
        totalDistance: previewData.totalDistance || 0,
        estimatedTime: previewData.estimatedTime || '0min',
        optimizedOrder: previewData.optimizedOrder || [],
        optimizationMode: optimizationMode,
        status: 'active' as const
      };

      console.log('📤 [CREATE ROUTE] Salvando rota:', routeData.name);
      console.log('📤 [CREATE ROUTE] Pontos:', routeData.points.length);

      if (isEditing) {
        await updateRoute({ id: editId!, route: routeData });
        toast.success('Rota atualizada com sucesso!');
      } else {
        await createRoute(routeData);
        toast.success('Rota criada com sucesso!');
      }
      
      clearStorage();
      navigate('/routes');
    } catch (error: any) {
      console.error('❌ Erro ao salvar:', error);
      
      // Mostrar erro específico do backend se disponível
      const errorMessage = error?.message || 'Erro ao salvar rota. Tente novamente.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex flex-col">
      {/* Header Fixo Compacto */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/routes')}
                className="hover:bg-slate-100 h-8"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {isEditing ? 'Editar Rota' : 'Nova Rota'}
                </h1>
              </div>
              {lastSaveTime && (
                <Badge variant="outline" className="text-xs text-slate-500 bg-slate-50">
                  <Clock className="h-3 w-3 mr-1" />
                  Salvo às {lastSaveTime.toLocaleTimeString()}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Toggle Configurações */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className={`h-8 ${showSettings ? 'bg-slate-100' : ''}`}
              >
                <Settings2 className="h-4 w-4 mr-1" />
                Config
                {showSettings ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
              </Button>
              
              {/* Toggle Mapa */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMap(!showMap)}
                className={`h-8 ${showMap ? 'bg-blue-50 text-blue-600' : ''}`}
              >
                <Map className="h-4 w-4 mr-1" />
                Mapa
                {showMap ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
              </Button>

              <div className="h-6 w-px bg-slate-200" />

              {allPoints.length > 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearIntermediatePoints}
                  className="text-orange-600 hover:bg-orange-50 h-8 text-xs"
                >
                  <Eraser className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              )}
              
              <Button
                onClick={() => {
                  if (!routeName.trim()) {
                    toast.error('Digite um nome para a rota antes de gerar o preview');
                    return;
                  }
                  if (allPoints.length < 2) {
                    toast.error('É necessário pelo menos 2 pontos');
                    return;
                  }
                  generatePreview();
                }}
                disabled={loading}
                variant="outline"
                size="sm"
                className="h-8 border-blue-200 hover:bg-blue-50"
                title={!routeName.trim() ? 'Digite o nome da rota primeiro' : 'Gerar preview da rota'}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              
              <Button
                onClick={handleSave}
                disabled={loading || !previewData}
                size="sm"
                className="h-8 bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-1" />
                Salvar
              </Button>
            </div>
          </div>
        </div>

        {/* Painel de Configurações Colapsável */}
        <Collapsible open={showSettings}>
          <CollapsibleContent>
            <div className="px-4 py-3 bg-slate-50/80 border-t flex items-center gap-6 flex-wrap">
              {/* Nome da Rota */}
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[300px]">
                <Label className="text-xs font-medium text-slate-600 shrink-0">Nome:</Label>
                <Input
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="Nome da rota *"
                  className="h-8 text-sm"
                />
              </div>

              {/* Descrição */}
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[400px]">
                <Label className="text-xs font-medium text-slate-600 shrink-0">Descrição:</Label>
                <Input
                  value={routeDescription}
                  onChange={(e) => setRouteDescription(e.target.value)}
                  placeholder="Descrição (opcional)"
                  className="h-8 text-sm"
                />
              </div>

              {/* Modo */}
              <div className="flex items-center gap-3">
                <Label className="text-xs font-medium text-slate-600">Modo:</Label>
                <div className="flex bg-white rounded-lg border p-0.5">
                  <button
                    onClick={() => setOptimizationMode('fixed')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      optimizationMode === 'fixed' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🔒 Ordem Fixa
                  </button>
                  <button
                    onClick={() => setOptimizationMode('optimized')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      optimizationMode === 'optimized' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ✨ Otimizar
                  </button>
                </div>
              </div>

              {/* Estatísticas */}
              <div className="flex items-center gap-4 ml-auto">
                <Badge variant="outline" className="bg-white">
                  <MapPin className="h-3 w-3 mr-1" />
                  {allPoints.length} pontos
                </Badge>
                {previewData && (
                  <>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      📏 {previewData.totalDistance?.toFixed(1)} km
                    </Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      ⏱️ {previewData.estimatedTime}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </header>

      {/* Conteúdo Principal - Tela Inteira */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Tabela de Pontos - Ocupa toda a largura */}
        <main className={`flex-1 overflow-auto p-4 ${showMap ? 'lg:w-2/3' : 'w-full'}`}>
          {optimizationMode === 'fixed' && allPoints.length > 0 && (
            <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg inline-flex items-center gap-2 text-sm text-blue-700">
              <span className="font-medium">Modo Ordem Fixa:</span>
              <span>Arraste as linhas para reordenar os pontos</span>
            </div>
          )}

          <RoutePointsTable
            points={allPoints}
            onReorder={reorderPoints}
            onRemove={removePoint}
            onUpdate={updatePoint}
            onSearchByCep={searchAddressByCep}
            onSearchByAddress={searchAddressByText}
            onDuplicate={duplicatePoint}
            onAddPoint={addPoint}
            onAddFromSanitario={() => setSanPickerOpen(true)}
            isDraggable={optimizationMode === 'fixed'}
            searchingAddress={searchingAddress}
          />
          <SanitarioPickerModal
            open={sanPickerOpen}
            onOpenChange={setSanPickerOpen}
            onPick={addPointFromSanitario}
          />
        </main>

        {/* Painel do Mapa - Lateral */}
        {showMap && (
          <aside className="lg:w-1/3 border-l bg-white flex flex-col">
            <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                🗺️ Preview
              </h3>
              {previewData && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                  {previewData.points?.length || 0} pontos
                </Badge>
              )}
            </div>
            <div className="flex-1 min-h-[400px] lg:min-h-0">
              {showPreview && previewData ? (
                <RouteMapPreview route={previewData} />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50">
                  <div className="text-center p-6">
                    <MapPin className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-xs">Clique em "Preview" para visualizar</p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default CreateRoute;
