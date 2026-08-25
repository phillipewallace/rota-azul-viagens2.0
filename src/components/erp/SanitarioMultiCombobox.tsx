/**
 * Combobox múltiplo + busca, lista sanitários disponíveis (status='disponivel')
 * permitindo navegar com teclado e selecionar vários para entrega.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, X, RefreshCcw } from 'lucide-react';
import { API_BASE_URL } from '@/services/config';
import { toast } from 'sonner';

interface Item { id: string; numero: string; modelo?: string | null }

const authHeaders = (): HeadersInit => {
  const t = localStorage.getItem('auth_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}

export default function SanitarioMultiCombobox({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/sanitarios`);
      url.searchParams.set('status', 'disponivel');
      url.searchParams.set('pageSize', '500');
      const r = await fetch(url.toString(), { headers: authHeaders() });
      const d = await r.json();
      const rows: Item[] = Array.isArray(d) ? d : (d.data || []);
      setList(rows);
    } catch { toast.error('Erro ao carregar sanitários disponíveis'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = list.filter(it => !value.includes(it.numero));
    if (!s) return base;
    return base.filter(it =>
      it.numero.toLowerCase().includes(s) ||
      (it.modelo || '').toLowerCase().includes(s)
    );
  }, [list, q, value]);

  const toggle = (numero: string) => {
    if (value.includes(numero)) onChange(value.filter(v => v !== numero));
    else onChange([...value, numero]);
  };

  const addManual = () => {
    const v = q.trim().toUpperCase();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setQ('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 min-h-[34px] border rounded-md p-1.5 bg-background">
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground px-1 py-0.5">Nenhum sanitário selecionado</span>
        )}
        {value.map(n => (
          <Badge key={n} variant="secondary" className="font-mono gap-1">
            {n}
            <button type="button" onClick={() => onChange(value.filter(v => v !== n))}
                    className="hover:text-red-600">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button ref={triggerRef} type="button" variant="outline" role="combobox"
                    className="flex-1 justify-between font-normal">
              {placeholder || 'Selecione ou digite o número…'}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0" style={{ width: triggerRef.current?.offsetWidth }} align="start">
            <Command shouldFilter={false}>
              <CommandInput value={q} onValueChange={setQ}
                            placeholder="Digite para buscar ou cadastrar novo…"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && filtered.length === 0 && q.trim()) {
                                e.preventDefault();
                                addManual();
                              }
                            }} />
              <CommandList className="max-h-64">
                {loading && <div className="p-3 text-xs text-muted-foreground">Carregando…</div>}
                {!loading && filtered.length === 0 && (
                  <CommandEmpty>
                    <div className="text-xs space-y-1">
                      <div>Nenhum disponível encontrado.</div>
                      {q.trim() && (
                        <button type="button" onClick={addManual}
                                className="text-primary underline">
                          Adicionar "{q.trim().toUpperCase()}" manualmente
                        </button>
                      )}
                    </div>
                  </CommandEmpty>
                )}
                {!loading && filtered.length > 0 && (
                  <CommandGroup heading={`${filtered.length} disponível(is)`}>
                    {filtered.map(it => (
                      <CommandItem key={it.id} value={it.numero}
                                   onSelect={() => { toggle(it.numero); setQ(''); }}>
                        <Check className={`mr-2 h-4 w-4 ${value.includes(it.numero) ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="font-mono font-semibold">{it.numero}</span>
                        {it.modelo && <span className="ml-2 text-xs text-muted-foreground">{it.modelo}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button type="button" variant="ghost" size="icon" onClick={load} disabled={loading} title="Atualizar lista" aria-label="Atualizar lista de sanitários" className="transition-colors duration-200">
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
