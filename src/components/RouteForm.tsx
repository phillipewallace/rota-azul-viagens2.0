import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useRoutes, RoutePoint, Route } from '@/hooks/useRoutes';

// Define o schema de validação com Zod
const routeSchema = z.object({
  name: z.string().min(1, 'O nome da rota é obrigatório'),
  description: z.string().optional(),
  points: z.array(z.object({
    address: z.string().min(1, 'O endereço é obrigatório'),
    cep: z.string().optional(),
    lat: z.number(),
    lng: z.number(),
    order: z.number(),
    type: z.enum(['origin', 'destination', 'waypoint']),
    completed: z.boolean(),
    completedAt: z.string().nullable(),
  })).min(2, 'É necessário pelo menos 2 pontos na rota'),
  totalDistance: z.number().optional(),
  estimatedTime: z.string().optional(),
  optimizedOrder: z.array(z.string()).optional(),
});

type RouteFormData = z.infer<typeof routeSchema>;

// Define a interface para as propriedades do componente
interface RouteFormProps {
  onSubmit: () => void;
  editingRoute?: Route;
  onCancel?: () => void;
}

// ✅ NOVA FUNÇÃO: Deep clone para garantir objetos independentes
const deepClonePoints = (points: RoutePoint[]): RoutePoint[] => {
  return points.map((point, index) => ({
    id: `unique-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
    address: point.address || '',
    cep: point.cep || '',
    lat: point.lat || 0,
    lng: point.lng || 0,
    order: index,
    type: point.type || 'waypoint',
    completed: point.completed ?? false,
    completedAt: point.completedAt ?? null,
  }));
};

// Componente funcional RouteForm
const RouteForm = ({ onSubmit, editingRoute, onCancel }: RouteFormProps) => {
  const { optimizeRoute, getAddressByCep } = useRoutes();
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<string>('');
  const [optimizedOrder, setOptimizedOrder] = useState<string[]>([]);
  const [optimizing, setOptimizing] = useState(false);

  // Inicializa o formulário com react-hook-form
  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<RouteFormData>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      name: '',
      description: '',
      points: [],
      totalDistance: 0,
      estimatedTime: '',
      optimizedOrder: [],
    }
  });

  // ✅ CORRIGIDO: Deep cloning e IDs únicos para eliminar espelhamento
  useEffect(() => {
    if (editingRoute) {
      console.log('🔄 [ROUTE FORM] ========================================');
      console.log('🔄 [ROUTE FORM] INICIANDO EDIÇÃO DE ROTA');
      console.log(`🔄 [ROUTE FORM] Pontos originais: ${editingRoute.points.length}`);
      
      // ✅ DEEP CLONE com IDs únicos robustos
      const clonedPoints = deepClonePoints(editingRoute.points);
      
      console.log('📊 [ROUTE FORM] IDs únicos gerados:', clonedPoints.map(p => ({ 
        id: p.id, 
        address: p.address?.substring(0, 30) + '...' 
      })));
      
      // ✅ VERIFICAR unicidade dos IDs
      const uniqueIds = new Set(clonedPoints.map(p => p.id));
      console.log(`✅ [ROUTE FORM] IDs únicos confirmados: ${uniqueIds.size} de ${clonedPoints.length}`);
      
      if (uniqueIds.size !== clonedPoints.length) {
        console.error('❌ [ROUTE FORM] ERRO: IDs duplicados detectados!');
      }
      
      // ✅ RESETAR formulário com dados clonados
      reset({
        name: editingRoute.name,
        description: editingRoute.description || '',
        points: clonedPoints,
        totalDistance: editingRoute.totalDistance || 0,
        estimatedTime: editingRoute.estimatedTime || '',
        optimizedOrder: editingRoute.optimizedOrder || [],
      });
      
      setPoints(clonedPoints);
      setTotalDistance(editingRoute.totalDistance || 0);
      setEstimatedTime(editingRoute.estimatedTime || '');
      setOptimizedOrder(editingRoute.optimizedOrder || []);
      
      console.log('🔄 [ROUTE FORM] ========================================');
    } else {
      console.log('🆕 [ROUTE FORM] Iniciando nova rota');
      reset({
        name: '',
        description: '',
        points: [],
        totalDistance: 0,
        estimatedTime: '',
        optimizedOrder: [],
      });
      setPoints([]);
      setTotalDistance(0);
      setEstimatedTime('');
      setOptimizedOrder([]);
    }
  }, [editingRoute, reset]);

  // Função para adicionar um novo ponto
  const handleAddPoint = () => {
    const newPoint: RoutePoint = {
      id: `new-point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      address: '',
      cep: '',
      lat: 0,
      lng: 0,
      order: points.length,
      type: 'waypoint',
      completed: false,
      completedAt: null,
    };
    
    console.log(`➕ [ROUTE FORM] Novo ponto adicionado: ${newPoint.id}`);
    setPoints([...points, newPoint]);
  };

  // ✅ CORRIGIDO: Função para remover um ponto com verificações de segurança
  const handleRemovePoint = (index: number) => {
    if (points.length <= 2) {
      toast.error('É necessário manter pelo menos 2 pontos na rota');
      return;
    }

    console.log(`🗑️ [ROUTE FORM] Removendo ponto ${index}, restam ${points.length - 1} pontos`);
    
    const newPoints = [...points];
    newPoints.splice(index, 1);
    // Recalcula a ordem dos pontos restantes
    const updatedPoints = newPoints.map((point, i) => ({ ...point, order: i }));
    setPoints(updatedPoints);

    console.log(`✅ [ROUTE FORM] Ponto removido com sucesso, ${updatedPoints.length} pontos restantes`);
  };

  // ✅ CORRIGIDO: Função para buscar o endereço pelo CEP com validação de índice
  const handleSearchCep = async (index: number, cep: string) => {
    try {
      // ✅ VALIDAR índice
      if (index < 0 || index >= points.length) {
        console.error(`❌ [ROUTE FORM] Índice inválido: ${index}, pontos disponíveis: ${points.length}`);
        return;
      }

      console.log(`🔍 [ROUTE FORM] Buscando CEP ${cep} para ponto ${index} (ID: ${points[index]?.id})`);
      
      const addressData = await getAddressByCep(cep);
      
      // ✅ CRIAR novo array com objeto completamente novo
      const newPoints = points.map((point, i) => {
        if (i === index) {
          return {
            ...point,
            address: addressData.address,
            lat: addressData.lat,
            lng: addressData.lng,
            cep: cep,
          };
        }
        return point;
      });
      
      setPoints(newPoints);
      
      console.log(`✅ [ROUTE FORM] CEP encontrado para ponto ${index}:`, {
        address: addressData.address,
        lat: addressData.lat,
        lng: addressData.lng,
        pointId: points[index]?.id
      });
      
    } catch (error: any) {
      console.error(`❌ [ROUTE FORM] Erro ao buscar CEP ${cep} para ponto ${index}:`, error);
      toast.error(error.message || 'Erro ao buscar endereço');
    }
  };

  // ✅ MELHORADO: Função para atualizar o valor de um ponto com isolamento total
  const handlePointChange = (index: number, field: string, value: any) => {
    console.log(`📝 [ROUTE FORM] Alterando ponto ${index}, campo ${field}, valor:`, value);
    console.log(`📝 [ROUTE FORM] ID do ponto: ${points[index]?.id}`);
    
    // ✅ CRIAR novo array com objetos completamente novos
    const newPoints = points.map((point, i) => {
      if (i === index) {
        return {
          ...point,
          [field]: value
        };
      }
      return point;
    });
    
    setPoints(newPoints);
    
    console.log(`✅ [ROUTE FORM] Ponto ${index} atualizado, outros pontos preservados`);
  };

  const handleOptimize = async () => {
    try {
      setOptimizing(true);
      
      if (points.length < 2) {
        toast.error('É necessário pelo menos 2 pontos para otimizar a rota');
        return;
      }

      console.log('🎯 [ROUTE FORM] ========================================');
      console.log('🎯 [ROUTE FORM] INICIANDO OTIMIZAÇÃO');
      console.log(`🎯 [ROUTE FORM] Route ID: ${editingRoute?.id || 'NOVA ROTA'}`);
      console.log(`🎯 [ROUTE FORM] É rota existente: ${!!editingRoute?.id}`);
      console.log(`🎯 [ROUTE FORM] Pontos: ${points.length}`);
      
      // ✅ PASSAR O ID CORRETO - editingRoute?.id será undefined para novas rotas
      const result = await optimizeRoute(points, editingRoute?.id);
      
      console.log('✅ [ROUTE FORM] RESULTADO RECEBIDO:', result);
      
      // ✅ APLICAR RESULTADOS NO FORMULÁRIO
      setPoints(result.points);
      setTotalDistance(result.totalDistance);
      setEstimatedTime(result.estimatedTime);
      setOptimizedOrder(result.optimizedOrder);
      
      // ✅ FEEDBACK INTELIGENTE BASEADO NO RESULTADO
      const completedCount = result.points.filter((p: RoutePoint) => p.completed).length;
      const totalCount = result.points.length;
      
      if (completedCount > 0) {
        toast.success(`🧠 Otimização Inteligente: ${completedCount} pontos preservados, ${totalCount - completedCount} otimizados`);
        console.log(`🛡️ [ROUTE FORM] INTELLIGENT APLICADA: ${completedCount} preservados + ${totalCount - completedCount} otimizados`);
      } else {
        toast.success(`🆓 Otimização ${editingRoute?.id ? 'Tradicional' : 'Nova Rota'}: ${totalCount} pontos otimizados`);
        console.log(`🆓 [ROUTE FORM] ${editingRoute?.id ? 'FALLBACK TRADICIONAL' : 'NOVA ROTA'}: ${totalCount} pontos`);
      }
      
      console.log('🎯 [ROUTE FORM] ========================================');
      
    } catch (error) {
      console.error('❌ [ROUTE FORM] ERRO NA OTIMIZAÇÃO:', error);
      toast.error('Erro ao otimizar rota');
    } finally {
      setOptimizing(false);
    }
  };

  // Função para lidar com o envio do formulário
  const onSubmitData = (data: RouteFormData) => {
    const routeData = {
      ...data,
      points: points,
      totalDistance: totalDistance,
      estimatedTime: estimatedTime,
      optimizedOrder: optimizedOrder,
    };
    console.log('Dados da rota a serem enviados:', routeData);
    onSubmit();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingRoute ? 'Editar Rota' : 'Criar Nova Rota'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmitData)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Rota</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Digite o nome da rota"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição da Rota</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Digite uma descrição para a rota"
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Pontos da Rota</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddPoint}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Ponto
                </Button>
              </div>

              {points.map((point, index) => (
                <Card key={`point-${index}-${point.id}`} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">Ponto {index + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePoint(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`cep-${point.id}`}>CEP</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`cep-${point.id}`}
                          name={`cep-${point.id}`}
                          value={point.cep || ''}
                          onChange={(e) => handlePointChange(index, 'cep', e.target.value)}
                          placeholder="00000-000"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSearchCep(index, point.cep || '')}
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`address-${point.id}`}>Endereço</Label>
                      <Input
                        id={`address-${point.id}`}
                        name={`address-${point.id}`}
                        value={point.address}
                        onChange={(e) => handlePointChange(index, 'address', e.target.value)}
                        placeholder="Digite o endereço"
                      />
                      {errors.points?.[index]?.address && (
                        <p className="text-sm text-destructive">
                          {errors.points[index]?.address?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`lat-${point.id}`}>Latitude</Label>
                      <Input
                        id={`lat-${point.id}`}
                        name={`lat-${point.id}`}
                        type="number"
                        step="any"
                        value={point.lat}
                        onChange={(e) => handlePointChange(index, 'lat', parseFloat(e.target.value))}
                        placeholder="0.000000"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`lng-${point.id}`}>Longitude</Label>
                      <Input
                        id={`lng-${point.id}`}
                        name={`lng-${point.id}`}
                        type="number"
                        step="any"
                        value={point.lng}
                        onChange={(e) => handlePointChange(index, 'lng', parseFloat(e.target.value))}
                        placeholder="0.000000"
                      />
                    </div>
                  </div>
                </Card>
              ))}

              {errors.points && (
                <p className="text-sm text-destructive">{errors.points.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleOptimize}
                disabled={optimizing}
              >
                {optimizing ? 'Otimizando...' : editingRoute ? '🧠 Otimizar (Preservar Concluídos)' : '🚀 Otimizar Nova Rota'}
              </Button>

              <div className="flex gap-2">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancelar
                  </Button>
                )}
                <Button type="submit">
                  {editingRoute ? 'Salvar Alterações' : 'Criar Rota'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RouteForm;
