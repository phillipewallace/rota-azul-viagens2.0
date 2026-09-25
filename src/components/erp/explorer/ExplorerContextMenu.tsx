import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface CtxMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Desenhada como separador — o item em si é ignorado. */
  separator?: boolean;
}

interface Props {
  /** Posição do clique (clientX/clientY). */
  x: number;
  y: number;
  /** Cabeçalho opcional (ex.: nome do documento). */
  header?: React.ReactNode;
  items: CtxMenuItem[];
  onClose: () => void;
}

/**
 * Menu de contexto estilo Windows Explorer:
 * - abre exatamente no clique, com clamp na viewport (nunca sai da tela);
 * - fecha com clique esquerdo/direito fora, scroll, resize ou Esc;
 * - stopPropagation dos cliques internos (não fecha ao acionar um item).
 */
const ExplorerContextMenu: React.FC<Props> = ({ x, y, header, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });

  // Clamp da posição usando o tamanho real do menu (após montar).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(Math.max(4, x), Math.max(4, window.innerWidth - rect.width - 6));
    const top = Math.min(Math.max(4, y), Math.max(4, window.innerHeight - rect.height - 6));
    setPos({ top, left });
  }, [x, y, items]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      // Botão direito fora do menu fecha ANTES do próximo contextmenu abrir
      // (evita que o React batch anule a abertura do novo menu).
      if (e.button === 2) {
        if (ref.current && ref.current.contains(e.target as Node)) return;
        onClose();
        return;
      }
      if (e.button !== 0) return;
      if (ref.current && ref.current.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // Mousedown cobre clique esquerdo E direito fora; click dos itens é
    // stopPropagation no container, então não fecha antes da ação.
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[70] min-w-[210px] rounded-md border bg-white py-1 text-sm shadow-xl"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {header && (
        <div className="px-3 py-1.5 border-b mb-1">{header}</div>
      )}
      {items.map((it, i) =>
        it.separator ? (
          <div key={`sep-${i}`} className="my-1 border-t" />
        ) : (
          <button
            key={`${it.label}-${i}`}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => { it.onClick?.(); onClose(); }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent
              ${it.danger ? 'text-red-600 hover:bg-red-50' : ''}`}
          >
            {it.icon && <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{it.icon}</span>}
            <span className="truncate">{it.label}</span>
          </button>
        ),
      )}
    </div>
  );
};

export default ExplorerContextMenu;
