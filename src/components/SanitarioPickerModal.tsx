/**
 * Modal para escolher um sanitário já alocado em cliente e puxar
 * seus dados (cliente + endereço + coordenadas + número) para um
 * novo ponto na rota — facilita o recolhimento sem redigitar.
 */
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin } from 'lucide-react';
import { API_BASE_URL } from '@/services/config';
import { toast } from 'sonner';

export interface AllocatedSanitario {
  id: string;
  numero: string;
  current_customer_name?: string;
  current_address?: string;
  current_lat?: number;
  current_lng?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** chamado ao confirmar — recebe os dados do sanitário escolhido */
  onPick: (s: AllocatedSanitario) => void;
}

const authHeaders = (): HeadersInit => {
  const t = localStorage.getItem('auth_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export default function SanitarioPickerModal({ open, onOpenChange, onPick }: Props) {
  const [list, setList] = useState<AllocatedSanitario[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPicked('');
    setQ('');
    const url = new URL(`${API_BASE_URL}/sanitarios`);
    url.searchParams.set('status', 'em_cliente');
    url.searchParams.set('pageSize', '200');
    fetch(url.toString(), { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : (d.data || [])))
      .catch(() => toast.error('Erro ao carregar sanitários alocados'))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(x =>
      (x.numero || '').toLowerCase().includes(s) ||
      (x.current_customer_name || '').toLowerCase().includes(s) ||
      (x.current_address || '').toLowerCase().includes(s),
    );
  }, [list, q]);

  const confirm = () => {
    const s = list.find(x => x.id === picked);
    if (!s) return;
    onPick(s);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Puxar sanitário alocado</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Número, cliente ou endereço…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto border rounded-md divide-y">
            {loading && <div className="p-3 text-xs text-muted-foreground">Carregando…</div>}
            {!loading && filtered.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground">
                Nenhum sanitário em cliente. Aloque um sanitário na aba Sanitários primeiro.
              </div>
            )}
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setPicked(s.id)}
                className={`w-full text-left p-2 hover:bg-muted/30 ${picked === s.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm">{s.numero}</span>
                  <span className="text-sm font-medium truncate">{s.current_customer_name || '—'}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {s.current_address || '—'}
                </div>
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={!picked}>Adicionar à rota</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
