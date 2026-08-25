/**
 * Dialog que confirma a criação/edição quando o documento bate
 * com outro cliente já cadastrado. Mostra ambos lado a lado.
 */
import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Customer } from '@/hooks/useCustomers';
import { maskDocument } from '@/utils/brazilianDocs';
import { getPersonType } from '@/utils/customerHelpers';

interface Props {
  open: boolean;
  existing: Customer | null;
  attempted: Customer | null;
  saving: boolean;
  onCancel: () => void;
  onProceed: () => void;
}

const CustomerSummary: React.FC<{ title: string; c: Customer; tone: 'existing' | 'new' }> = ({ title, c, tone }) => {
  const type = getPersonType(c);
  return (
    <div className={`rounded-lg border p-3 space-y-1 ${tone === 'existing' ? 'bg-muted/40' : 'bg-amber-50 border-amber-200'}`}>
      <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{title}</div>
      <div className="font-semibold text-sm">{c.customerName || <em>sem nome</em>}</div>
      {c.document && (
        <div className="text-[11px] font-mono text-muted-foreground">
          {type} · {maskDocument(c.document, type)}
        </div>
      )}
      {c.email && <div className="text-xs text-muted-foreground truncate">{c.email}</div>}
      {c.contactPhone && <div className="text-xs text-muted-foreground">{c.contactPhone}</div>}
      {c.address && (
        <div className="text-xs text-muted-foreground line-clamp-2">
          {c.address}{c.cidade ? `, ${c.cidade}/${c.estado || ''}` : ''}
        </div>
      )}
    </div>
  );
};

export const CustomerDuplicateDialog: React.FC<Props> = ({
  open, existing, attempted, saving, onCancel, onProceed,
}) => (
  <Dialog open={open} onOpenChange={o => !o && !saving && onCancel()}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
          Documento já cadastrado
        </DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        Já existe um cliente com este documento. Você pode prosseguir mesmo assim —
        os dois ficarão cadastrados com <strong>IDs diferentes</strong>.
      </p>
      {existing && attempted && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <CustomerSummary title="Já cadastrado" c={existing} tone="existing" />
          <CustomerSummary title="Você está salvando" c={attempted} tone="new" />
        </div>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button
          onClick={onProceed}
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Salvando…</> : 'Salvar mesmo assim'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
