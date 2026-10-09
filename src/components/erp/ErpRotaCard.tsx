/**
 * Card de Rota para a listagem do ERP — SEM expansível.
 * Clicar no card entra "dentro do card": navega para /erp/rotas/:id,
 * onde ficam o mapinha Google Maps + pontos organizados.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Rota } from '@/types/rota';
import {
  MapPin, Edit, Trash2, ArrowUp, ArrowDown, FileDown, ListOrdered, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ErpRotaCardProps {
  rota: Rota;
  onEdit: (rota: Rota) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onPdf: (rota: Rota) => void;
  index: number;
  total: number;
}

const ErpRotaCard: React.FC<ErpRotaCardProps> = ({
  rota, onEdit, onDelete, onMove, onPdf, index, total,
}) => {
  const navigate = useNavigate();

  const statusColor = {
    ativa: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    inativa: 'bg-amber-100 text-amber-800 border-amber-200',
    concluida: 'bg-blue-100 text-blue-800 border-blue-200',
  } as const;

  const headerGradient = {
    ativa: 'from-emerald-500 to-emerald-600',
    inativa: 'from-amber-500 to-amber-600',
    concluida: 'from-blue-500 to-blue-600',
  } as const;

  const statusLabel = rota.status === 'ativa' ? 'Ativa' :
    rota.status === 'inativa' ? 'Inativa' : 'Concluída';
  const pontoCount = rota.pontos.length;
  const preview = rota.pontos.slice(0, 3);
  const open = () => navigate(`/erp/rotas/${rota.id}`);

  return (
    <div
      className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/40 transition-all overflow-hidden cursor-pointer"
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      }}
      aria-label={`Abrir rota ${rota.name}`}
    >
      <div className={`h-20 bg-gradient-to-br ${headerGradient[rota.status]} p-4 flex items-center justify-between`}>
        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white">
          <MapPin className="h-6 w-6" />
        </div>
        <ChevronRight className="h-5 w-5 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all" />
      </div>
      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 truncate" title={rota.name}>
              {rota.name}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
              <ListOrdered className="h-4 w-4 flex-shrink-0" />
              {pontoCount === 0
                ? 'Nenhum ponto adicionado'
                : `${pontoCount} ponto${pontoCount > 1 ? 's' : ''} na rota`}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className={`border ${statusColor[rota.status]}`}>
                {statusLabel}
              </Badge>
              <span className="text-xs text-slate-400 hidden sm:inline">
                criada em {new Date(rota.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => onMove(rota.id, 'up')} className="h-8 w-8 p-0" title="Mover para cima">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" disabled={index === total - 1} onClick={() => onMove(rota.id, 'down')} className="h-8 w-8 p-0" title="Mover para baixo">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onPdf(rota)} className="h-8 w-8 p-0" title="Gerar PDF">
              <FileDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(rota)} className="h-8 w-8 p-0" title="Editar">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(rota.id)} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" title="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {preview.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
            {preview.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="truncate font-medium">{p.company}</span>
                <span className="truncate text-slate-400 hidden sm:inline">- {p.address}</span>
              </li>
            ))}
            {pontoCount > 3 && (
              <li className="text-xs text-primary font-medium pl-7">
                + {pontoCount - 3} ponto{pontoCount - 3 > 1 ? 's' : ''} - clique para ver todos + mapa
              </li>
            )}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-between px-4 md:px-5 py-2 bg-slate-50/50 border-t border-slate-100">
        <span className="text-xs text-slate-400">Clique para abrir a rota + mapa</span>
        <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
          Abrir <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
};

export default ErpRotaCard;
