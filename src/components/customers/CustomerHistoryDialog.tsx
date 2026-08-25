/**
 * Dialog de histórico do cliente (sanitários atuais + movimentações).
 * Faz fetch interno quando recebe um cliente.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, PackageCheck, PackageOpen, RefreshCcw, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Customer } from '@/hooks/useCustomers';
import { API_BASE_URL } from '@/services/config';

interface HistoryItem {
  id: string;
  sanitario_numero: string;
  operation_type: string;
  address?: string;
  driver_name?: string;
  occurred_at: string;
  notes?: string;
}
interface CurrentSan {
  id: string;
  numero: string;
  status: string;
  current_address?: string;
  installed_at?: string;
}
interface HistoryPayload { current: CurrentSan[]; history: HistoryItem[] }

const opIcon = (op: string) => {
  switch (op) {
    case 'entrega': return <PackageOpen className="h-3.5 w-3.5 text-blue-600" />;
    case 'recolhimento': return <PackageCheck className="h-3.5 w-3.5 text-green-600" />;
    case 'manutencao': return <Wrench className="h-3.5 w-3.5 text-orange-600" />;
    default: return <RefreshCcw className="h-3.5 w-3.5 text-gray-500" />;
  }
};

interface Props {
  customer: Customer | null;
  onClose: () => void;
}

export const CustomerHistoryDialog: React.FC<Props> = ({ customer, onClose }) => {
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer) { setData(null); return; }
    let canceled = false;
    setLoading(true);
    (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const r = await fetch(`${API_BASE_URL}/customers/${customer.id}/history`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) throw new Error('Erro ao carregar histórico');
        const payload = (await r.json()) as HistoryPayload;
        if (!canceled) setData(payload);
      } catch (e) {
        if (!canceled) toast.error(e instanceof Error ? e.message : 'Erro ao carregar histórico');
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [customer]);

  return (
    <Dialog open={!!customer} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico — {customer?.customerName}</DialogTitle>
        </DialogHeader>
        {loading && <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />}
        {data && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <section>
              <h3 className="text-sm font-semibold mb-2">
                Sanitários alocados agora ({data.current.length})
              </h3>
              {data.current.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum sanitário no momento.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {data.current.map(s => (
                    <div key={s.id} className="border rounded-md p-2 text-xs bg-blue-50/40">
                      <div className="font-mono font-bold">{s.numero}</div>
                      {s.installed_at && (
                        <div className="text-muted-foreground">
                          desde {new Date(s.installed_at).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Movimentações ({data.history.length})</h3>
              {data.history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem registros.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.history.map(h => (
                    <div key={h.id} className="border rounded-md p-2 text-xs flex items-start gap-2">
                      {opIcon(h.operation_type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold capitalize">{h.operation_type}</span>
                          <span className="font-mono text-muted-foreground">#{h.sanitario_numero}</span>
                          <span className="ml-auto text-muted-foreground">
                            {new Date(h.occurred_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {h.driver_name && <div className="text-muted-foreground">Motorista: {h.driver_name}</div>}
                        {h.notes && <div className="italic">{h.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
