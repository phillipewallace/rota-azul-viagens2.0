/**
 * Card de cliente na grid. Apenas apresentação — toda ação sai via callback.
 */
import React from 'react';
import {
  AlertTriangle, Building2, Edit3, History, Mail, MapPin, Phone, Trash2, User,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Customer } from '@/hooks/useCustomers';
import { maskDocument } from '@/utils/brazilianDocs';
import { getPersonType } from '@/utils/customerHelpers';

interface Props {
  customer: Customer;
  sanCount: number;
  isDuplicate: boolean;
  duplicateReason?: string;
  onEdit: (c: Customer) => void;
  onHistory: (c: Customer) => void;
  onDelete: (c: Customer) => void;
}

export const CustomerCard: React.FC<Props> = ({
  customer: c, sanCount, isDuplicate, duplicateReason, onEdit, onHistory, onDelete,
}) => {
  const type = getPersonType(c);
  const Icon = type === 'PF' ? User : Building2;

  return (
    <Card
      className={[
        'group relative overflow-hidden border bg-card',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-md)]',
        isDuplicate ? 'ring-1 ring-warning/60 border-warning/40' : '',
      ].join(' ')}
    >
      {/* Acento lateral sutil */}
      <span
        aria-hidden
        className={[
          'absolute inset-y-0 left-0 w-0.5 transition-colors',
          isDuplicate
            ? 'bg-warning'
            : 'bg-transparent group-hover:bg-primary/60',
        ].join(' ')}
      />

      {isDuplicate && (
        <div
          className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-warning-soft text-warning-foreground border border-warning/30 px-2 py-0.5 text-[10px] font-medium"
          title={duplicateReason}
        >
          <AlertTriangle className="h-3 w-3" />
          {duplicateReason || 'Duplicado'}
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center ring-1 ring-primary/10">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-tight tracking-tight truncate text-foreground">
              {c.customerName || <span className="italic text-muted-foreground font-normal">Sem nome</span>}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] font-medium tracking-wide uppercase border-border/80 text-muted-foreground"
              >
                {type}
              </Badge>
              {c.document && (
                <span className="text-[11px] font-mono text-muted-foreground/90 truncate">
                  {maskDocument(c.document, type)}
                </span>
              )}
            </div>
          </div>
          {sanCount > 0 && (
            <div className="shrink-0 flex flex-col items-end leading-none">
              <span className="text-base font-semibold tabular-nums text-info">{sanCount}</span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                sanitário{sanCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Endereço + contato */}
        <dl className="space-y-1.5 text-xs">
          {c.address && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
              <span className="line-clamp-2 leading-snug">
                {c.address}
                {c.cidade ? `, ${c.cidade}${c.estado ? `/${c.estado}` : ''}` : ''}
              </span>
            </div>
          )}
          {c.contactPhone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{c.contactPhone}</span>
            </div>
          )}
          {c.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{c.email}</span>
            </div>
          )}
        </dl>

        {/* Actions */}
        <div className="flex items-center gap-1 pt-3 border-t border-border/60">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 h-8 gap-1.5 text-xs font-medium hover:bg-primary/5 hover:text-primary transition-colors"
            onClick={() => onEdit(c)}
          >
            <Edit3 className="h-3.5 w-3.5" />Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 h-8 gap-1.5 text-xs font-medium hover:bg-accent transition-colors"
            onClick={() => onHistory(c)}
          >
            <History className="h-3.5 w-3.5" />Histórico
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={() => onDelete(c)}
            aria-label="Remover cliente"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
