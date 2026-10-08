/**
 * Card de Rota para o ERP.
 * Um card = uma rota (ex.: "Centro Barreiro"). Ao expandir, lista os Pontos
 * (empresas/paradas) da rota, com ações de adicionar/editar/excluir/mover ponto.
 */
import React from 'react';
import { Rota, Ponto } from '@/types/rota';
import {
  MapPin, Building2, Phone, FileText, Bath, CircleDot, Droplets,
  Edit, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown,
  PlusCircle, FileDown, ListOrdered,
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
  onPdf: (rota: Rota) => void;
  onAddPonto: (rota: Rota) => void;
  onEditPonto: (rota: Rota, ponto: Ponto) => void;
  onDeletePonto: (rotaId: string, pontoId: string) => void;
  onMovePonto: (rotaId: string, pontoId: string, direction: 'up' | 'down') => void;
}

const ErpRotaCard: React.FC<ErpRotaCardProps> = ({
  rota,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onMove,
  onPdf,
  onAddPonto,
  onEditPonto,
  onDeletePonto,
  onMovePonto,
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

  const pontoCount = rota.pontos.length;

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
                <ListOrdered className="h-4 w-4" />
                {pontoCount === 0
                  ? 'Nenhum ponto adicionado'
                  : `${pontoCount} ponto${pontoCount > 1 ? 's' : ''} na rota`}
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
                onClick={(e) => { e.stopPropagation(); onPdf(rota); }}
                className="h-8 w-8 p-0"
                aria-label="Gerar PDF da rota"
              >
                <FileDown className="h-4 w-4" />
              </Button>
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
        </div>
      </div>

      {/* ===== Conteúdo expandido: pontos da rota ===== */}
      {expanded && (
        <div className="px-4 md:px-5 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <ListOrdered className="h-4 w-4 text-primary" />
              Pontos da rota ({pontoCount})
            </h4>
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); onAddPonto(rota); }}
              className="h-8 px-3 text-xs bg-gradient-to-r from-primary to-primary-700 hover:from-primary/90 hover:to-primary-600"
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1" /> Adicionar Ponto
            </Button>
          </div>

          {pontoCount === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <MapPin className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                Esta rota ainda não tem pontos. Clique em “Adicionar Ponto” para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rota.pontos.map((ponto, index) => (
                <div
                  key={ponto.id}
                  className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
                >
                  {/* Número da ordem */}
                  <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                      <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      {ponto.company}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {ponto.address}
                    </p>

                    {/* Detalhes do ponto */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
                      {ponto.cleaning && (
                        <span className="flex items-center gap-1">
                          <Droplets className="h-3.5 w-3.5 text-slate-400" /> {ponto.cleaning}
                        </span>
                      )}
                      {ponto.bathrooms && (
                        <span className="flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5 text-slate-400" /> {ponto.bathrooms}
                        </span>
                      )}
                      {ponto.contact && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-slate-400" /> {ponto.contact}
                        </span>
                      )}
                      {ponto.sanitarioNumber && (
                        <span className="flex items-center gap-1">
                          <CircleDot className="h-3.5 w-3.5 text-slate-400" /> Sanitário: {ponto.sanitarioNumber}
                        </span>
                      )}
                      {ponto.model && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" /> {ponto.model}
                        </span>
                      )}
                      {ponto.color && (
                        <span className="flex items-center gap-1">
                          <Droplets className="h-3.5 w-3.5 text-slate-400" /> {ponto.color}
                        </span>
                      )}
                    </div>

                    {ponto.observation && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2 flex items-start gap-1.5">
                        <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span>{ponto.observation}</span>
                      </p>
                    )}
                  </div>

                  {/* Ações do ponto */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === 0}
                      onClick={(e) => { e.stopPropagation(); onMovePonto(rota.id, ponto.id, 'up'); }}
                      className="h-7 w-7 p-0"
                      aria-label="Mover ponto para cima"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === pontoCount - 1}
                      onClick={(e) => { e.stopPropagation(); onMovePonto(rota.id, ponto.id, 'down'); }}
                      className="h-7 w-7 p-0"
                      aria-label="Mover ponto para baixo"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onEditPonto(rota, ponto); }}
                      className="h-7 w-7 p-0"
                      aria-label="Editar ponto"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onDeletePonto(rota.id, ponto.id); }}
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      aria-label="Excluir ponto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ordenação da rota */}
          <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400 font-medium mr-1">Mover rota:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onMove(rota.id, 'up'); }}
              className="h-8 px-3 text-xs"
            >
              <ArrowUp className="h-3.5 w-3.5" /> Subir
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onMove(rota.id, 'down'); }}
              className="h-8 px-3 text-xs"
            >
              <ArrowDown className="h-3.5 w-3.5" /> Descer
            </Button>
          </div>
        </div>
      )}

      {/* Rodapé expansão/recolhimento */}
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
