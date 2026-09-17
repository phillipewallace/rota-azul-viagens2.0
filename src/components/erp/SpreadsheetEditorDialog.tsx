/**
 * ERP → Aba Excel — modal editor de planilha.
 * Tabela editável (adicionar/remover linhas, editar células),
 * persiste as edições no banco (PUT /spreadsheets/:id),
 * restaura o original (POST /spreadsheets/:id/parse) e
 * exporta a tabela atual como PDF (jspdf-autotable).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Save, FileDown, RotateCcw, Plus, Trash2, AlertTriangle, Check,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { erpService, type ErpSpreadsheetDetail, type ErpSpreadsheetSheet } from '@/services/erp';

interface Props {
  documentId: string | null;
  open: boolean;
  onClose: () => void;
  /** Chamado após salvar/restaurar, para a listagem recarregar. */
  onChanged?: () => void;
}

const SpreadsheetEditorDialog: React.FC<Props> = ({ documentId, open, onClose, onChanged }) => {
  const [detail, setDetail] = useState<ErpSpreadsheetDetail | null>(null);
  const [sheets, setSheets] = useState<ErpSpreadsheetSheet[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // ── Carrega os dados ao abrir ───────────────────────────────────────────────
  useEffect(() => {
    if (!open || !documentId) return;
    let alive = true;
    setLoading(true); setError(''); setSaved(false);
    erpService.getSpreadsheet(documentId)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        const s = d.sheets?.sheets ?? [];
        setSheets(s.map((x) => ({ ...x, rows: x.rows.map((r) => [...r]) })));
        setDirty(false);
        setActiveTab(0);
      })
      .catch((e) => alive && setError(e?.message || 'Erro ao carregar planilha'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [open, documentId]);

  const current = sheets[activeTab];

  // ── Edição de célula / linhas ───────────────────────────────────────────────
  const setCell = (r: number, c: number, v: string) => {
    setSheets((prev) => prev.map((s, i) => {
      if (i !== activeTab) return s;
      const rows = s.rows.map((row, ri) =>
        ri !== r ? row : row.length > c ? row.map((cell, ci) => (ci === c ? v : cell)) : row,
      );
      return { ...s, rows };
    }));
    setDirty(true); setSaved(false);
  };

  const addRow = () => {
    setSheets((prev) => prev.map((s, i) =>
      i !== activeTab ? s : { ...s, rows: [...s.rows, new Array(Math.max(1, s.rows[0]?.length ?? 1)).fill('')] },
    ));
    setDirty(true); setSaved(false);
  };

  const removeRow = (r: number) => {
    setSheets((prev) => prev.map((s, i) =>
      i !== activeTab ? s : { ...s, rows: s.rows.filter((_, ri) => ri !== r) },
    ));
    setDirty(true); setSaved(false);
  };

  // ── Salvar (persiste para sempre) ──────────────────────────────────────────
  const save = async () => {
    if (!documentId) return;
    setSaving(true); setError('');
    try {
      await erpService.saveSpreadsheet(documentId, sheets);
      setDirty(false); setSaved(true);
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // ── Restaurar original (re-parse do arquivo) ────────────────────────────────
  const restore = async () => {
    if (!documentId) return;
    if (!window.confirm('Restaurar o conteúdo original do arquivo? Suas edições serão descartadas.')) return;
    setLoading(true); setError('');
    try {
      const d = await erpService.reparseSpreadsheet(documentId);
      const s = d.sheets?.sheets ?? [];
      setSheets(s.map((x) => ({ ...x, rows: x.rows.map((r) => [...r]) })));
      setDetail(d); setDirty(false); setSaved(false); setActiveTab(0);
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || 'Erro ao restaurar');
    } finally {
      setLoading(false);
    }
  };

  // ── Exportar PDF da aba atual ───────────────────────────────────────────────
  const exportPdf = () => {
    if (!current) return;
    const doc = new jsPDF({
      orientation: (current.rows[0]?.length ?? 0) > 6 ? 'landscape' : 'portrait',
      unit: 'pt',
    });
    const [head, ...body] = current.rows;
    autoTable(doc, {
      head: head ? [head] : [],
      body: body ?? [],
      startY: 60,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 138] },
      margin: { left: 24, right: 24, top: 40 },
      didDrawPage: () => {
        doc.setFontSize(11);
        doc.text(`${detail?.nome ?? 'Planilha'} — ${current.nome}`, 24, 34);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(new Date().toLocaleString('pt-BR'), 24, 46);
      },
    });
    doc.save(`${(detail?.nome ?? 'planilha').replace(/[^\w\-]+/g, '_')}-${current.nome.replace(/[^\w\-]+/g, '_')}.pdf`);
  };

  const totalRows = useMemo(() => sheets.reduce((a, s) => a + (s.rows?.length ?? 0), 0), [sheets]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-2 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {detail?.nome ?? 'Planilha'}
            {detail?.edited && !dirty && (
              <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">editada</Badge>
            )}
            {dirty && <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-300">não salvo</Badge>}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {totalRows} linhas · {sheets.length} aba(s) · o arquivo original permanece intacto
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : error && !sheets.length ? (
          <div className="flex-1 flex items-center justify-center text-destructive gap-2 text-sm">
            <AlertTriangle className="h-5 w-5" /> {error}
          </div>
        ) : (
          <>
            {/* Seletor de aba + ações */}
            <div className="flex items-center gap-2 flex-wrap shrink-0 py-2">
              {sheets.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    i === activeTab
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {s.nome}
                </button>
              ))}
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={restore} disabled={saving || dirty}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar original
              </Button>
              <Button size="sm" variant="outline" onClick={exportPdf} disabled={!current}>
                <FileDown className="h-3.5 w-3.5 mr-1" /> Baixar PDF
              </Button>
              <Button size="sm" onClick={save} disabled={saving || !dirty}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5 mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                {saved ? 'Salvo' : 'Salvar'}
              </Button>
            </div>

            {error && (
              <div className="shrink-0 text-xs text-destructive flex items-center gap-1.5 pb-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {error}
              </div>
            )}

            {/* Tabela editável */}
            <div className="flex-1 overflow-auto border rounded-md bg-white">
              {current ? (
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {current.rows.map((row, r) => (
                      <tr key={r} className={r === 0 ? 'bg-slate-100 sticky top-0' : 'hover:bg-slate-50'}>
                        <td className="border px-1 text-center text-[10px] text-slate-400 select-none w-8">{r + 1}</td>
                        {row.map((cell, c) => (
                          <td key={c} className="border p-0">
                            <input
                              value={cell ?? ''}
                              onChange={(e) => setCell(r, c, e.target.value)}
                              readOnly={r === 0}
                              className={`w-full min-w-[90px] px-2 py-1 outline-none focus:bg-blue-50 ${r === 0 ? 'font-semibold' : ''}`}
                            />
                          </td>
                        ))}
                        <td className="border px-1 w-8">
                          <button
                            onClick={() => removeRow(r)}
                            title="Remover linha"
                            disabled={r === 0}
                            className="text-slate-300 hover:text-destructive transition-colors disabled:opacity-30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum dado processado. Use “Restaurar original” ou reenvie o arquivo.
                </div>
              )}
            </div>

            <div className="shrink-0 pt-2 flex items-center justify-between gap-3">
              <Button size="sm" variant="secondary" onClick={addRow} disabled={!current}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar linha
              </Button>
              <span className="text-[11px] text-muted-foreground text-right">
                A primeira linha (cabeçalho) é fixa — as edições ficam salvas no sistema e não alteram o arquivo original.
              </span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SpreadsheetEditorDialog;


