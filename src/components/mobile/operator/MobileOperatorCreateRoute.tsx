import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, MapPin, Save, Search, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRoutes, RoutePoint } from '@/hooks/useRoutes';
import { useRoutesCRUD } from '@/hooks/useRoutesCRUD';
import { useRouteAutoSave } from '@/hooks/useRouteAutoSave';
import { googleMapsService } from '@/services/googleMaps';
import { toast } from 'sonner';
import MobileOperatorHeader from './MobileOperatorHeader';
import MobileOperatorNav from './MobileOperatorNav';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const MobileOperatorCreateRoute = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [optimizationMode, setOptimizationMode] = useState<'fixed' | 'optimized'>('optimized');
  const [allPoints, setAllPoints] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPoint, setEditingPoint] = useState<RoutePoint | null>(null);
  const [searchingAddress, setSearchingAddress] = useState(false);

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
      
      return { ...point, type, order: index };
    });
  }, []);

  // Initialize Google Maps
  useEffect(() => {
    googleMapsService.initialize().catch(console.error);
  }, []);

  // Load route for editing
  useEffect(() => {
    if (isEditing && editId) {
      loadRoutes();
    }
  }, [isEditing, editId]);

  useEffect(() => {
    if (isEditing && editId && routes.length > 0) {
      const routeToEdit = routes.find(r => r.id === editId);
      if (routeToEdit) {
        setRouteName(routeToEdit.name || '');
        setRouteDescription(routeToEdit.description || '');
        setOptimizationMode(routeToEdit.optimizationMode || 'optimized');

        const points = routeToEdit.points || [];
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
          completed: point.completed || false,
          completedAt: point.completedAt || null
        }));

        const sortedPoints = [...pointsWithUniqueIds].sort((a: any, b: any) => a.order - b.order);
        setAllPoints(recalculatePointTypes(sortedPoints));
      }
    } else if (!isEditing) {
      // Check for copied points
      const fromCopy = searchParams.get('fromCopy');
      const copiedPoints = localStorage.getItem('copiedRoutePoints');
      
      if (fromCopy === 'true' && copiedPoints) {
        try {
          const points = JSON.parse(copiedPoints);
          if (points && points.length > 0) {
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
              type: 'waypoint' as const
            }));
            
            setAllPoints(recalculatePointTypes(convertedPoints));
            toast.success(`${points.length} ponto(s) carregado(s)!`);
            
            localStorage.removeItem('copiedRoutePoints');
            localStorage.removeItem('copiedFromRoute');
            return;
          }
        } catch (e) {
          console.error('Erro ao carregar pontos copiados:', e);
        }
      }
      
      // Try autosave
      const saved = loadFromStorage();
      if (saved && saved.points.length > 0) {
        const shouldRestore = window.confirm(`Restaurar rascunho "${saved.routeName || 'Sem nome'}" com ${saved.points.length} pontos?`);
        
        if (shouldRestore) {
          setRouteName(saved.routeName);
          setRouteDescription(saved.routeDescription);
          setOptimizationMode(saved.optimizationMode);
          setAllPoints(saved.points);
          toast.success('Rascunho restaurado!');
          return;
        } else {
          clearStorage();
        }
      }
      
      // Initialize with 2 points
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
      scheduleAutoSave({
        routeName,
        routeDescription,
        optimizationMode,
        points: allPoints,
        scrollPosition: 0
      });
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
    
    setAllPoints(recalculatePointTypes([...allPoints, newPoint]));
    setEditingPoint(newPoint);
  };

  const removePoint = (id: string) => {
    if (allPoints.length <= 2) {
      toast.error('Mínimo de 2 pontos necessários');
      return;
    }
    
    const filteredPoints = allPoints.filter(p => p.id !== id);
    setAllPoints(recalculatePointTypes(filteredPoints));
    setEditingPoint(null);
  };

  const updatePointField = (id: string, field: keyof RoutePoint, value: any) => {
    setAllPoints(prev => prev.map(point => 
      point.id === id ? { ...point, [field]: value } : point
    ));
    
    if (editingPoint?.id === id) {
      setEditingPoint(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  const searchAddressByCep = async (pointId: string, cep: string) => {
    if (!pointId || !cep || cep.length < 8) return;

    try {
      setSearchingAddress(true);
      const addressData = await getAddressByCep(cep);
      
      setAllPoints(prev => prev.map(point => 
        point.id === pointId 
          ? { ...point, cep, address: addressData.address, lat: addressData.lat, lng: addressData.lng }
          : point
      ));
      
      if (editingPoint?.id === pointId) {
        setEditingPoint(prev => prev ? { 
          ...prev, cep, address: addressData.address, lat: addressData.lat, lng: addressData.lng 
        } : null);
      }
      
      toast.success('Endereço encontrado!');
    } catch (error) {
      toast.error('CEP não encontrado');
    } finally {
      setSearchingAddress(false);
    }
  };

  const searchAddressByText = async (pointId: string, address: string) => {
    if (!pointId || !address || address.length < 5) return;

    try {
      setSearchingAddress(true);
      await googleMapsService.initialize();
      
      if (!window.google?.maps) {
        toast.error('Erro ao carregar Google Maps');
        return;
      }

      const geocoder = new window.google.maps.Geocoder();
      const results = await new Promise<any>((resolve, reject) => {
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
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
          ? { ...point, address: formattedAddress, lat: location.lat(), lng: location.lng() }
          : point
      ));
      
      if (editingPoint?.id === pointId) {
        setEditingPoint(prev => prev ? { 
          ...prev, address: formattedAddress, lat: location.lat(), lng: location.lng() 
        } : null);
      }
      
      toast.success('Endereço encontrado!');
    } catch (error) {
      toast.error('Endereço não encontrado');
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleSave = async () => {
    if (!routeName.trim()) {
      toast.error('Informe o nome da rota');
      return;
    }

    const validPoints = allPoints.filter(p => p.lat && p.lng && p.address);
    if (validPoints.length < 2) {
      toast.error('Mínimo de 2 pontos válidos');
      return;
    }

    try {
      setLoading(true);

      let finalPoints = validPoints;
      let totalDistance = 0;
      let estimatedTime = '0min';

      if (optimizationMode === 'optimized') {
        const optimizedData = await optimizeRoute(validPoints, isEditing ? editId : undefined);
        finalPoints = optimizedData.points;
        totalDistance = optimizedData.totalDistance;
        estimatedTime = optimizedData.estimatedTime;
      } else {
        // Simple distance calculation for fixed mode
        for (let i = 0; i < validPoints.length - 1; i++) {
          const R = 6371;
          const dLat = (validPoints[i+1].lat - validPoints[i].lat) * Math.PI / 180;
          const dLng = (validPoints[i+1].lng - validPoints[i].lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(validPoints[i].lat * Math.PI / 180) * Math.cos(validPoints[i+1].lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          totalDistance += R * c;
        }
        estimatedTime = `${Math.round(totalDistance * 60 / 50)} min`;
      }

      const mappedPoints = finalPoints.map((p, i) => ({
        ...p,
        order: i,
        type: (i === 0 ? 'origin' : i === finalPoints.length - 1 ? 'destination' : 'waypoint') as 'origin' | 'destination' | 'waypoint'
      }));

      const routeData = {
        name: routeName,
        description: routeDescription,
        points: mappedPoints,
        totalDistance,
        estimatedTime,
        optimizationMode,
        optimizedOrder: mappedPoints.map(p => p.id),
        status: 'active' as const
      };

      if (isEditing) {
        await updateRoute({ id: editId!, route: routeData });
        toast.success('Rota atualizada!');
      } else {
        await createRoute(routeData);
        toast.success('Rota criada!');
      }

      clearStorage();
      navigate('/routes');
    } catch (error) {
      console.error('Erro ao salvar rota:', error);
      toast.error('Erro ao salvar rota');
    } finally {
      setLoading(false);
    }
  };

  const getPointLabel = (index: number) => {
    if (index === 0) return 'Origem';
    if (index === allPoints.length - 1) return 'Destino';
    return `Ponto ${index}`;
  };

  const getPointColor = (index: number) => {
    if (index === 0) return 'bg-green-100 text-green-700 border-green-200';
    if (index === allPoints.length - 1) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MobileOperatorHeader 
        title={isEditing ? 'Editar Rota' : 'Nova Rota'} 
        showBack 
        onBack={() => navigate('/routes')}
      />

      <main className="flex-1 pt-14 pb-20 overflow-auto">
        <div className="p-4 space-y-4">
          {/* Route Info */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label className="text-sm font-medium">Nome da Rota *</Label>
                <Input
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="Ex: Rota Centro"
                  className="mt-1.5 h-12"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Descrição</Label>
                <Textarea
                  value={routeDescription}
                  onChange={(e) => setRouteDescription(e.target.value)}
                  placeholder="Descrição opcional"
                  className="mt-1.5 min-h-[80px]"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Modo de Otimização</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant={optimizationMode === 'optimized' ? 'default' : 'outline'}
                    className="flex-1 h-11"
                    onClick={() => setOptimizationMode('optimized')}
                  >
                    ✨ Otimizada
                  </Button>
                  <Button
                    type="button"
                    variant={optimizationMode === 'fixed' ? 'default' : 'outline'}
                    className="flex-1 h-11"
                    onClick={() => setOptimizationMode('fixed')}
                  >
                    🔒 Ordem Fixa
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Points List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                Pontos ({allPoints.length})
              </h3>
              <Button size="sm" onClick={addPoint} className="h-9">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-2">
              {allPoints.map((point, index) => (
                <Card 
                  key={point.id}
                  className="overflow-hidden"
                  onClick={() => setEditingPoint(point)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 border",
                        getPointColor(index)
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {getPointLabel(index)}
                          </Badge>
                          {point.lat && point.lng ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                              ✓ Validado
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                              Pendente
                            </Badge>
                          )}
                        </div>
                        <p className={cn(
                          "text-sm line-clamp-2",
                          point.address ? "text-gray-900" : "text-gray-400"
                        )}>
                          {point.address || 'Toque para definir endereço'}
                        </p>
                        {point.customerName && (
                          <p className="text-xs text-gray-500 mt-1">
                            {point.customerName}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Save Button */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t safe-area-bottom">
        <Button 
          className="w-full h-12 bg-blue-600 hover:bg-blue-700"
          onClick={handleSave}
          disabled={loading || !routeName.trim() || allPoints.filter(p => p.lat && p.lng).length < 2}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              {isEditing ? 'Salvar Alterações' : 'Criar Rota'}
            </>
          )}
        </Button>
      </div>

      

      {/* Point Edit Sheet */}
      <Sheet open={!!editingPoint} onOpenChange={(open) => !open && setEditingPoint(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              {editingPoint && getPointLabel(allPoints.findIndex(p => p.id === editingPoint.id))}
            </SheetTitle>
          </SheetHeader>

          {editingPoint && (
            <div className="py-4 space-y-4 overflow-auto max-h-[calc(85vh-8rem)]">
              {/* CEP Search */}
              <div>
                <Label className="text-sm font-medium">CEP</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={editingPoint.cep || ''}
                    onChange={(e) => updatePointField(editingPoint.id, 'cep', e.target.value.replace(/\D/g, ''))}
                    placeholder="00000000"
                    maxLength={8}
                    className="h-12"
                  />
                  <Button 
                    onClick={() => searchAddressByCep(editingPoint.id, editingPoint.cep || '')}
                    disabled={searchingAddress || !editingPoint.cep || editingPoint.cep.length < 8}
                    className="h-12 px-4"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Address */}
              <div>
                <Label className="text-sm font-medium">Endereço</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={editingPoint.address || ''}
                    onChange={(e) => updatePointField(editingPoint.id, 'address', e.target.value)}
                    placeholder="Digite o endereço completo"
                    className="h-12"
                  />
                  <Button 
                    onClick={() => searchAddressByText(editingPoint.id, editingPoint.address || '')}
                    disabled={searchingAddress || !editingPoint.address || editingPoint.address.length < 5}
                    className="h-12 px-4"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Coordinates Badge */}
              {editingPoint.lat && editingPoint.lng && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700 font-medium">✓ Coordenadas encontradas</p>
                  <p className="text-xs text-green-600 mt-1">
                    {editingPoint.lat.toFixed(6)}, {editingPoint.lng.toFixed(6)}
                  </p>
                </div>
              )}

              {/* Customer Info */}
              <Collapsible defaultOpen={!!editingPoint.customerName}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                  <span className="text-sm font-medium">Informações do Cliente</span>
                  <Badge variant="outline" className="text-xs">Opcional</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <div>
                    <Label className="text-sm">Nome do Cliente</Label>
                    <Input
                      value={editingPoint.customerName || ''}
                      onChange={(e) => updatePointField(editingPoint.id, 'customerName', e.target.value)}
                      placeholder="Nome do cliente"
                      className="h-11 mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Contato</Label>
                      <Input
                        value={editingPoint.contactName || ''}
                        onChange={(e) => updatePointField(editingPoint.id, 'contactName', e.target.value)}
                        placeholder="Nome"
                        className="h-11 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Telefone</Label>
                      <Input
                        value={editingPoint.contactPhone || ''}
                        onChange={(e) => updatePointField(editingPoint.id, 'contactPhone', e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="h-11 mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Qtd. Banheiros</Label>
                      <Input
                        type="number"
                        value={editingPoint.restroomsQty || ''}
                        onChange={(e) => updatePointField(editingPoint.id, 'restroomsQty', parseInt(e.target.value) || undefined)}
                        placeholder="0"
                        className="h-11 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Qtd. Limpezas</Label>
                      <Input
                        type="number"
                        value={editingPoint.cleaningsQty || ''}
                        onChange={(e) => updatePointField(editingPoint.id, 'cleaningsQty', parseInt(e.target.value) || undefined)}
                        placeholder="0"
                        className="h-11 mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Observações</Label>
                    <Textarea
                      value={editingPoint.observation || editingPoint.notes || ''}
                      onChange={(e) => {
                        updatePointField(editingPoint.id, 'observation', e.target.value);
                        updatePointField(editingPoint.id, 'notes', e.target.value);
                      }}
                      placeholder="Observações sobre este ponto"
                      className="min-h-[80px] mt-1"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Delete Button */}
              {allPoints.length > 2 && (
                <Button 
                  variant="outline" 
                  className="w-full h-12 text-red-600 hover:bg-red-50 border-red-200"
                  onClick={() => removePoint(editingPoint.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover Ponto
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MobileOperatorCreateRoute;
