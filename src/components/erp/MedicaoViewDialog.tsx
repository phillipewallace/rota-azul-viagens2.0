/**
 * Visualização somente leitura de uma medição já gravada. Mostra cliente,
 * itens, totais e observações. Botão principal: baixar PDF.
 */
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { medicoesService, type Medicao } from '@/services/medicoes';
import { generateMedicaoPdf } from '@/utils/medicaoPdf';
import { formatDateBR, formatPeriodo } from '@/utils/dateFormat';

import { BRL } from '@/utils/currency';

interface Props {
  medicaoId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit?: (m: Medicao) => void;
}

export const MedicaoViewDialog: React.FC<Props> = ({ medicaoId, open, onOpenChange, onEdit }) => {
  const [loading, setLoading] = useState(false);
  const [m, setM] = useState<Medicao | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open || !medicaoId) { setM(null); return; }
    setLoading(true);
    medicoesService.get(medicaoId)
      .then(setM)
      .catch((e) => toast.error(e.message || 'Erro ao carregar medição'))
      .finally(() => setLoading(false));
  }, [open, medicaoId]);

  const download = async () => {
    if (!m || !m.items) return;
    setDownloading(true);
    try {
      await generateMedicaoPdf(m as Medicao & { items: any[] });
    } catch (e: any) { toast.error(e.message || 'Erro ao gerar PDF'); }
    finally { setDownloading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Medição {m?.numero || '…'}
            {m?.competencia && <Badge variant="outline">{m.competencia}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {m?.periodoInicio || m?.periodoFim
              ? `Período: ${formatPeriodo(m?.periodoInicio, m?.periodoFim)}`
              : 'Documento de conferência (pré-recibo).'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm">
          {loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>}
          {m && !loading && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Cliente</div>
                  <div className="font-medium">{m.customerName || m.clienteNome || '—'}</div>
                  <div className="text-xs text-muted-foreground">{m.customerDocument || m.clienteDocumento || ''}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Empresa emissora</div>
                  <div className="font-medium">{m.companyRazaoSocial || '—'}</div>
                  <div className="text-xs text-muted-foreground">{m.companyCnpj || ''}</div>
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-2 py-2 w-8">#</th>
                      <th className="px-2 py-2">Descrição</th>
                      <th className="px-2 py-2 w-32">Período</th>
                      <th className="px-2 py-2 w-16">Qtd</th>
                      <th className="px-2 py-2 w-24 text-right">V. Unit.</th>
                      <th className="px-2 py-2 w-20 text-right">Desc.</th>
                      <th className="px-2 py-2 w-24 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(m.items || []).map((it, idx) => (
                      <tr key={it.id || idx} className="border-t">
                        <td className="px-2 py-1">{idx + 1}</td>
                        <td className="px-2 py-1">
                          {it.contractNumero && <div className="text-[10px] text-muted-foreground">Contrato {it.contractNumero}</div>}
                          {it.descricao}
                        </td>
                        <td className="px-2 py-1 text-xs">
                          {(it.periodoInicio || it.periodoFim) ? formatPeriodo(it.periodoInicio, it.periodoFim) : '—'}
                        </td>
                        <td className="px-2 py-1">{Number(it.quantidade || 0)} {it.unidade || ''}</td>
                        <td className="px-2 py-1 text-right">{BRL(Number(it.valorUnit || 0))}</td>
                        <td className="px-2 py-1 text-right">{Number(it.descontoItem || 0) > 0 ? `- ${BRL(Number(it.descontoItem))}` : '—'}</td>
                        <td className="px-2 py-1 text-right font-medium">{BRL(Number(it.valorTotal || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  {m.observacoes && (
                    <>
                      <div className="text-xs text-muted-foreground mb-1">Observações</div>
                      <div className="rounded border p-3 whitespace-pre-wrap text-xs">{m.observacoes}</div>
                    </>
                  )}
                </div>
                <div className="rounded border p-3 bg-muted/20 space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span>{BRL(Number(m.subtotal || 0))}</span></div>
                  {Number(m.desconto || 0) > 0 && (
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Desconto</span><span>- {BRL(Number(m.desconto))}</span></div>
                  )}
                  <div className="flex justify-between text-base border-t pt-2 mt-1">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-primary">{BRL(Number(m.total || 0))}</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Gerada em {formatDateBR(m.createdAt)} {m.createdBy ? `· por ${m.createdBy}` : ''}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {m && onEdit && (
            <Button variant="outline" onClick={() => onEdit(m)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          )}
          <Button onClick={download} disabled={!m || downloading}>
            {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
