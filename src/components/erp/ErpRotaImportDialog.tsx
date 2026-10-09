/**
 * Modal para importar rotas a partir de uma planilha Excel.
 * Cada ABA do arquivo vira uma rota; cada LINHA vira um ponto.
 * Mostra um preview antes de importar e permite escolher quais abas importar.
 */
import React, { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, Check } from 'lucide-react';
import { parseRotasWorkbook, ParsedRota, FIELD_LABELS } from '@/utils/rotasExcelParser';
import { toast } from 'sonner';

interface ErpRotaImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rotas: ParsedRota[]) => Promise<void>;
}

const ErpRotaImportDialog: React.FC<ErpRotaImportDialogProps> = ({
  open, onOpenChange, onImport,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRota[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState('');

  const reset = () => {
    setParsed(null);
    setSelected(new Set());
    setFileName('');
    setParseError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setParseError('');
    try {
      const buf = await file.arrayBuffer();
      const rotas = parseRotasWorkbook(buf);
      if (!rotas.length) {
        setParseError('Nenhuma aba com dados foi encontrada no arquivo.');
        setParsed(null);
        return;
      }
      setParsed(rotas);
      setFileName(file.name);
      setSelected(new Set(rotas.map((r) => r.sheetName)));
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err);
      setParseError('Não foi possível ler o arquivo. Use .xlsx, .xls ou .csv.');
      setParsed(null);
    } finally {
      setIsParsing(false);
    }
  };

  const toggle = (sheetName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sheetName)) next.delete(sheetName);
      else next.add(sheetName);
      return next;
    });
  };

  const handleImport = async () => {
    if (!parsed) return;
    const chosen = parsed.filter((r) => selected.has(r.sheetName));
    if (!chosen.length) {
      toast.error('Selecione ao menos uma rota para importar');
      return;
    }
    setIsImporting(true);
    try {
      await onImport(chosen);
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao importar rotas');
    } finally {
      setIsImporting(false);
    }
  };


  const totalSelected = parsed
    ? parsed.filter((r) => selected.has(r.sheetName)).reduce((s, r) => s + r.pontos.length, 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar rotas do Excel</DialogTitle>
          <DialogDescription>
            Cada <strong>aba</strong> da planilha vira uma rota e cada <strong>linha</strong> vira um
            ponto. Os cabeçalhos são reconhecidos automaticamente (Empresa, Endereço, Limpezas,
            Banheiros, Contato, Observação...).
          </DialogDescription>
        </DialogHeader>

        {/* Área de upload */}
        <div
          className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-primary/60 hover:bg-slate-50 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFile}
          />
          {isParsing ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-sm">Lendo planilha...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-slate-700">
                {fileName ? `Arquivo: ${fileName}` : 'Clique para selecionar uma planilha'}
              </p>
              <p className="text-xs text-slate-400">Formatos aceitos: .xlsx, .xls, .csv</p>
              <Button type="button" variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" /> Escolher arquivo
              </Button>
            </div>
          )}
        </div>

        {parseError && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {parseError}
          </div>
        )}
        {/* Preview das abas encontradas */}
        {parsed && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">
                Rotas encontradas ({parsed.length})
              </p>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setSelected(new Set(parsed.map((r) => r.sheetName)))}
                >
                  Selecionar todas
                </button>
                <span className="text-slate-300">|</span>
                <button type="button" className="text-slate-500 hover:underline" onClick={() => setSelected(new Set())}>
                  Limpar
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {parsed.map((rota) => {
                const checked = selected.has(rota.sheetName);
                return (
                  <label
                    key={rota.sheetName}
                    className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(rota.sheetName)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-800 truncate">{rota.name}</span>
                        <Badge variant="secondary" className="text-[11px]">
                          {rota.pontos.length} {rota.pontos.length === 1 ? 'ponto' : 'pontos'}
                        </Badge>
                        {rota.headerRowIndex === -1 && (
                          <Badge variant="outline" className="text-[11px] text-amber-600 border-amber-300">
                            sem cabeçalho (posição)
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Mapeamento:{' '}
                        {rota.columnMap.length
                          ? rota.columnMap
                              .map((c) => `"${c.header || `col ${c.columnIndex + 1}`}" → ${FIELD_LABELS[c.field ?? 'company']}`)
                              .join(' • ')
                          : 'nenhuma coluna reconhecida'}
                      </p>
                      {/* Amostra dos 2 primeiros pontos */}
                      <div className="mt-1 space-y-0.5">
                        {rota.pontos.slice(0, 2).map((p, i) => (
                          <p key={i} className="text-xs text-slate-500 truncate">
                            {i + 1}. {p.company || '(sem empresa)'}{p.address ? ` — ${p.address}` : ''}
                          </p>
                        ))}
                        {rota.pontos.length > 2 && (
                          <p className="text-[11px] text-slate-400">+ {rota.pontos.length - 2} outros...</p>
                        )}
                      </div>
                    </div>
                    {checked && <Check className="h-4 w-4 text-primary mt-1 flex-shrink-0" />}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              Serão importados <strong>{totalSelected}</strong> {totalSelected === 1 ? 'ponto' : 'pontos'} em{' '}
              <strong>{parsed.filter((r) => selected.has(r.sheetName)).length}</strong>{' '}
              {parsed.filter((r) => selected.has(r.sheetName)).length === 1 ? 'rota' : 'rotas'}.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleImport} disabled={!parsed || isImporting || selected.size === 0}>
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" /> Importar selecionadas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ErpRotaImportDialog;

