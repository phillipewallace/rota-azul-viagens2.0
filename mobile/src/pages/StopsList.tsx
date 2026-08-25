/**
 * StopsList - Lista de paradas da rota com drag & drop
 * 
 * Funcionalidades:
 * - Visualização de todas as paradas
 * - Drag & drop para reordenar
 * - Navegação para tela de adicionar parada extra
 * - Toque no item para ver detalhes
 * 
 * IMPORTANTE: Drag & drop é preservado e funcional
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { 
  DndContext, 
  closestCenter, 
  DragEndEvent,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverlay
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { GripVertical, ArrowLeft, Save, Plus, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import { useMobile } from '@/hooks/useMobile';
import { sharedLocationStore } from '@/store/sharedLocationStore';
import { RoutePoint as RoutePointType } from '@/types/route';

// Tipo local estendido para compatibilidade com dados existentes
interface RoutePoint extends Partial<RoutePointType> {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: string;
  completed: boolean;
  name?: string;
  stopType?: string;
}

interface StopsListProps {
  routeId?: string;
  truckId?: string;
  initialPoints?: RoutePoint[];
  onBack?: () => void;
}

// Navegar para detalhes da parada
const navigateToStopDetails = (navigate: ReturnType<typeof useNavigate>, point: RoutePoint, index: number) => {
  navigate('/stop-details', { 
    state: { point, index } 
  });
};

// Componente para item arrastável
function SortableStopItem({ 
  point, 
  index,
  onTap
}: { 
  point: RoutePoint; 
  index: number;
  onTap: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isItemDragging,
  } = useSortable({ id: point.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isItemDragging ? 0.5 : 1,
    zIndex: isItemDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border-2 shadow-sm p-4 mb-3 ${
        isItemDragging ? 'border-blue-500 shadow-lg' : 'border-gray-200'
      } ${point.completed ? 'bg-green-50 border-green-300' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Handle de arrastar */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-3 -m-2 touch-none rounded-lg hover:bg-gray-100"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-6 w-6 text-gray-400" />
        </div>
        
        {/* Área clicável para abrir detalhes */}
        <div 
          className="flex-1 min-w-0 cursor-pointer active:bg-gray-50 rounded-lg -m-1 p-1"
          onClick={onTap}
        >
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`font-bold text-base ${point.completed ? 'text-green-600' : 'text-blue-600'}`}>
              Parada {index + 1}
            </span>
            {point.completed && (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            {point.operationType && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
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
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {point.pointCategory === 'obra' ? '🏗️ Obra' : '🎉 Evento'}
              </span>
            )}
          </div>
          
          <p className="text-sm font-medium text-gray-900 mb-1">
            {point.name || 'Cliente'}
          </p>
          
          <p className="text-xs text-gray-600 break-words flex items-start gap-1">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{point.address}</span>
          </p>
          
          {/* Indicador visual para tocar */}
          <p className="text-xs text-blue-500 mt-2 font-medium">
            Toque para ver detalhes →
          </p>
        </div>
      </div>
    </div>
  );
}

// Componente para overlay durante arraste
function DragOverlayItem({ point, index }: { point: RoutePoint; index: number }) {
  return (
    <div className="bg-white rounded-xl border-2 border-blue-500 shadow-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="p-3">
          <GripVertical className="h-6 w-6 text-blue-500" />
        </div>
        <div className="flex-1">
          <span className="font-bold text-base text-blue-600">
            Parada {index + 1}
          </span>
          <p className="text-sm font-medium text-gray-900">
            {point.name || 'Cliente'}
          </p>
        </div>
      </div>
    </div>
  );
}

