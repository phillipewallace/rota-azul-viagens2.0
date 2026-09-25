import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

export interface FolderNameState {
  mode: 'create' | 'rename';
  /** null = raiz; string = id do pai (create). */
  parentId?: string | null;
  /** Pasta alvo (rename). */
  folderId?: string;
  nome: string;
}

interface Props {
  state: FolderNameState | null;
  /** Nome do pai para o subtítulo (create). */
  parentLabel?: string;
  saving: boolean;
  onChange: (nome: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

/** Diálogo único criar/renomear pasta (usado pela toolbar, árvore e menu de contexto). */
const FolderNameDialog: React.FC<Props> = ({ state, parentLabel, saving, onChange, onSubmit, onClose }) => (
  <Dialog open={!!state} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{state?.mode === 'create' ? 'Nova pasta' : 'Renomear pasta'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-2 py-1">
        <Label>Nome</Label>
        <Input
          autoFocus
          value={state?.nome || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex: Contratos 2026"
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
        />
        {state?.mode === 'create' && parentLabel && (
          <p className="text-xs text-muted-foreground">
            Será criada em: <b>{parentLabel}</b>
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={onSubmit} disabled={saving || !(state?.nome || '').trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default FolderNameDialog;
