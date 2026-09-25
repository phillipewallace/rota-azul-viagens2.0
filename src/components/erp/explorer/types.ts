import type { ErpDocument, ErpFolder } from '@/services/erp';

/** MIME interno para arrastar a seleção (documentos e/ou pastas) até um destino. */
export const DOC_DRAG_MIME = 'application/x-erp-docs';

/** Uma linha do conteúdo do Explorer: pasta ou documento. */
export type ExplorerEntry =
  | { kind: 'folder'; id: string; folder: ErpFolder }
  | { kind: 'doc'; id: string; doc: ErpDocument };

/** Alvo do menu de contexto (botão direito). */
export type CtxTarget =
  | { kind: 'docs'; ids: string[] }
  | { kind: 'folder'; folder: ErpFolder }
  | { kind: 'empty' }
  | { kind: 'treeRoot' };

/** Modo de exibição do conteúdo: lista (detalhes) ou grade de ícones. */
export type ViewMode = 'grid' | 'details';

/** Coluna de ordenação da view de detalhes. */
export type SortKey = 'nome' | 'data' | 'tipo' | 'empresa';

/** Tamanho dos ícones na grade — os "4 quadradinhos" do Explorer. */
export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

export const VIEW_MODES: ViewMode[] = ['details', 'grid'];
export const ICON_SIZES: IconSize[] = ['sm', 'md', 'lg', 'xl'];

/** Grade de colunas por tamanho de ícone (responsiva por breakpoint). */
export const ICON_GRID: Record<IconSize, string> = {
  sm: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10',
  md: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  lg: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  xl: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
};

/** Caixa do ícone (em px) por tamanho. */
export const ICON_BOX: Record<IconSize, { box: string; icon: string }> = {
  sm: { box: 'h-10 w-10', icon: 'h-5 w-5' },
  md: { box: 'h-16 w-16', icon: 'h-9 w-9' },
  lg: { box: 'h-24 w-24', icon: 'h-14 w-14' },
  xl: { box: 'h-32 w-32', icon: 'h-20 w-20' },
};
