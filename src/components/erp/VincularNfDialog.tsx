/**
 * Diálogo para vincular uma Nota Fiscal já emitida no portal do governo
 * a um contrato + competência. Substitui o fluxo antigo do botão
 * "Marcar pago" na aba Pendentes.
 */
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Loader2, Upload, CheckCircle2 } from 'lucide-react';
import {
  invoicesService, INVOICE_FORMA_LABEL,
  type InvoiceFormaPagamento,
} from '@/services/invoices';
import type { PendingReceipt } from '@/services/contracts';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pending: PendingReceipt | null;
  competencia: string;              // YYYY-MM da tela
  onSuccess?: (result: { contractId: string; competencia: string }) => void;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const VincularNfDialog: React.FC<Props> = ({
  open, onOpenChange, pending, competencia, onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [numero, setNumero] = useState('');
  const [serie, setSerie] = useState('');
  const [dataEmissao, setDataEmissao] = useState(todayISO());
  const [valor, setValor] = useState('');
  // Vazio como default — evita gravar "pix" silenciosamente quando o usuário
  // não interage. Validado no submit.
  const [formaPagamento, setFormaPagamento] = useState<InvoiceFormaPagamento | ''>('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  const MAX_FILE_MB = 50;

  useEffect(() => {
    if (open && pending) {
      setFile(null);
      setNumero('');
      setSerie('');
      setDataEmissao(todayISO());
      setValor(String(Number(pending.valorMensal || 0).toFixed(2)));
      setFormaPagamento('');
      setObservacoes('');
    }
  }, [open, pending]);

  if (!pending) return null;

  const handleFileChange = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (!/pdf/i.test(f.type) && !/\.pdf$/i.test(f.name)) {
      toast.error('Somente PDF é aceito.');
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB). Máximo: ${MAX_FILE_MB} MB.`);
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!file)                { toast.error('Selecione o PDF da nota fiscal.'); return; }
    if (!numero.trim())       { toast.error('Informe o número da NF.'); return; }
    if (!dataEmissao)         { toast.error('Informe a data de emissão.'); return; }
    if (!formaPagamento)      { toast.error('Selecione a forma de pagamento.'); return; }
    const val = Number(valor.replace(',', '.'));
    if (!(val > 0))           { toast.error('Valor inválido.'); return; }

    setSaving(true);
    try {
      const result = await invoicesService.create({
        file,
        contractId: pending.contractId,
        competencia,
        numero: numero.trim(),
        serie: serie.trim() || undefined,
        dataEmissao,
        valor: val,
        formaPagamento: formaPagamento as InvoiceFormaPagamento,
        observacoes: observacoes.trim() || undefined,
      });
      toast.success(`NF ${numero.trim()} vinculada ao contrato ${pending.contractNumero}`);
      onOpenChange(false);
      onSuccess?.({ contractId: result.contractId, competencia: result.competencia });
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao vincular nota fiscal');
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Vincular Nota Fiscal
          </DialogTitle>
          <DialogDescription>
            Anexe a NF emitida no portal do governo. O contrato{' '}
            <span className="font-semibold text-foreground">{pending.contractNumero}</span>
            {' '}será marcado como faturado na competência{' '}
            <span className="font-semibold text-foreground">{competencia.split('-').reverse().join('/')}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/40 border px-3 py-2 text-xs text-muted-foreground">
            <div><span className="font-medium text-foreground">Cliente:</span> {pending.customerName || '—'}</div>
            <div><span className="font-medium text-foreground">Empresa:</span> {pending.companyRazaoSocial || '—'}</div>
          </div>

          <div>
            <Label className="text-xs">PDF da Nota Fiscal *</Label>
            <div className="mt-1 flex items-center gap-2">
              <label className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-dashed border-border hover:border-primary/60 hover:bg-muted/40 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">
                    {file ? file.name : 'Selecionar PDF...'}
                  </span>
                </div>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </label>

              {file && (
                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Número da NF *</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex.: 000123" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Série</Label>
              <Input value={serie} onChange={(e) => setSerie(e.target.value)}
                placeholder="Ex.: 1" className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data de emissão *</Label>
              <Input type="date" value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Valor (R$) *</Label>
              <Input inputMode="decimal" value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00" className="h-9" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Forma de pagamento *</Label>
            <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as InvoiceFormaPagamento)}>
              <SelectTrigger className="h-9" aria-invalid={!formaPagamento}>
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INVOICE_FORMA_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Opcional — anotações internas sobre esta NF"
              className="min-h-[64px]" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
              : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Vincular NF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
