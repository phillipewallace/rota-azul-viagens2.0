/**
 * Componente de Card de Rota para o ERP.
 * Exibe os dados de uma rota em formato de card, com expansão para mostrar detalhes.
 */
import React from 'react';
import { Rota } from '@/types/rota';
import {
  MapPin, Building2, WashingMachine, Phone, FileText,
  Bath, CircleDot, Droplets, Edit, Trash2, ChevronDown,
  ChevronRight, ArrowUp, ArrowDown, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ErpRotaCardProps {
  rota: Rota;
  expanded: boolean;
  onToggle: () => void;
  onEdit: (rota: Rota) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
}

const ErpRotaCard: React.FC<ErpRotaCardProps> = ({
  rota,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onMove,
}) => {

  const statusColor = {
    ativa: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    inativa: 'bg-amber-100 text-amber-800 border-amber-200',
    concluida: 'bg-blue-100 text-blue-800 border-blue-200',
  } as const;

  const nameColor = {
    ativa: 'from-emerald-500 to-emerald-600',
    inativa: 'from-amber-500 to-amber-600',
    concluida: 'from-blue-500 to-blue-600',
  } as const;

  const statusLabel = rota.status === 'ativa' ? 'Ativa' :
    rota.status === 'inativa' ? 'Inativa' : 'Concluída';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      <div className="cursor-pointer select-none" onClick={onToggle}>
        <div className="h-28 bg-gradient-to-br p-4 md:p-5 flex items-center justify-center">
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${nameColor[rota.status]} flex items-center justify-center text-white shadow-lg`}>
            <MapPin className="h-7 w-7" />
          </div>
        </div>

        <div className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900 truncate" title={rota.name}>
                {rota.name}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                <Building2 className="h-4 w-4" />
                {rota.company}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge className={`border ${statusColor[rota.status]}`}>
                  {statusLabel}
                </Badge>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  | criada em {new Date(rota.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onEdit(rota); }}
                className="h-8 w-8 p-0"
                aria-label="Editar rota"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onDelete(rota.id); }}
                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                aria-label="Excluir rota"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center text-slate-600 text-sm">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="font-medium text-slate-800 truncate ml-1" title={rota.address}>
              {rota.address}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 md:px-5 pb-5 border-t border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="p-2 bg-primary/10 rounded-lg">
                <WashingMachine className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Limpezas</p>
                <p className="text-sm text-slate-800 font-medium">{rota.cleaning || '—'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Bath className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Banheiros</p>
                <p className="text-sm text-slate-800 font-medium">{rota.bathrooms || '—'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Phone className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contato</p>
                <p className="text-sm text-slate-800 font-medium">{rota.contact || '—'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CircleDot className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sanitário</p>
                <p className="text-sm text-slate-800 font-medium">{rota.sanitarioNumber || '—'}</p>
              </div>
            </div>
          </div>

          {rota.observation && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  <span className="font-semibold">Observação:</span> {rota.observation}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
              <Droplets className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Modelo:</span>
              <span className="text-sm text-slate-800 font-semibold">{rota.model || '—'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
              <XCircle className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Cor:</span>
              <span className="text-sm text-slate-800 font-semibold">{rota.color || '—'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400 font-medium">Mover posição (segure e clique):</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onMove(rota.id, 'up'); }}
                disabled={rota.status === 'concluida'}
                className="h-8 px-3 text-xs"
              >
                <ArrowUp className="h-3.5 w-3.5" /> Subir
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onMove(rota.id, 'down') }}
                disabled={rota.status === 'concluida'}
                className="h-8 px-3 text-xs"
              >
                <ArrowDown className="h-3.5 w-3.5" /> Baixo
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 md:px-5 py-2 bg-slate-50/50">
        <button
          className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          onClick={onToggle}
        >
          {expanded ? (
            <>
              <ChevronDown className="h-4 w-4" /> Recolher
            </>
          ) : (
            <>
              <ChevronRight className="h-4 w-4" /> Expandir
            </>
          )}
        </button>
        <span className="text-xs text-slate-400">{expanded ? '—' : '●'}</span>
      </div>
    </div>
  );
};

export default ErpRotaCard;
