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