const StopsList: React.FC<StopsListProps> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Props podem vir direto ou via navigation state/params
  const stateData = location.state as { 
    routeId?: string; 
    truckId?: string; 
    initialPoints?: RoutePoint[];
  } | null;
  
  const routeId = props.routeId || stateData?.routeId || searchParams.get('routeId') || '';
  const truckId = props.truckId || stateData?.truckId || searchParams.get('truckId') || '';
  const initialPointsRaw = props.initialPoints || stateData?.initialPoints || [];
  
  const [points, setPoints] = useState<RoutePoint[]>(
    [...initialPointsRaw].sort((a, b) => a.order - b.order)
  );
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { reorderStops } = useMobile();

  // Atualizar pontos se props mudarem
  useEffect(() => {
    if (initialPointsRaw.length > 0) {
      setPoints([...initialPointsRaw].sort((a, b) => a.order - b.order));
    }
  }, [initialPointsRaw]);

  // Sensores configurados para toque móvel
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Verificar deep link ao montar
  useEffect(() => {
    const sharedState = sharedLocationStore.getState();
    if (sharedState.isFromShare && sharedState.sharedContent && routeId && truckId) {
      console.log('📍 [STOPS LIST] Redirecionando para adicionar parada com deep link');
      navigateToAddStop();
    }
  }, [routeId, truckId]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setPoints((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        
        return reorderedItems.map((item, idx) => ({
          ...item,
          order: idx
        }));
      });
      
      setHasChanges(true);
      toast.info('Ordem alterada. Clique em Salvar para confirmar.');
    }
  };

  const handleSaveChanges = async () => {
    if (!hasChanges) {
      toast.info('Nenhuma alteração para salvar');
      return;
    }

    setSaving(true);

    try {
      const reorderedPoints = points.map((point, index) => ({
        pointId: point.id,
        order: index
      }));

      console.log('💾 [STOPS LIST] Salvando reordenação:', reorderedPoints);

      await reorderStops(routeId, reorderedPoints);

      toast.success('Ordem das paradas salva!');
      setHasChanges(false);
      
    } catch (error) {
      console.error('❌ [STOPS LIST] Erro ao salvar:', error);
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const navigateToAddStop = () => {
    // Passar dados via URL params (para funcionar com deep links)
    const pointsEncoded = encodeURIComponent(JSON.stringify(points));
    navigate(`/add-stop?routeId=${routeId}&truckId=${truckId}&points=${pointsEncoded}`);
  };

  const handleBack = () => {
    if (hasChanges) {
      const confirm = window.confirm(
        'Você tem alterações não salvas. Deseja sair sem salvar?'
      );
      if (!confirm) return;
    }
    
    if (props.onBack) {
      props.onBack();
    } else {
      navigate('/');
    }
  };

  const activePoint = activeId ? points.find(p => p.id === activeId) : null;
  const activeIndex = activeId ? points.findIndex(p => p.id === activeId) : -1;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header fixo */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="safe-top" />
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-2 -ml-2"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Button>

            <Button
              onClick={handleSaveChanges}
              disabled={!hasChanges || saving}
              size="sm"
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>

          <h1 className="text-xl font-bold text-gray-900">
            Lista de Paradas
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Toque e segure no ícone ≡ para reordenar
          </p>
          
          {hasChanges && (
            <p className="text-sm text-amber-600 font-medium mt-2">
              ⚠️ Alterações não salvas
            </p>
          )}
        </div>
      </header>

      {/* Lista de Paradas */}
      <main className="flex-1 overflow-y-auto p-4 pb-36">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={points.map(p => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {points.map((point, index) => (
              <SortableStopItem
                key={point.id}
                point={point}
                index={index}
                onTap={() => navigateToStopDetails(navigate, point, index)}
              />
            ))}
          </SortableContext>

          <DragOverlay>
            {activePoint && activeIndex >= 0 && (
              <DragOverlayItem point={activePoint} index={activeIndex} />
            )}
          </DragOverlay>
        </DndContext>

        {points.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="font-medium">Nenhuma parada na rota</p>
          </div>
        )}
      </main>

      {/* Footer fixo */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-10">
        <div className="p-4">
          <Button
            onClick={navigateToAddStop}
            variant="outline"
            className="w-full h-14 gap-2 text-base font-medium border-2"
          >
            <Plus className="h-5 w-5" />
            Adicionar parada extra
          </Button>
        </div>
        <div className="pb-safe bg-white" />
      </footer>
    </div>
  );
};

export default StopsList;
