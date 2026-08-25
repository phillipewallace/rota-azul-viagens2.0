/**
 * ERP → Assinatura
 *
 * Fluxo: seleciona a empresa (que já tem assinatura cadastrada), sobe um PDF,
 * navega pelas páginas em pré-visualização, clica na página para posicionar
 * a assinatura (arrastar para mover, cantos para redimensionar), e gera o
 * PDF final com o carimbo aplicado.
 *
 * Não é assinatura com validade jurídica ICP-Brasil — é carimbo visual da
 * imagem de assinatura previamente cadastrada da empresa.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { erpService, uploadSignedPdfBlob, type ErpCompany } from '@/services/erp';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { stampSignatureOnPdf, type SignaturePlacement } from '@/utils/pdfSignatureStamp';
import { FileSignature, Upload, ChevronLeft, ChevronRight, Trash2, Download, AlertTriangle, Copy } from 'lucide-react';
import { pdfjsLib } from '@/utils/pdfjsWorker';

interface Placement extends SignaturePlacement {}

type DragMode = null | 'move' | 'resize';

const DEFAULT_W_PCT = 0.22;
const DEFAULT_H_PCT = 0.06;

const ErpAssinatura: React.FC = () => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [companyId, setCompanyId] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [rendering, setRendering] = useState(false);
  const [generating, setGenerating] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: DragMode;
    idx: number;
    startX: number;
    startY: number;
    orig: Placement;
    rect: DOMRect;
  } | null>(null);

  const company = useMemo(() => companies.find(c => c.id === companyId), [companies, companyId]);
  const signatureUrl = useMemo(() => toAbsoluteUrl(company?.assinaturaUrl), [company]);

  useEffect(() => {
    erpService.listCompanies()
      .then((cs) => {
        setCompanies(cs);
        // preferência: empresa com assinatura, senão a primeira
        const withSig = cs.find(c => c.assinaturaUrl);
        setCompanyId((withSig || cs[0])?.id || '');
      })
      .catch(() => toast({ title: 'Erro', description: 'Não foi possível carregar empresas.', variant: 'destructive' }));
  }, [toast]);

  // Carrega o PDF via pdfjs sempre que os bytes mudarem
  useEffect(() => {
    if (!pdfBytes) return;
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        console.error('[Assinatura] pdfjs.getDocument não respondeu em 15s (worker provavelmente não carregou).');
        toast({
          title: 'Falha ao ler o PDF',
          description: 'O leitor de PDF não respondeu. Recarregue a página e tente novamente.',
          variant: 'destructive',
        });
      }
    }, 15000);
    (async () => {
      try {
        // pdfjs consome o buffer; passar uma cópia como Uint8Array garante compatibilidade.
        const data = new Uint8Array(pdfBytes.slice(0));
        const doc = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageIndex(0);
        setPlacements([]);
      } catch (e: any) {
        console.error('[Assinatura] Erro ao abrir PDF:', e);
        if (!cancelled) {
          toast({ title: 'PDF inválido', description: e?.message || 'Não foi possível abrir o arquivo.', variant: 'destructive' });
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();
    return () => { cancelled = true; window.clearTimeout(timeoutId); };
  }, [pdfBytes, toast]);

  // Renderiza a página atual no canvas
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    let renderTask: any = null;
    (async () => {
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 1 });
        const targetWidth = 820;
        const scale = targetWidth / viewport.width;
        const scaled = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = scaled.width;
        canvas.height = scaled.height;
        const ctx = canvas.getContext('2d')!;
        renderTask = page.render({ canvasContext: ctx, viewport: scaled });
        await renderTask!.promise;
      } catch (e: any) {
        // pdfjs joga exceção quando cancela; ignoramos silenciosamente
        if (e?.name !== 'RenderingCancelledException') {
          console.error('[Assinatura] Erro ao renderizar página:', e);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; renderTask?.cancel?.(); };
  }, [pdfDoc, pageIndex]);

  const onFile = async (file: File) => {
    if (!file) return;
    if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      toast({ title: 'Arquivo inválido', description: 'Envie um arquivo PDF.', variant: 'destructive' });
      return;
    }
    const buf = await file.arrayBuffer();
    setPdfFile(file);
    setPdfBytes(buf);
  };

  const pagePlacements = placements
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => p.pageIndex === pageIndex);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!overlayRef.current || !signatureUrl) return;
    // ignora clique que veio de drag em um placement
    if ((e.target as HTMLElement).dataset.placement) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    const w = DEFAULT_W_PCT;
    const h = DEFAULT_H_PCT;
    setPlacements(prev => [
      ...prev,
      {
        pageIndex,
        xPct: Math.max(0, Math.min(1 - w, xPct - w / 2)),
        yPct: Math.max(0, Math.min(1 - h, yPct - h / 2)),
        wPct: w,
        hPct: h,
      },
    ]);
  };

  const beginDrag = (e: React.PointerEvent, idx: number, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    if (!overlayRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      mode,
      idx,
      startX: e.clientX,
      startY: e.clientY,
      orig: placements[idx],
      rect: overlayRef.current.getBoundingClientRect(),
    };
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    const s = dragState.current;
    if (!s) return;
    const dx = (e.clientX - s.startX) / s.rect.width;
    const dy = (e.clientY - s.startY) / s.rect.height;
    setPlacements(prev => prev.map((p, i) => {
      if (i !== s.idx) return p;
      if (s.mode === 'move') {
        return {
          ...p,
          xPct: Math.max(0, Math.min(1 - p.wPct, s.orig.xPct + dx)),
          yPct: Math.max(0, Math.min(1 - p.hPct, s.orig.yPct + dy)),
        };
      }
      if (s.mode === 'resize') {
        return {
          ...p,
          wPct: Math.max(0.04, Math.min(1 - p.xPct, s.orig.wPct + dx)),
          hPct: Math.max(0.015, Math.min(1 - p.yPct, s.orig.hPct + dy)),
        };
      }
      return p;
    }));
  }, []);

  const endDrag = useCallback(() => { dragState.current = null; }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [onPointerMove, endDrag]);

  const removePlacement = (idx: number) =>
    setPlacements(prev => prev.filter((_, i) => i !== idx));

  const duplicateToAllPages = () => {
    if (!pagePlacements.length || numPages <= 1) return;
    setPlacements(prev => {
      // pega os placements da página atual e replica nas demais que não têm nenhum
      const current = prev.filter(p => p.pageIndex === pageIndex);
      const next = [...prev];
      for (let i = 0; i < numPages; i++) {
        if (i === pageIndex) continue;
        if (next.some(p => p.pageIndex === i)) continue;
        for (const c of current) next.push({ ...c, pageIndex: i });
      }
      return next;
    });
    toast({ title: 'Aplicado em todas as páginas' });
  };

  const handleGenerate = async () => {
    if (!pdfBytes || !signatureUrl) return;
    if (placements.length === 0) {
      toast({ title: 'Marque a posição', description: 'Clique na página para posicionar a assinatura.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const out = await stampSignatureOnPdf(pdfBytes, signatureUrl, placements);
      const bytes = out instanceof Uint8Array ? out : new Uint8Array(out as any);
      console.log('[Assinatura] PDF gerado, bytes =', bytes.byteLength);
      if (!bytes.byteLength) throw new Error('PDF gerado vazio (0 bytes).');
      // Copia para um ArrayBuffer limpo — evita corner cases em que o backing
      // buffer do Uint8Array não é aceito pelo construtor Blob e resulta em 0 bytes.
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const blob = new Blob([ab], { type: 'application/pdf' });
      console.log('[Assinatura] Blob size =', blob.size);

      const base = pdfFile?.name?.replace(/\.pdf$/i, '') || 'documento';
      const filename = `${base}-assinado.pdf`;

      // Download local
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      // Salva histórico no backend (silencioso — não bloqueia o download)
      let saved = false;
      try {
        await uploadSignedPdfBlob(blob, {
          companyId: companyId || undefined,
          originalFilename: filename,
          pages: numPages,
          placementsCount: placements.length,
        });
        saved = true;
      } catch (err: any) {
        console.warn('[Assinatura] Falha ao salvar no histórico:', err);
      }

      toast({
        title: 'PDF assinado gerado',
        description: saved
          ? 'Download iniciado e arquivo salvo em Assinados.'
          : 'Download iniciado. Não foi possível salvar no histórico.',
      });
    } catch (e: any) {
      console.error('[Assinatura] Erro:', e);
      toast({ title: 'Falha ao gerar', description: e?.message || 'Erro desconhecido.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center text-white">
          <FileSignature className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Assinatura em PDF</h1>
          <p className="text-sm text-muted-foreground">Carimbe a assinatura da empresa em qualquer PDF.</p>
        </div>
      </header>

      {/* Controles */}
      <Card className="p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Empresa emissora</Label>
            <SearchableSelect
              value={companyId}
              onValueChange={setCompanyId}
              placeholder="Selecione a empresa"
              searchPlaceholder="Buscar empresa..."
              options={companies.map(c => ({
                value: c.id,
                label: c.razaoSocial + (c.assinaturaUrl ? '' : ' (sem assinatura)'),
              }))}
            />
            {company && !company.assinaturaUrl && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Esta empresa ainda não tem imagem de assinatura cadastrada. Vá em <strong>Empresas Emissoras</strong> para enviar.</span>
              </div>
            )}
            {signatureUrl && (
              <div className="mt-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Assinatura cadastrada</p>
                <div className="bg-white border rounded-md p-2 inline-block">
                  <img src={signatureUrl} alt="Assinatura" className="max-h-16" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Documento PDF</Label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-md p-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {pdfFile ? pdfFile.name : 'Clique para escolher um PDF'}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>
            {pdfFile && !pdfDoc && (
              <p className="text-xs text-muted-foreground">Carregando PDF…</p>
            )}
            {pdfFile && pdfDoc && (
              <p className="text-xs text-muted-foreground">
                {numPages} página{numPages !== 1 ? 's' : ''} · Clique na pré-visualização para posicionar a assinatura.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Preview */}
      {pdfDoc && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setPageIndex(i => Math.max(0, i - 1))}
                disabled={pageIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground min-w-24 text-center">
                Página {pageIndex + 1} / {numPages}
              </span>
              <Button
                variant="outline" size="sm"
                onClick={() => setPageIndex(i => Math.min(numPages - 1, i + 1))}
                disabled={pageIndex >= numPages - 1}
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {pagePlacements.length > 0 && numPages > 1 && (
                <Button variant="outline" size="sm" onClick={duplicateToAllPages}>
                  <Copy className="h-4 w-4 mr-1" /> Aplicar em todas as páginas
                </Button>
              )}
              <Button
                onClick={handleGenerate}
                disabled={generating || !signatureUrl || placements.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Download className="h-4 w-4 mr-1" />
                {generating ? 'Gerando…' : 'Gerar PDF assinado'}
              </Button>
            </div>
          </div>

          <div className="flex justify-center bg-gray-100 rounded-md p-3 overflow-auto">
            <div className="relative shadow-lg" style={{ lineHeight: 0 }}>
              <canvas ref={canvasRef} className="block bg-white" />
              <div
                ref={overlayRef}
                onClick={handleCanvasClick}
                className={`absolute inset-0 ${signatureUrl ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
                title={signatureUrl ? 'Clique para posicionar a assinatura' : 'Selecione uma empresa com assinatura cadastrada'}
              >
                {pagePlacements.map(({ p, idx }) => (
                  <div
                    key={idx}
                    data-placement="1"
                    onPointerDown={(e) => beginDrag(e, idx, 'move')}
                    className="absolute border-2 border-indigo-500 bg-indigo-500/5 group cursor-move select-none"
                    style={{
                      left: `${p.xPct * 100}%`,
                      top: `${p.yPct * 100}%`,
                      width: `${p.wPct * 100}%`,
                      height: `${p.hPct * 100}%`,
                    }}
                  >
                    <img
                      src={signatureUrl}
                      alt=""
                      draggable={false}
                      className="w-full h-full object-contain pointer-events-none opacity-90"
                    />
                    <button
                      type="button"
                      data-placement="1"
                      onClick={(e) => { e.stopPropagation(); removePlacement(idx); }}
                      className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-red-500 text-white grid place-items-center shadow hover:bg-red-600"
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <div
                      data-placement="1"
                      onPointerDown={(e) => beginDrag(e, idx, 'resize')}
                      className="absolute -bottom-1.5 -right-1.5 h-4 w-4 bg-indigo-500 rounded-sm cursor-nwse-resize border-2 border-white shadow"
                      title="Redimensionar"
                    />
                  </div>
                ))}
              </div>
              {rendering && (
                <div className="absolute inset-0 grid place-items-center bg-white/60 text-sm text-muted-foreground">
                  Carregando…
                </div>
              )}
            </div>
          </div>

          {placements.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {placements.length} marcaç{placements.length === 1 ? 'ão' : 'ões'} no documento
              · arraste para mover, arraste o canto para redimensionar.
            </p>
          )}
        </Card>
      )}
    </div>
  );
};

export default ErpAssinatura;
