import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GripVertical, Trash2, Search, Copy, MapPin, Phone, User, Building2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { RoutePoint } from '@/hooks/useRoutes';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RoutePointsListProps {
  points: RoutePoint[];
  onReorder: (points: RoutePoint[]) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof RoutePoint, value: any) => void;
  onSearchByCep: (id: string, cep: string) => void;
  onSearchByAddress: (id: string, address: string) => void;
  onDuplicate: (id: string) => void;
  isDraggable: boolean;
  searchingAddress: number | null;
}

interface SortablePointProps {
  point: RoutePoint;
  index: number;
  isDraggable: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof RoutePoint, value: any) => void;
  onSearchByCep: (id: string, cep: string) => void;
  onSearchByAddress: (id: string, address: string) => void;
  onDuplicate: (id: string) => void;
  searchingAddress: number | null;
  totalPoints: number;
}

const SortablePoint: React.FC<SortablePointProps> = ({
  point,
  index,
  isDraggable,
  onRemove,
  onUpdate,
  onSearchByCep,
  onSearchByAddress,
  onDuplicate,
  searchingAddress,
  totalPoints
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: point.id, disabled: !isDraggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const getPointTypeLabel = () => {
    if (index === 0) return 'Origem';
    if (index === totalPoints - 1) return 'Destino';
    return 'Parada';
  };

  const getPointTypeColor = () => {
    if (index === 0) return 'bg-green-500/10 text-green-700 border-green-200';
    if (index === totalPoints - 1) return 'bg-red-500/10 text-red-700 border-red-200';
    return 'bg-blue-500/10 text-blue-700 border-blue-200';
  };

  const hasOperationalData = point.customerName || point.restroomsQty || point.cleaningsQty || 
                             point.contactName || point.contactPhone || point.notes || point.observation;

  return (
    <div ref={setNodeRef} style={style} data-point-card>
      <Card className={`mb-4 ${isDragging ? 'shadow-2xl' : 'shadow-sm'} transition-shadow`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {isDraggable && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing mt-2 hover:bg-muted/50 p-1 rounded transition-colors"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            
            <div className="flex-1 space-y-4">
              {/* Header com tipo e ações */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={`${getPointTypeColor()} px-2 py-1 text-xs font-medium border`}>
                    <MapPin className="h-3 w-3 mr-1" />
                    {getPointTypeLabel()} {index + 1}
                  </Badge>
                  {hasOperationalData && (
                    <Badge variant="outline" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Dados extras
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDuplicate(point.id)}
                    className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                    title="Duplicar ponto"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {totalPoints > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(point.id)}
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Seção: Endereço */}
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Endereço
                </h4>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor={`cep-${point.id}`} className="text-xs text-muted-foreground">CEP</Label>
                    <div className="flex gap-1">
                      <Input
                        id={`cep-${point.id}`}
                        value={point.cep || ''}
                        onChange={(e) => onUpdate(point.id, 'cep', e.target.value)}
                        placeholder="00000-000"
                        className="text-sm h-9"
                        maxLength={9}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => point.cep && onSearchByCep(point.id, point.cep)}
                        disabled={!point.cep || point.cep.length < 8}
                        className="h-9 w-9 p-0 shrink-0"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor={`address-${point.id}`} className="text-xs text-muted-foreground">Endereço completo</Label>
                    <div className="flex gap-1">
                      <Input
                        id={`address-${point.id}`}
                        value={point.address || ''}
                        onChange={(e) => onUpdate(point.id, 'address', e.target.value)}
                        placeholder="Digite o endereço..."
                        className="text-sm h-9"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => point.address && onSearchByAddress(point.id, point.address)}
                        disabled={!point.address || point.address.length < 5}
                        className="h-9 w-9 p-0 shrink-0"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`lat-${point.id}`} className="text-xs text-muted-foreground">Latitude</Label>
                    <Input
                      id={`lat-${point.id}`}
                      value={point.lat || ''}
                      readOnly
                      className="text-sm h-9 bg-muted/30"
                      placeholder="Auto"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`lng-${point.id}`} className="text-xs text-muted-foreground">Longitude</Label>
                    <Input
                      id={`lng-${point.id}`}
                      value={point.lng || ''}
                      readOnly
                      className="text-sm h-9 bg-muted/30"
                      placeholder="Auto"
                    />
                  </div>
                </div>
              </div>

              {/* Seção expansível: Dados Operacionais */}
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      Dados operacionais e contato
                    </span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-3 mt-3">
                  {/* Dados operacionais */}
                  <div className="p-3 bg-blue-50/50 rounded-lg space-y-3">
                    <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      Dados Operacionais
                    </h4>
                    
                    <div>
                      <Label htmlFor={`customerName-${point.id}`} className="text-xs text-muted-foreground">Nome do cliente/ponto</Label>
                      <Input
                        id={`customerName-${point.id}`}
                        value={point.customerName || ''}
                        onChange={(e) => onUpdate(point.id, 'customerName', e.target.value)}
                        placeholder="Ex: João da Silva"
                        className="text-sm h-9"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`restroomsQty-${point.id}`} className="text-xs text-muted-foreground">Qtd. Banheiros</Label>
                        <Input
                          id={`restroomsQty-${point.id}`}
                          type="number"
                          min="0"
                          value={point.restroomsQty ?? ''}
                          onChange={(e) => onUpdate(point.id, 'restroomsQty', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="0"
                          className="text-sm h-9"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`cleaningsQty-${point.id}`} className="text-xs text-muted-foreground">Qtd. Limpezas</Label>
                        <Input
                          id={`cleaningsQty-${point.id}`}
                          type="number"
                          min="0"
                          value={point.cleaningsQty ?? ''}
                          onChange={(e) => onUpdate(point.id, 'cleaningsQty', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="0"
                          className="text-sm h-9"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contato */}
                  <div className="p-3 bg-purple-50/50 rounded-lg space-y-3">
                    <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Contato Local
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`contactName-${point.id}`} className="text-xs text-muted-foreground">Nome do responsável</Label>
                        <Input
                          id={`contactName-${point.id}`}
                          value={point.contactName || ''}
                          onChange={(e) => onUpdate(point.id, 'contactName', e.target.value)}
                          placeholder="Nome"
                          className="text-sm h-9"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`contactPhone-${point.id}`} className="text-xs text-muted-foreground">Telefone</Label>
                        <div className="flex gap-1">
                          <Phone className="h-4 w-4 text-muted-foreground mt-2.5" />
                          <Input
                            id={`contactPhone-${point.id}`}
                            value={point.contactPhone || ''}
                            onChange={(e) => onUpdate(point.id, 'contactPhone', e.target.value)}
                            placeholder="(00) 00000-0000"
                            className="text-sm h-9"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Observações */}
                  <div className="p-3 bg-amber-50/50 rounded-lg space-y-2">
                    <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                      Observações
                    </h4>
                    <textarea
                      id={`notes-${point.id}`}
                      value={point.notes || point.observation || ''}
                      onChange={(e) => {
                        onUpdate(point.id, 'notes', e.target.value);
                        onUpdate(point.id, 'observation', e.target.value);
                      }}
                      placeholder="Adicione observações sobre este ponto..."
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {(point.notes || point.observation || '').length}/500
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const RoutePointsList: React.FC<RoutePointsListProps> = ({
  points,
  onReorder,
  onRemove,
  onUpdate,
  onSearchByCep,
  onSearchByAddress,
  onDuplicate,
  isDraggable,
  searchingAddress
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = points.findIndex((p) => p.id === active.id);
      const newIndex = points.findIndex((p) => p.id === over.id);

      const newPoints = arrayMove(points, oldIndex, newIndex);
      onReorder(newPoints);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={points.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        {points.map((point, index) => (
          <SortablePoint
            key={point.id}
            point={point}
            index={index}
            isDraggable={isDraggable}
            onRemove={onRemove}
            onUpdate={onUpdate}
            onSearchByCep={onSearchByCep}
            onSearchByAddress={onSearchByAddress}
            onDuplicate={onDuplicate}
            searchingAddress={searchingAddress}
            totalPoints={points.length}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
};
