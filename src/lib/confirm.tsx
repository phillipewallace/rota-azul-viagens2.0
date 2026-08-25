/**
 * Diálogo de confirmação global — substitui o `window.confirm` nativo por uma
 * UI consistente do design system (shadcn + tokens HSL).
 *
 * Uso:
 *   import { confirmDialog } from '@/lib/confirm';
 *
 *   if (!(await confirmDialog({
 *     title: 'Excluir orçamento?',
 *     description: 'Esta ação não pode ser desfeita.',
 *     destructive: true,
 *   }))) return;
 *
 * Monte `<ConfirmHost />` uma única vez (já feito em `App.tsx`).
 */
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Pending = ConfirmOptions & { resolve: (v: boolean) => void };

const EVENT = 'app:confirm-open';

/** Abre o diálogo e resolve com `true` se o usuário confirmou. */
export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const normalized: ConfirmOptions = typeof opts === 'string' ? { description: opts } : opts;
  return new Promise<boolean>((resolve) => {
    const detail: Pending = { ...normalized, resolve };
    window.dispatchEvent(new CustomEvent(EVENT, { detail }));
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Pending>).detail;
      // Se já houver um diálogo aberto, resolve o antigo como falso antes de abrir o novo.
      setPending((prev) => {
        prev?.resolve(false);
        return detail;
      });
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const close = (value: boolean) => {
    if (!pending) return;
    pending.resolve(value);
    setPending(null);
  };

  return (
    <AlertDialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold leading-tight">
            {pending?.title ?? (pending?.destructive ? 'Confirmar exclusão' : 'Confirmar ação')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {pending?.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            onClick={() => close(false)}
            className="transition-colors duration-200"
          >
            {pending?.cancelLabel ?? 'Cancelar'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={cn(
              'transition-colors duration-200',
              pending?.destructive &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive'
            )}
          >
            {pending?.confirmLabel ?? (pending?.destructive ? 'Excluir' : 'Confirmar')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
