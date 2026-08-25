import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, MapPin, Search } from "lucide-react";
import { useRoutes, RoutePoint } from '@/hooks/useRoutes';
import { useRoutesCRUD } from '@/hooks/useRoutesCRUD';
import RoutePreviewModal from './RoutePreviewModal';
import { toast } from 'sonner';

interface CreateRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRoute?: any;
  onSuccess: () => void;
}

const CreateRouteModal: React.FC<CreateRouteModalProps> = ({
  open,
  onOpenChange,
  editingRoute,
  onSuccess
}) => {
  const [step, setStep] = useState(1);
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [optimizationMode, setOptimizationMode] = useState<'fixed' | 'optimized'>('optimized');
  const [allPoints, setAllPoints] = useState<RoutePoint[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState<number | null>(null);

  const { getAddressByCep, optimizeRoute, createRoute } = useRoutes();
  const { updateRoute } = useRoutesCRUD();

  const isEditing = !!editingRoute?.id;

  // ✅ CONTADOR GLOBAL PARA IDs ÚNICOS (NUNCA RESETA)
  const pointIdCounter = useRef(0);

  // ✅ FUNÇÃO PARA GERAR IDs ÚNICOS ROBUSTOS
  const generateUniqueId = useCallback((prefix: string = 'point') => {
    pointIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${pointIdCounter.current}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // ✅ FUNÇÃO PARA RECALCULAR TIPOS BASEADO NA POSIÇÃO
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

  useEffect(() => {
    if (editingRoute && open) {
      console.log('🔄 [CREATE MODAL] ========================================');
      console.log('🔄 [CREATE MODAL] CARREGANDO ROTA PARA EDIÇÃO');
      console.log('🔄 [CREATE MODAL] Rota ID:', editingRoute.id);
      console.log('🔄 [CREATE MODAL] Pontos originais:', editingRoute.points?.length || 0);
      
      setRouteName(editingRoute.name || '');
      setRouteDescription(editingRoute.description || '');
      setOptimizationMode(editingRoute.optimizationMode || 'optimized');
      
      const points = editingRoute.points || [];
      
      // ✅ GARANTIR QUE CADA PONTO TENHA UM ID ÚNICO
      const pointsWithUniqueIds = points.map((point: any, index: number) => {
        const uniqueId = point.id || generateUniqueId(`existing-${index}`);
        
        return {
          id: uniqueId,
          order: index,
          cep: point.cep || '', // ✅ CARREGAR CEP DO BANCO
          address: point.address || '',
          lat: point.lat || 0,
          lng: point.lng || 0,
          type: point.type
        };
      });
      
      console.log('🔄 [LOAD] Pontos carregados do banco:', pointsWithUniqueIds.map(p => ({
        id: p.id,
        address: p.address?.substring(0, 30),
        cep: p.cep || '❌ SEM CEP'
      })));
      
      // ✅ CRIAR NOVA CÓPIA DO ARRAY E ORDENAR
      const sortedPoints = [...pointsWithUniqueIds].sort((a: any, b: any) => a.order - b.order);
      
      // ✅ RECALCULAR TIPOS APÓS CARREGAR
      const pointsWithCorrectTypes = recalculatePointTypes(sortedPoints);
      
      console.log('✅ [CREATE MODAL] IDs únicos confirmados:', pointsWithCorrectTypes.map(p => ({ 
        id: p.id,
        order: p.order,
        type: p.type,
        address: p.address?.substring(0, 30) + '...' 
      })));
      
      setAllPoints(pointsWithCorrectTypes);
      setStep(2);
      
      console.log('🔄 [CREATE MODAL] ========================================');
    } else if (open && !editingRoute) {
      console.log('🆕 [CREATE MODAL] Iniciando nova rota');
      resetForm();
    }
  }, [editingRoute, open]);

  const resetForm = () => {
    setStep(1);
    setRouteName('');
    setRouteDescription('');
    setOptimizationMode('optimized');
    setAllPoints([]);
    setPreviewData(null);
    setShowPreview(false);
    setLoading(false);
    setSearchingAddress(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      resetForm();
    }, 300);
  };

  const nextStep = () => {
    if (step === 1 && routeName.trim()) {
      setStep(2);
      // Inicializar com 2 pontos mínimos se não existirem
      if (allPoints.length === 0) {
        addPoint();
        addPoint();
      }
    }
  };

  const addPoint = () => {
    const newPoint: RoutePoint = {
      id: generateUniqueId('new'),
      address: '',
      lat: 0,
      lng: 0,
      order: allPoints.length,
      type: 'waypoint', // Temporário, será recalculado
      cep: '' // ✅ INICIALIZAR EXPLICITAMENTE
    };
    
    console.log('➕ [ADD POINT] Novo ponto criado:', newPoint);
    
    // ✅ RECALCULAR TIPOS APÓS ADICIONAR
    const updatedPoints = recalculatePointTypes([...allPoints, newPoint]);
    
    console.log('🔄 [ADD POINT] Tipos recalculados:', updatedPoints.map(p => ({
      id: p.id,
      order: p.order,
      type: p.type
    })));
    
    setAllPoints(updatedPoints);
  };

  const removePoint = (id: string) => {
    if (allPoints.length <= 2) {
      toast.error('É necessário pelo menos 2 pontos (origem e destino)');
      return;
    }
    
    console.log(`🗑️ [REMOVE POINT] Removendo ponto: ${id}`);
    
    const filteredPoints = allPoints.filter(p => p.id !== id);
    
    // ✅ RECALCULAR TIPOS E ORDEM APÓS REMOVER
    const reorderedPoints = recalculatePointTypes(filteredPoints);
    
    console.log('🔄 [REMOVE POINT] Tipos recalculados:', reorderedPoints.map(p => ({
      id: p.id,
      order: p.order,
      type: p.type
    })));
    
    setAllPoints(reorderedPoints);
  };

  const searchAddressByCep = async (pointId: string, cep: string) => {
    // ✅ GUARD CLAUSE: Verificar se pointId é válido
    if (!pointId || !cep || cep.length < 8) {
      console.warn('⚠️ [CREATE MODAL] searchAddressByCep: pointId ou CEP inválido', { pointId, cep });
      return;
    }

    try {
      console.log(`🔍 [CREATE MODAL] Buscando CEP ${cep} para ponto ${pointId}`);
      setSearchingAddress(-1);
      const addressData = await getAddressByCep(cep);
      
      // ✅ CRIAR NOVO ARRAY COM OBJETOS INDEPENDENTES
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
      
      console.log(`✅ [CREATE MODAL] CEP encontrado para ponto ${pointId}:`, addressData.address);
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('❌ [CREATE MODAL] Error searching address by CEP:', error);
      toast.error('CEP não encontrado');
    } finally {
      setSearchingAddress(null);
    }
  };

  const searchAddressByText = async (pointId: string, address: string) => {
    // ✅ GUARD CLAUSE: Verificar se pointId é válido
    if (!pointId || !address || address.length < 5) {
      console.warn('⚠️ [CREATE MODAL] searchAddressByText: pointId ou endereço inválido', { pointId, address });
      return;
    }

    try {
      console.log(`🔍 [CREATE MODAL] Buscando endereço '${address}' para ponto ${pointId}`);
      setSearchingAddress(-1);
      
      if (!window.google || !window.google.maps) {
        toast.error('Google Maps não está disponível');
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

      // ✅ CRIAR NOVO ARRAY COM OBJETOS INDEPENDENTES
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
      
      console.log(`✅ [CREATE MODAL] Endereço encontrado para ponto ${pointId}:`, formattedAddress);
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('❌ [CREATE MODAL] Error searching address:', error);
      toast.error('Endereço não encontrado');
    } finally {
      setSearchingAddress(null);
    }
  };

  const updatePointAddress = (pointId: string, address: string) => {
    // ✅ GUARD CLAUSE: Verificar se pointId é válido
    if (!pointId) {
      console.warn('⚠️ [CREATE MODAL] updatePointAddress: pointId inválido', { pointId, address });
      return;
    }

    console.log(`📝 [CREATE MODAL] Atualizando endereço do ponto ${pointId}:`, address);
    
    // ✅ CRIAR NOVO ARRAY COM OBJETOS INDEPENDENTES
    setAllPoints(prev => prev.map(point => 
      point.id === pointId ? { ...point, address } : point
    ));
  };

  const updatePointCep = async (pointId: string, cep: string) => {
    if (!pointId) {
      console.error('❌ updatePointCep: pointId é undefined!');
      return;
    }
    
    console.log(`📝 [CEP UPDATE] Atualizando CEP APENAS do ponto ${pointId}: "${cep}"`);
    
    const cleanCep = cep.replace(/\D/g, '');
    
    setAllPoints(prev => {
      // ✅ CRIAR CÓPIA PROFUNDA DE CADA PONTO
      const updated = prev.map(point => {
        if (point.id === pointId) {
          console.log(`✅ [CEP UPDATE] Ponto encontrado: ${point.id}`);
          // ✅ RETORNAR NOVO OBJETO COMPLETAMENTE ISOLADO
          return {
            id: point.id,
            address: point.address,
            lat: point.lat,
            lng: point.lng,
            order: point.order,
            type: point.type,
            cep: cleanCep // ✅ ATUALIZAR APENAS ESTE
          };
        }
        // ✅ RETORNAR CÓPIA DO PONTO ORIGINAL
        return { ...point };
      });
      
      console.log('📊 [CEP UPDATE] Estado atualizado:', updated.map(p => ({ 
        id: p.id, 
        cep: p.cep 
      })));
      
      return updated;
    });

    if (cleanCep.length === 8) {
      await searchAddressByCep(pointId, cleanCep);
    }
  };

  const generatePreview = async () => {
    try {
      setLoading(true);

      console.log('🎬 [PREVIEW] ========================================');
      console.log('🎬 [PREVIEW] INICIANDO GERAÇÃO DE PREVIEW');
      console.log('📊 [PREVIEW] Total de pontos:', allPoints.length);
      
      // ✅ RECALCULAR TIPOS ANTES DA OTIMIZAÇÃO
      const pointsWithCorrectTypes = recalculatePointTypes(allPoints);
      
      console.log('🎬 [PREVIEW] Pontos antes da otimização:');
      pointsWithCorrectTypes.forEach((p, i) => {
        console.log(`  ${i}. [${p.type}] ${p.address?.substring(0, 40)} (${p.lat}, ${p.lng})`);
      });
      
      // ✅ VALIDAÇÃO DETALHADA DE CADA PONTO
      const validPoints = pointsWithCorrectTypes.filter(p => {
        const isValid = p.lat && p.lng && p.address && 
                       typeof p.lat === 'number' && typeof p.lng === 'number' &&
                       p.lat !== 0 && p.lng !== 0;
        
        if (!isValid) {
          console.warn('⚠️ [PREVIEW] Ponto inválido filtrado:', {
            id: p.id,
            type: p.type,
            address: p.address,
            lat: p.lat,
            lng: p.lng,
            reason: !p.lat ? 'sem lat' : !p.lng ? 'sem lng' : !p.address ? 'sem endereço' : 
                   p.lat === 0 ? 'lat = 0' : p.lng === 0 ? 'lng = 0' : 'tipo inválido'
          });
        }
        
        return isValid;
      });
      
      console.log(`✅ [PREVIEW] Pontos válidos: ${validPoints.length} de ${pointsWithCorrectTypes.length}`);

      if (validPoints.length < 2) {
        toast.error('É necessário pelo menos 2 pontos válidos (origem e destino)');
        console.error('❌ [PREVIEW] Menos de 2 pontos válidos!');
        return;
      }

      // ✅ SE FOR MODO FIXO, NÃO OTIMIZAR
      let finalPoints;
      let totalDistance = 0;
      let estimatedTime = '0min';
      
      if (optimizationMode === 'fixed') {
        console.log('🔒 [PREVIEW] Modo FIXO - mantendo ordem original');
        finalPoints = validPoints;
        // Calcular distância sem otimizar
        totalDistance = calculateSimpleDistance(validPoints);
        estimatedTime = `${Math.round(totalDistance * 60 / 50)} min`; // Estimativa simples (50 km/h)
      } else {
        console.log('🔄 [PREVIEW] Modo OTIMIZADO - usando Google Maps');
        const optimizedData = await optimizeRoute(validPoints, isEditing ? editingRoute?.id : undefined);
        finalPoints = optimizedData.points;
        totalDistance = optimizedData.totalDistance;
        estimatedTime = optimizedData.estimatedTime;
      }
      
      console.log('✅ [CREATE MODAL] Processamento completo:', {
        mode: optimizationMode,
        totalPoints: finalPoints.length,
        distance: totalDistance,
        time: estimatedTime
      });

      // ✅ VALIDAR PONTOS PROCESSADOS
      finalPoints.forEach((p: any, i: number) => {
        console.log(`📍 [CREATE MODAL] Ponto processado ${i}:`, {
          order: p.order,
          address: p.address?.substring(0, 30) + '...',
          lat: p.lat,
          lng: p.lng
        });
      });

      const preview = {
        name: routeName,
        description: routeDescription,
        points: finalPoints.map((processedPoint: RoutePoint) => {
          const original = allPoints.find(p => p.id === processedPoint.id);
          return {
            ...processedPoint,
            cep: processedPoint.cep || original?.cep || '', // ✅ GARANTIR QUE CEP VAI PARA O PREVIEW
            completed: original?.completed ?? false,
            completedAt: original?.completedAt ?? null,
          };
        }),
        totalDistance: totalDistance,
        estimatedTime: estimatedTime,
        optimizedOrder: finalPoints.map((p: any) => p.id),
        optimizationMode: optimizationMode, // ✅ INCLUIR MODO
        status: 'active'
      };

      console.log('✅ Preview gerado com sucesso');
      setPreviewData(preview);
      setShowPreview(true);
    } catch (error) {
      console.error('❌ [CREATE MODAL] Error generating preview:', error);
      toast.error('Erro ao gerar preview da rota');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!previewData) {
      toast.error('Nenhum preview disponível');
      return;
    }

    // ✅ VALIDAR DADOS ANTES DE SALVAR
    const validPoints = previewData.points?.filter((p: any) => p.lat && p.lng && p.address);
    if (!validPoints || validPoints.length < 2) {
      toast.error('É necessário pelo menos 2 pontos válidos');
      return;
    }

    try {
      setLoading(true);
      
      console.log('💾 [CREATE MODAL] Salvando rota...', { isEditing, routeId: editingRoute?.id });
      
      if (isEditing && editingRoute?.id) {
        const result = await updateRoute({ id: editingRoute.id, route: previewData });
        console.log('✅ [CREATE MODAL] Rota atualizada:', result);
        toast.success('Rota atualizada com sucesso!');
      } else {
        const result = await createRoute(previewData);
        console.log('✅ [CREATE MODAL] Rota criada:', result);
        toast.success('Rota criada com sucesso!');
      }
      
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('❌ [CREATE MODAL] Error saving route:', error);
      toast.error(error.message || 'Erro ao salvar rota. Tente novamente.');
      // ❌ NÃO chamar onSuccess() ou handleClose() quando houver erro
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEdit = () => {
    setShowPreview(false);
    setPreviewData(null);
  };

  const getPointLabel = (index: number) => {
    if (index === 0) return { label: 'Origem', color: 'bg-green-500', textColor: 'text-green-700' };
    if (index === allPoints.length - 1) return { label: 'Destino', color: 'bg-red-500', textColor: 'text-red-700' };
    return { label: `Ponto ${index}`, color: 'bg-blue-500', textColor: 'text-blue-700' };
  };

  // ✅ FUNÇÃO AUXILIAR PARA CALCULAR DISTÂNCIA SIMPLES (SEM OTIMIZAÇÃO)
  const calculateSimpleDistance = (points: RoutePoint[]): number => {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const R = 6371; // Raio da Terra em km
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

  return (
    <>
      <Dialog open={open && !showPreview} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Rota' : 'Nova Rota'} - Passo {step} de 2
            </DialogTitle>
          </DialogHeader>
          
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="routeName">Nome da Rota *</Label>
                <Input
                  id="routeName"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="Ex: Rota Centro - Zona Sul"
                />
              </div>
              
              <div>
                <Label htmlFor="routeDescription">Descrição (opcional)</Label>
                <Textarea
                  id="routeDescription"
                  value={routeDescription}
                  onChange={(e) => setRouteDescription(e.target.value)}
                  placeholder="Descreva a rota..."
                  rows={3}
                />
              </div>
              
              {/* ✅ SELETOR DE MODO DE OTIMIZAÇÃO */}
              <div className="space-y-2">
                <Label>Modo de Criação da Rota</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Card 
                    className={`cursor-pointer transition-all ${
                      optimizationMode === 'fixed' 
                        ? 'border-primary border-2 bg-primary/5' 
                        : 'border-border hover:border-border/80'
                    }`}
                    onClick={() => setOptimizationMode('fixed')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          optimizationMode === 'fixed' ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                        }`}>
                          {optimizationMode === 'fixed' && (
                            <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm">Ordem Fixa</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Os pontos serão mantidos na ordem exata que você cadastrar
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all ${
                      optimizationMode === 'optimized' 
                        ? 'border-primary border-2 bg-primary/5' 
                        : 'border-border hover:border-border/80'
                    }`}
                    onClick={() => setOptimizationMode('optimized')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          optimizationMode === 'optimized' ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                        }`}>
                          {optimizationMode === 'optimized' && (
                            <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm">Otimizar Rota</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Os pontos intermediários serão reorganizados para a melhor sequência
                      </p>
                    </CardContent>
                  </Card>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {optimizationMode === 'fixed' 
                    ? '⚠️ A origem e destino serão respeitados, mas os pontos intermediários NÃO serão otimizados'
                    : '✅ A origem e destino serão respeitados, e os pontos intermediários serão otimizados pelo Google Maps'
                  }
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={nextStep} disabled={!routeName.trim()}>
                  Próximo
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Pontos da Rota</h3>
                  <Button onClick={addPoint} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Ponto
                  </Button>
                </div>
                
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                  <strong>Como funciona:</strong> O primeiro ponto será a origem, o último será o destino. 
                  Os pontos intermediários serão otimizados automaticamente para a melhor rota.
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {allPoints.map((point, index) => {
                    const pointInfo = getPointLabel(index);
                    return (
                      <Card key={`${point.id}-${index}`} className="border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full ${pointInfo.color} flex items-center justify-center text-white text-sm font-medium`}>
                              {index + 1}
                            </div>
                            
                            <div className="flex-1 space-y-3">
                              <h4 className={`font-medium ${pointInfo.textColor}`}>{pointInfo.label}</h4>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label>CEP (opcional)</Label>
                                  <Input
                                    key={`cep-${point.id}-${index}`}
                                    value={point.cep || ''}
                                    onChange={(e) => {
                                      console.log(`⌨️ [INPUT] Digitando no ponto ${point.id}: "${e.target.value}"`);
                                      updatePointCep(point.id, e.target.value);
                                    }}
                                    placeholder="00000-000"
                                    maxLength={9}
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <Label>Endereço *</Label>
                                <div className="flex gap-2">
                                  <Input
                                    key={`address-${point.id}`}
                                    value={point.address}
                                    onChange={(e) => updatePointAddress(point.id, e.target.value)}
                                    placeholder="Digite o endereço completo..."
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => searchAddressByText(point.id, point.address)}
                                    disabled={!point.address || searchingAddress === -1}
                                  >
                                    <Search className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              {point.lat && point.lng && (
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                  <MapPin className="h-4 w-4" />
                                  Localização confirmada
                                </div>
                              )}
                            </div>
                            
                            {allPoints.length > 2 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removePoint(point.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex justify-between gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={generatePreview}
                    disabled={loading || allPoints.filter(p => p.lat && p.lng).length < 2}
                  >
                    {loading ? 'Gerando...' : 'Gerar Preview'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <RoutePreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        previewData={previewData}
        onSave={handleSave}
        onBack={handleBackToEdit}
        loading={loading}
        isEditing={isEditing}
      />
    </>
  );
};

export default CreateRouteModal;
