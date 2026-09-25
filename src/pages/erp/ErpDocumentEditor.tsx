/**
 * ERP → Documentos → Editor de Planilhas
 * Abre .xlsx/.xls/.csv/.ods em um editor de planilha completo (Univer — MIT):
 * fórmulas, múltiplas abas, formatação, ordenação. Ao salvar, gera o arquivo no
 * formato original e atualiza o documento (nova versão) via /upload + PUT.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createUniver, LocaleType } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import ptBRLocale from '@univerjs/preset-sheets-core/locales/pt-BR';
import '@univerjs/preset-sheets-core/lib/index.css';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { erpService, type ErpDocument } from '@/services/erp';
import { API_BASE_URL } from '@/services/config';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { downloadFileFromUrl, formatFileSize } from '@/utils/documentFiles';
import {
  spreadsheetFileToSheets,
  buildSpreadsheetBlob,
  spreadsheetFormatFor,
  spreadsheetMime,
  type UniverSheetModel,
  type SheetExport,
} from '@/utils/spreadsheetConvert';
import {
  ArrowLeft, Download, FileDown, FileSpreadsheet, Loader2, RefreshCw, Save,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

async function uploadDocumentFile(file: File): Promise<{ url: string; size: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const tk = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: tk ? { Authorization: `Bearer ${tk}` } : undefined,
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.url) throw new Error(data?.error || 'Falha ao enviar o arquivo');
  return { url: data.url, size: Number(data.size) || file.size };
}

const ErpDocumentEditor: React.FC = () => {
  const { id = '' } = useParams();
  // `?fileId=` = edita um arquivo específico dentro da sub-pasta do documento.
  // Sem ele, edita o arquivo principal vinculado ao documento.
  const [params] = useSearchParams();
  const fileId = params.get('fileId') || '';
  const navigate = useNavigate();
  const { toast } = useToast();

  const [doc, setDoc] = useState<ErpDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const univerRef = useRef<any | null>(null);
  const apiRef = useRef<any>(null);
  const savedNameRef = useRef('');
  /** Arquivo em edição: da sub-pasta (?fileId) ou o principal do documento. */
  const [target, setTarget] = useState<{ url: string; nome: string; fileId: string | null } | null>(null);

  // Carrega o documento + o arquivo e inicializa o Univer quando o container existe.
  useEffect(() => {
    let cancelled = false;
    let univerInstance: any = null;

    (async () => {
      try {
        const d = await erpService.getDocument(id);
        if (cancelled) return;
        setDoc(d);

        // Resolve qual arquivo abrir: o da sub-pasta (fileId) ou o principal.
        let url: string | null = null;
        let nome = '';
        if (fileId) {
          const files = await erpService.listDocumentFiles(id);
          if (cancelled) return;
          const f = files.find((x) => x.id === fileId);
          if (!f) throw new Error('Este arquivo não está mais na sub-pasta.');
          url = f.arquivoUrl;
          nome = f.arquivoNome || `${d.nome}.xlsx`;
        } else {
          url = d.arquivoUrl;
          nome = d.arquivoNome || `${d.nome}.xlsx`;
        }
        if (!url) throw new Error('Este documento não possui arquivo de planilha.');
        savedNameRef.current = nome;
        setTarget({ url, nome, fileId: fileId || null });

        const res = await fetch(toAbsoluteUrl(url));
        if (!res.ok) throw new Error('Falha ao baixar o arquivo da planilha.');
        const sheets: UniverSheetModel[] = spreadsheetFileToSheets(await res.arrayBuffer());
        if (!sheets.length) throw new Error('A planilha não possui abas legíveis.');

        if (cancelled || !containerRef.current) return;
        const { univer, univerAPI } = createUniver({
          locale: LocaleType.PT_BR,
          locales: { [LocaleType.PT_BR]: ptBRLocale },
          presets: [
            UniverSheetsCorePreset({ container: containerRef.current }),
          ],
        });
        univerInstance = univer;
        univerRef.current = univer;
        apiRef.current = univerAPI;

        (univerAPI as any).createUniverSheet({
          id: `erp-doc-${d.id}`,
          name: savedNameRef.current,
          locale: LocaleType.PT_BR,
          sheetOrder: sheets.map((s) => s.id),
          styles: {},
          sheets: Object.fromEntries(
            sheets.map((s) => [
              s.id,
              {
                id: s.id,
                name: s.name,
                rowCount: s.rowCount,
                columnCount: s.columnCount,
                cellData: s.cellData as any,
              },
            ]),
          ),
        } as any);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao abrir a planilha.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try { univerInstance?.dispose(); } catch { /* noop */ }
      univerRef.current = null;
      apiRef.current = null;
    };
  }, [id]);

  const collectSheets = useCallback((): SheetExport[] => {
    const fwb = apiRef.current?.getActiveWorkbook?.() ?? apiRef.current?.getActiveUniverSheet?.() ?? null;
    if (!fwb) throw new Error('Editor não inicializado.');
    return fwb.getSheets().map((ws: any) => {
      const range = ws.getRange(0, 0, ws.getMaxRows(), ws.getMaxColumns());
      return {
        name: (ws.getSheetName?.() ?? ws.getName?.() ?? 'Aba'),
        values: range.getValues() as unknown[][],
        formulas: (range as any).getFormulas?.() ?? [],
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    console.log('[EditorPlanilha] 💾 Salvar: iniciando…');
    try {
      const sheets = collectSheets();
      console.log('[EditorPlanilha] 💾 Abas coletadas:', sheets.map((s) => `${s.name} (${s.values.length} linhas)`));
      const format = spreadsheetFormatFor(savedNameRef.current);
      const blob = buildSpreadsheetBlob(sheets, format);
      const file = new File([blob], savedNameRef.current, { type: spreadsheetMime(format) });
      console.log('[EditorPlanilha] 💾 Blob gerado:', { format, bytes: blob.size, nome: savedNameRef.current });
      const up = await uploadDocumentFile(file);
      console.log('[EditorPlanilha] 💾 Upload OK:', up);
      if (fileId) {
        // Arquivo da sub-pasta: sobe a nova versão e remove a antiga.
        const novo = await erpService.uploadDocumentFile(doc.id, file);
        try { await erpService.deleteDocumentFile(doc.id, fileId); } catch { /* já substituído */ }
        console.log('[EditorPlanilha] ✅ Arquivo da sub-pasta atualizado:', novo.id);
        toast({ title: 'Planilha salva', description: `${savedNameRef.current} atualizado com sucesso.` });
      } else {
        await erpService.updateDocument(doc.id, {
          arquivoUrl: up.url,
          arquivoNome: savedNameRef.current,
          arquivoTamanho: up.size,
          arquivoTipo: spreadsheetMime(format),
        });
        console.log('[EditorPlanilha] ✅ Documento atualizado no banco');
        toast({ title: 'Planilha salva', description: `${savedNameRef.current} atualizado com sucesso.` });
      }
      navigate('/erp/documentos');
    } catch (e: any) {
      console.error('[EditorPlanilha] ❌ Erro ao salvar:', e);
      toast({
        title: 'Erro ao salvar',
        description: e?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [collectSheets, doc, navigate, toast]);

  const handleDownloadOriginal = useCallback(() => {
    if (!doc?.arquivoUrl) return;
    downloadFileFromUrl(doc.arquivoUrl, doc.arquivoNome || `${doc.nome}.xlsx`).catch(() =>
      toast({ title: 'Erro ao baixar', variant: 'destructive' }),
    );
  }, [doc, toast]);

  // Exporta a aba ativa como PDF (mesmo modelo do editor antigo da aba Excel).
  const handleExportPdf = useCallback(() => {
    try {
      console.log('[EditorPlanilha] 📄 PDF: iniciando…');
      const fwb = apiRef.current?.getActiveWorkbook?.() ?? apiRef.current?.getActiveUniverSheet?.() ?? null;
      if (!fwb) throw new Error('Editor não inicializado.');
      const ws = fwb.getActiveSheet?.() ?? fwb.getSheets()[0];
      if (!ws) throw new Error('Nenhuma aba ativa.');
      const range = ws.getRange(0, 0, ws.getMaxRows(), ws.getMaxColumns());
      const raw = (range.getValues() as unknown[][]) ?? [];

      // Normaliza valores e apara linhas/colunas vazias do fim (a grade do
      // Univer pode ter milhares de linhas em branco).
      const rows = raw.map((r) => (r ?? []).map((v) =>
        v == null ? '' : typeof v === 'object' ? String((v as any).v ?? '') : String(v),
      ));
      let lastRow = rows.length - 1;
      while (lastRow >= 0 && rows[lastRow].every((c) => !c.trim())) lastRow--;
      const trimmed = rows.slice(0, lastRow + 1);
      if (!trimmed.length) throw new Error('A planilha está vazia.');
      let lastCol = 0;
      trimmed.forEach((r) => {
        for (let c = 0; c < r.length; c++) if (r[c].trim()) lastCol = Math.max(lastCol, c);
      });
      const table = trimmed.map((r) => r.slice(0, lastCol + 1));

      const sheetName = ws.getSheetName?.() ?? ws.getName?.() ?? 'Planilha';
      const pdf = new jsPDF({
        orientation: (table[0]?.length ?? 0) > 6 ? 'landscape' : 'portrait',
        unit: 'pt',
      });
      const [head, ...body] = table;
      autoTable(pdf, {
        head: head ? [head] : [],
        body: body ?? [],
        startY: 60,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138] },
        margin: { left: 24, right: 24, top: 40 },
        didDrawPage: () => {
          pdf.setFontSize(11);
          pdf.text(`${doc?.nome ?? 'Planilha'} — ${sheetName}`, 24, 34);
          pdf.setFontSize(8);
          pdf.setTextColor(120);
          pdf.text(new Date().toLocaleString('pt-BR'), 24, 46);
        },
      });
      console.log('[EditorPlanilha] 📄 Gerando PDF:', { aba: sheetName, linhas: table.length, colunas: table[0]?.length });
      pdf.save(
        `${(doc?.nome ?? 'planilha').replace(/[^\w\-]+/g, '_')}-${sheetName.replace(/[^\w\-]+/g, '_')}.pdf`,
      );
      console.log('[EditorPlanilha] ✅ PDF gerado');
    } catch (e: any) {
      console.error('[EditorPlanilha] ❌ Erro ao gerar PDF:', e);
      toast({
        title: 'Erro ao gerar PDF',
        description: e?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [doc, toast]);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Barra superior */}
      <header className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/erp/documentos')} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-semibold text-slate-900 truncate">
              {doc?.nome || 'Editor de planilha'}
            </h1>
            {doc?.arquivoNome && (
              <p className="text-xs text-muted-foreground truncate">
                {doc.arquivoNome} · {formatFileSize(doc.arquivoTamanho)}
              </p>
            )}
          </div>
          {doc?.arquivoNome && (
            <Badge variant="outline" className="hidden md:inline-flex shrink-0">
              .{(doc.arquivoNome.split('.').pop() || '').toLowerCase()}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={loading || !!error}>
            <FileDown className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadOriginal} disabled={!doc?.arquivoUrl}>
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Original</span>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || loading || !!error}>
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </header>

      {/* Área do editor */}
      <div className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-white/80 z-10">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Abrindo planilha…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-white z-10 p-8 text-center">
            <div className="max-w-md space-y-3">
              <XLSXIcon />
              <p className="text-sm font-medium text-slate-900">Não foi possível abrir a planilha</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/erp/documentos')}>
                <ArrowLeft className="h-4 w-4" /> Voltar para Documentos
              </Button>
            </div>
          </div>
        )}
        {/* Container obrigatório do Univer — id via ref, altura controlada pelo pai */}
        <div ref={containerRef} className="w-full h-full" data-univer-container />
      </div>
    </div>
  );
};

/** Ícone de fallback para o painel de erro. */
const XLSXIcon = () => <FileSpreadsheet className="h-10 w-10 text-slate-300" />;

export default ErpDocumentEditor;
