import React, { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Trash2, Search, Copy, MapPin, Phone, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { RoutePoint } from '@/hooks/useRoutes';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';

interface RoutePointsTableProps {
  points: RoutePoint[];
  onReorder: (points: RoutePoint[]) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof RoutePoint, value: any) => void;
  onSearchByCep: (id: string, cep: string) => void;
  onSearchByAddress: (id: string, address: string) => void;
  onDuplicate: (id: string) => void;
  onAddPoint: () => void;
  onAddFromSanitario?: () => void;
  isDraggable: boolean;
  searchingAddress: number | null;
}

interface SortableRowProps {
  point: RoutePoint;
  index: number;
  isDraggable: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof RoutePoint, value: any) => void;
  onSearchByCep: (id: string, cep: string) => void;
  onSearchByAddress: (id: string, address: string) => void;
  onDuplicate: (id: string) => void;
  totalPoints: number;
  expandedRow: string | null;
  setExpandedRow: (id: string | null) => void;
}

const SortableRow: React.FC<SortableRowProps> = ({
  point,
  index,
  isDraggable,
  onRemove,
  onUpdate,
  onSearchByCep,
  onSearchByAddress,
  onDuplicate,
  totalPoints,
  expandedRow,
  setExpandedRow
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: point.id, disabled: !isDraggable });

  // Verificar se ponto tem coordenadas válidas
  const hasValidCoordinates = point.lat && point.lng && point.lat !== 0 && point.lng !== 0;
  const hasValidAddress = point.address && point.address.trim().length >= 5;
  const isInvalid = !hasValidCoordinates || !hasValidAddress;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const getPointTypeLabel = () => {
    if (index === 0) return 'Origem';
    if (index === totalPoints - 1) return 'Destino';
    return `Parada ${index}`;
  };

  const getPointTypeColor = () => {
    if (index === 0) return 'bg-green-500 text-white';
    if (index === totalPoints - 1) return 'bg-red-500 text-white';
    return 'bg-blue-500 text-white';
  };

  const isExpanded = expandedRow === point.id;

  return (
    <div ref={setNodeRef} style={style} data-point-card className="relative">
      {/* Indicador visual de erro - fora da grid */}
      {isInvalid && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-red-500 rounded-r animate-pulse z-10" />
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-red-600 text-white border-red-600">
              {!hasValidCoordinates ? 'Busque o endereço para obter coordenadas' : 'Endereço muito curto'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {/* Linha principal */}
      <div className={`grid grid-cols-[40px_90px_100px_160px_minmax(220px,1fr)_70px_70px_190px_130px_140px_minmax(180px,1fr)_100px] gap-2 items-center px-3 py-3 min-h-[56px] border-b hover:bg-muted/30 transition-colors ${isDragging ? 'bg-primary/10 shadow-lg' : ''} ${isExpanded ? 'bg-blue-50/50' : ''} ${isInvalid ? 'bg-red-50/50' : ''}`}>
        <div className="flex justify-center">
          {isDraggable ? (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing hover:bg-muted p-1.5 rounded">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : (<span className="text-sm text-muted-foreground font-medium">{index + 1}</span>)}
        </div>

        <Badge className={`${getPointTypeColor()} text-[11px] px-2.5 py-1 justify-center`}>{getPointTypeLabel()}</Badge>

        <div className="flex gap-1">
          <Input value={point.cep || ''} onChange={(e) => onUpdate(point.id, 'cep', e.target.value)} placeholder="CEP" className="h-9 text-sm" maxLength={9} />
          <Button variant="ghost" size="sm" onClick={() => point.cep && onSearchByCep(point.id, point.cep)} disabled={!point.cep || point.cep.length < 8} className="h-9 w-9 p-0 shrink-0"><Search className="h-4 w-4" /></Button>
        </div>

        <Input value={point.customerName || ''} onChange={(e) => onUpdate(point.id, 'customerName', e.target.value)} placeholder="Nome do cliente" className="h-9 text-sm font-medium" />

        <div className="flex gap-1">
          <Input value={point.address || ''} onChange={(e) => onUpdate(point.id, 'address', e.target.value)} placeholder="Endereço completo" className="h-9 text-sm" />
          <Button variant="ghost" size="sm" onClick={() => point.address && onSearchByAddress(point.id, point.address)} disabled={!point.address || point.address.length < 5} className="h-9 w-9 p-0 shrink-0"><MapPin className="h-4 w-4" /></Button>
        </div>

        <Input type="number" min="0" value={point.restroomsQty ?? ''} onChange={(e) => onUpdate(point.id, 'restroomsQty', e.target.value ? parseInt(e.target.value) : undefined)} placeholder="Banh." className="h-9 text-sm text-center" />
        <Input type="number" min="0" value={point.cleaningsQty ?? ''} onChange={(e) => onUpdate(point.id, 'cleaningsQty', e.target.value ? parseInt(e.target.value) : undefined)} placeholder="Limp." className="h-9 text-sm text-center" />

        {/* Telefone — coluna 190px para não cortar */}
        <div className="flex items-center gap-1 min-w-0">
          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input value={point.contactPhone || ''} onChange={(e) => onUpdate(point.id, 'contactPhone', e.target.value)} placeholder="(11) 99999-9999" className="h-9 text-sm flex-1 min-w-0" />
        </div>

        <select value={point.pointCategory || 'obra'} onChange={(e) => onUpdate(point.id, 'pointCategory' as any, e.target.value)} className="h-9 text-sm border rounded-md px-2 bg-background">
          <option value="obra">Obra</option>
          <option value="evento">Evento</option>
        </select>

        <select value={point.operationType || 'entrega'} onChange={(e) => onUpdate(point.id, 'operationType' as any, e.target.value)} className="h-9 text-sm border rounded-md px-2 bg-background">
          <option value="entrega">Entrega</option>
          <option value="recolhimento">Recolhimento</option>
          <option value="manutencao">Manutenção</option>
        </select>

        <Input value={point.notes || point.observation || ''} onChange={(e) => { onUpdate(point.id, 'notes', e.target.value); onUpdate(point.id, 'observation', e.target.value); }} placeholder="Observações..." className="h-9 text-sm" />

        {/* Ações */}
        <div className="flex items-center gap-1 justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedRow(isExpanded ? null : point.id)}
                  className="h-8 w-8 p-0"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mais detalhes</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDuplicate(point.id)}
                  className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicar</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {totalPoints > 2 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(point.id)}
                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remover</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Linha expandida com mais detalhes */}
      {isExpanded && (
        <div className="bg-slate-50 border-b px-4 py-3 grid grid-cols-3 gap-4">
          {/* Coordenadas */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Coordenadas</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground">Lat</span>
                <Input
                  value={point.lat || ''}
                  readOnly
                  className="h-7 text-xs bg-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Lng</span>
                <Input
                  value={point.lng || ''}
                  readOnly
                  className="h-7 text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Responsável no local</label>
            <Input
              value={point.contactName || ''}
              onChange={(e) => onUpdate(point.id, 'contactName', e.target.value)}
              placeholder="Nome do responsável"
              className="h-8 text-xs"
            />
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <Textarea
              value={point.notes || point.observation || ''}
              onChange={(e) => {
                onUpdate(point.id, 'notes', e.target.value);
                onUpdate(point.id, 'observation', e.target.value);
              }}
              placeholder="Observações sobre este ponto..."
              className="h-16 text-xs resize-none"
              maxLength={500}
            />
          </div>

          {/* Numeração dos sanitários */}
          <div className="space-y-2 col-span-3">
            <label className="text-xs font-medium text-muted-foreground">
              Numeração dos sanitários (separe por vírgula)
            </label>
            <Input
              value={(point.sanitarioNumbers || []).join(', ')}
              onChange={(e) => {
                const seen = new Set<string>();
                const arr = e.target.value
                  .split(',')
                  .map((s) => s.trim().toUpperCase())
                  .filter((s) => {
                    if (!s) return false;
                    if (seen.has(s)) return false;
                    seen.add(s);
                    return true;
                  });
                onUpdate(point.id, 'sanitarioNumbers' as any, arr);
              }}
              placeholder="ex: 1024, 1025, 1030"
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Pode ser preenchido aqui manualmente ou pelo motorista no app na hora da entrega.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export const RoutePointsTable: React.FC<RoutePointsTableProps> = ({
  points,
  onReorder,
  onRemove,
  onUpdate,
  onSearchByCep,
  onSearchByAddress,
  onDuplicate,
  onAddPoint,
  onAddFromSanitario,
  isDraggable,
  searchingAddress
}) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
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
    <div className="border rounded-lg overflow-x-auto bg-background shadow-sm min-w-full">
      {/* Header da tabela - com altura maior e fonte maior */}
      <div className="grid grid-cols-[40px_90px_100px_160px_minmax(220px,1fr)_70px_70px_190px_130px_140px_minmax(180px,1fr)_100px] gap-2 items-center px-3 py-3 bg-muted/50 border-b text-sm font-semibold text-muted-foreground">
        <div className="text-center">#</div>
        <div>Tipo</div>
        <div>CEP</div>
        <div>Cliente</div>
        <div>Endereço</div>
        <div className="text-center">Banh.</div>
        <div className="text-center">Limp.</div>
        <div>Telefone</div>
        <div>Categoria</div>
        <div>Operação</div>
        <div>Observações</div>
        <div className="text-right">Ações</div>
      </div>

      {/* Corpo da tabela com drag and drop */}
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
            <SortableRow
              key={point.id}
              point={point}
              index={index}
              isDraggable={isDraggable}
              onRemove={onRemove}
              onUpdate={onUpdate}
              onSearchByCep={onSearchByCep}
              onSearchByAddress={onSearchByAddress}
              onDuplicate={onDuplicate}
              totalPoints={points.length}
              expandedRow={expandedRow}
              setExpandedRow={setExpandedRow}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Botão para adicionar ponto */}
      <div className="p-2 border-t bg-muted/30 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddPoint}
          className="flex-1 h-8 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 border border-dashed"
        >
          <Plus className="h-3 w-3 mr-1" />
          Adicionar ponto
        </Button>
        {onAddFromSanitario && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddFromSanitario}
            className="flex-1 h-8 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50 border border-dashed border-blue-300"
            title="Puxar dados de um sanitário já alocado em cliente"
          >
            <MapPin className="h-3 w-3 mr-1" />
            Puxar sanitário alocado
          </Button>
        )}
      </div>
    </div>
  );
};
