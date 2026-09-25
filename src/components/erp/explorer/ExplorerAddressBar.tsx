import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, ChevronRight, FolderOpen, Loader2, Search, X } from 'lucide-react';
import type { ErpFolder } from '@/services/erp';

interface Props {
  /** Caminho da pasta atual (raiz implícita "Documentos"). */
  path: ErpFolder[];
  canBack: boolean;
  canForward: boolean;
  canUp: boolean;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onNavigate: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  loading?: boolean;
}

/** Barra de endereço estilo Explorer: voltar/avançar/subir + breadcrumb + busca. */
const ExplorerAddressBar: React.FC<Props> = ({
  path, canBack, canForward, canUp, onBack, onForward, onUp, onNavigate,
  search, onSearchChange, loading,
}) => (
  <div className="flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5">
    <Button
      size="icon" variant="ghost" className="h-8 w-8" title="Voltar"
      disabled={!canBack} onClick={onBack}
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
    <Button
      size="icon" variant="ghost" className="h-8 w-8" title="Avançar"
      disabled={!canForward} onClick={onForward}
    >
      <ArrowRight className="h-4 w-4" />
    </Button>
    <Button
      size="icon" variant="ghost" className="h-8 w-8" title="Subir um nível"
      disabled={!canUp} onClick={onUp}
    >
      <ChevronRight className="h-4 w-4 rotate-[-90deg]" />
    </Button>

    <nav className="flex items-center gap-0.5 min-w-0 flex-1 overflow-x-auto" aria-label="Caminho das pastas">
      <button
        type="button"
        onClick={() => onNavigate('root')}
        title="Raiz — documentos sem pasta"
        className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-slate-100 text-slate-700 shrink-0"
      >
        <FolderOpen className="h-4 w-4 text-indigo-600" />
        <span className="text-sm font-medium">Documentos</span>
      </button>
      {path.map((f) => (
        <React.Fragment key={f.id}>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <button
            type="button"
            onClick={() => onNavigate(f.id)}
            className="rounded px-1.5 py-1 hover:bg-slate-100 truncate max-w-[180px] text-sm text-slate-700 shrink-0"
            title={f.nome}
          >
            {f.nome}
          </button>
        </React.Fragment>
      ))}
    </nav>

    <div className="relative shrink-0 w-44 sm:w-64">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Pesquisar em Documentos"
        className="h-8 pl-8 pr-7"
      />
      {loading ? (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : search ? (
        <button
          type="button"
          onClick={() => onSearchChange('')}
          title="Limpar busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  </div>
);

export default ExplorerAddressBar;
