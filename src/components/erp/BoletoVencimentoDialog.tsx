/**
 * Modal de geração do contrato.
 *
 * Formatos:
 *  • PDF (padrão)           — pronto para assinatura/envio.
 *  • Pré-visualização PDF   — abre em nova aba sem baixar.
 *  • Word (.doc) editável   — para ajustes pontuais em contratos atípicos.
 *
 * Regra fixa: para BOLETO o vencimento é sempre 28 dias após a data de entrega.
 * Para PIX/cartão não há vencimento.
 */
import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarClock, FileText, Eye, FileType2, Loader2 } from 'lucide-react';
import {
  calcVencimentoBoleto, describeFormaPagamento,
  FORMA_PAGAMENTO_LABEL, type FormaPagamento,
} from '@/utils/fixedObservations';
import { formatDateBR } from '@/utils/dateFormat';

export type ContractExportFormat = 'pdf' | 'docx';
export type ContractExportAction = 'preview' | 'pdf' | 'docx';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * `preview` mantido por compatibilidade (true = pré-visualização PDF).
   * `format`  indica o arquivo escolhido: 'pdf' (download) ou 'docx' (Word editável).
   */
  onConfirm: (data: {
    dataVencimento: string;
    preview: boolean;
    format: ContractExportFormat;
  }) => void | Promise<void>;
  contractLabel?: string;
  formaPagamento?: FormaPagamento | string | null;
  dataEntrega?: string | null;
}

export function BoletoVencimentoDialog({
  open, onClose, onConfirm, contractLabel, formaPagamento, dataEntrega,
}: Props) {
  const forma = (formaPagamento || 'boleto') as FormaPagamento;
  const isBoleto = forma === 'boleto';
  const vencimento = useMemo(() => calcVencimentoBoleto(dataEntrega), [dataEntrega]);

  const [busy, setBusy] = useState<ContractExportAction | null>(null);

  const run = async (action: ContractExportAction) => {
    if (busy) return;
    setBusy(action);
    try {
      await onConfirm({
        dataVencimento: isBoleto ? vencimento : '',
        preview: action === 'preview',
        format: action === 'docx' ? 'docx' : 'pdf',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden sm:max-w-xl w-[calc(100vw-2rem)]"
      >
        {/* Cabeçalho com fundo de marca sutil */}
        <div className="bg-gradient-to-br from-primary/[0.06] via-accent/40 to-transparent px-6 pt-6 pb-5 border-b border-border/60">
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                <CalendarClock className="h-[18px] w-[18px]" />
              </span>
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                Gerar contrato
              </DialogTitle>
            </div>
            <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
              {contractLabel
                ? <>Escolha o formato para <span className="font-medium text-foreground">{contractLabel}</span>.</>
                : 'Escolha o formato do arquivo. O Word é útil para ajustes pontuais.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Corpo: forma de pagamento + regra de vencimento */}
        <div className="px-6 py-5 space-y-3">
          <div className="rounded-lg border border-border/70 bg-muted/40 px-3.5 py-2.5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Forma de pagamento
            </div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">
              {FORMA_PAGAMENTO_LABEL[forma] || String(forma)}
            </div>
          </div>

          {isBoleto ? (
            <div className="rounded-lg border border-info/25 bg-[hsl(var(--info-soft))] px-3.5 py-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--info-foreground))]/75">
                Vencimento do boleto
              </div>
              <div className="mt-0.5 text-sm font-semibold text-[hsl(var(--info-foreground))]">
                {formatDateBR(vencimento)}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-[hsl(var(--info-foreground))]/80">
                Sempre 28 dias após a data de entrega
                {dataEntrega
                  ? <> ({formatDateBR(dataEntrega)}).</>
                  : <> — entrega ainda não preenchida; usando hoje como referência.</>}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-success/25 bg-[hsl(var(--success-soft))] px-3.5 py-2.5 text-[12px] leading-snug text-[hsl(var(--success-foreground))]">
              {describeFormaPagamento(forma, dataEntrega)}
            </div>
          )}
        </div>

        {/* Rodapé de ações — layout que acomoda os 4 botões sem cortar */}
        <DialogFooter
          className="flex flex-col-reverse gap-2 border-t border-border/60 bg-muted/30 px-5 py-3.5 sm:flex-row sm:flex-wrap sm:justify-end sm:items-center sm:gap-2 sm:space-x-0"
        >
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={!!busy}
            className="h-9 px-3 text-muted-foreground hover:text-foreground transition-colors duration-200 sm:mr-auto"
          >
            Cancelar
          </Button>

          <Button
            variant="outline"
            onClick={() => run('preview')}
            disabled={!!busy}
            className="h-9 gap-1.5 px-3 border-border/70 hover:bg-accent hover:text-accent-foreground hover:border-border focus-visible:ring-ring/60 active:scale-[.98] transition-all duration-200"
          >
            {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Pré-visualizar
          </Button>

          <Button
            variant="outline"
            onClick={() => run('docx')}
            disabled={!!busy}
            title="Baixar contrato como Word (.doc) para editar manualmente"
            className="h-9 gap-1.5 px-3 border-border/70 hover:bg-accent hover:text-accent-foreground hover:border-border focus-visible:ring-ring/60 active:scale-[.98] transition-all duration-200"
          >
            {busy === 'docx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType2 className="h-4 w-4" />}
            Word (.doc)
          </Button>

          <Button
            onClick={() => run('pdf')}
            disabled={!!busy}
            className="h-9 gap-1.5 px-4 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md focus-visible:ring-ring/70 active:scale-[.98] active:shadow-sm transition-all duration-200"
          >
            {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
