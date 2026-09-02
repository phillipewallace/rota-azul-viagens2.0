/**
 * Dialog de pré-visualização de arquivos da Central de Documentos.
 * Renderiza nativamente: PDF, imagens, vídeo, áudio e texto/código.
 * Para Office (.docx/.xlsx/.pptx) e .zip extrai o conteúdo com JSZip.
 * Para qualquer outro formato mostra um painel de metadados com "Abrir" e "Baixar".
 */
import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type ErpDocument } from '@/services/erp';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import {
  getPreviewKind, formatFileSize, downloadFileFromUrl, previewKindLabels, fileExtension,
  type PreviewKind,
} from '@/utils/documentFiles';
import {
  FileText, FileImage, FileVideo, FileAudio, FileArchive, FileSpreadsheet, FileType,
  Download, ExternalLink, Loader2, FileQuestion,
} from 'lucide-react';

const kindIcon = (kind: PreviewKind) => {
  switch (kind) {
    case 'pdf': return <FileText className="h-12 w-12 text-rose-500" />;
    case 'image': return <FileImage className="h-12 w-12 text-emerald-500" />;
    case 'video': return <FileVideo className="h-12 w-12 text-violet-500" />;
    case 'audio': return <FileAudio className="h-12 w-12 text-sky-500" />;
    case 'text': return <FileType className="h-12 w-12 text-indigo-500" />;
    case 'office': return <FileSpreadsheet className="h-12 w-12 text-blue-500" />;
    case 'archive': return <FileArchive className="h-12 w-12 text-amber-500" />;
    default: return <FileQuestion className="h-12 w-12 text-slate-400" />;
  }
};

/** Remove tags XML e devolve o texto "legível" entre parágrafos. */
function stripXml(xml: string): string {
  return xml
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<\/a:p>/gi, '\n')
    .replace(/<w:tab\/>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Conjunto de strings compartilhadas do .xlsx. */
function extractSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRegex = /<si[\s>][^]*?<\/si>|<si>(.*?)<\/si>/gi;
  let m: RegExpExecArray | null;
  while ((m = siRegex.exec(xml)) !== null) {
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/gi;
    const texts: string[] = [];
    let t: RegExpExecArray | null;
    while ((t = tRegex.exec(m[0])) !== null) texts.push(t[1]);
    out.push(texts.join('').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  }
  return out;
}

/** Constrói uma prévia em forma de tabela simplificada do sheet1 do .xlsx. */
function sheetPreview(sheetXml: string, shared: string[]): string {
  const rows: string[][] = [];
  const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rowRegex.exec(sheetXml)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<c[^>]*>([\s\S]*?)<\/c>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = cellRegex.exec(rm[1])) !== null) {
      const cell = cm[0];
      const isString = /t="s"/.test(cell);
      const vMatch = cell.match(/<v>([\s\S]*?)<\/v>/);
      const raw = vMatch ? vMatch[1] : '';
      if (isString) {
        const idx = Number(raw);
        cells.push(Number.isFinite(idx) && shared[idx] != null ? shared[idx] : raw);
      } else {
        cells.push(raw);
      }
    }
    if (cells.length) rows.push(cells);
  }
  return rows.map((r) => r.join('  |  ')).join('\n');
}

async function loadPreviewContent(doc: ErpDocument, kind: PreviewKind): Promise<string> {
  const url = toAbsoluteUrl(doc.arquivoUrl);
  if (!url) throw new Error('Arquivo sem URL');
  const ext = fileExtension(doc.arquivoNome);

  if (kind === 'archive' && ext === 'zip') {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao ler o .zip');
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const entries = Object.values(zip.files).filter((f) => !f.dir).slice(0, 200);
    const lines: string[] = [];
    for (const f of entries) {
      try {
        const blob = await f.async('blob');
        lines.push(`${f.name}  (${blob.size} bytes)`);
      } catch {
        lines.push(`${f.name}  (—)`);
      }
    }
    return lines.length
      ? `📦 Conteúdo do arquivo .zip (${entries.length} arquivos):\n\n${lines.join('\n')}`
      : 'Arquivo .zip vazio.';
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error('Falha ao carregar o arquivo');

  if (kind === 'office' && ['docx', 'xlsx', 'pptx'].includes(ext)) {
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    if (ext === 'docx') {
      const xml = await zip.file('word/document.xml')?.async('string');
      return xml ? stripXml(xml) : '';
    }
    if (ext === 'xlsx') {
      const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
      const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
      const shared = sharedXml ? extractSharedStrings(sharedXml) : [];
      return sheetXml ? sheetPreview(sheetXml, shared) : '';
    }
    if (ext === 'pptx') {
      const slideNames = Object.keys(zip.files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
        .sort((a, b) => {
          const na = parseInt(a.match(/slide(\d+)/i)?.[1] || '0', 10);
          const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || '0', 10);
          return na - nb;
        });
      const parts: string[] = [];
      for (let i = 0; i < slideNames.length; i += 1) {
        const xml = await zip.file(slideNames[i])?.async('string');
        if (xml) parts.push(`— Slide ${i + 1} —\n${stripXml(xml)}`);
      }
      return parts.join('\n\n');
    }
  }

  if (kind === 'text') {
    const text = await res.text();
    return text.replace(/\r\n/g, '\n');
  }

  return '';
}

function FallbackPanel({ doc, kind }: { doc: ErpDocument; kind: PreviewKind }) {
  return (
    <div className="min-h-[380px] flex flex-col items-center justify-center gap-4 p-8 text-center">
      {kindIcon(kind)}
      <div>
        <p className="font-semibold text-sm">{doc.arquivoNome || 'Sem arquivo vinculado'}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatFileSize(doc.arquivoTamanho)} · {doc.arquivoTipo || 'tipo não identificado'} · .{fileExtension(doc.arquivoNome) || '—'}
        </p>
      </div>
      <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
        Este formato não possui visualização nativa no navegador. Abra ou baixe o arquivo para
        conferir o conteúdo completo.
      </p>
      <div className="flex gap-2">
        {doc.arquivoUrl && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(toAbsoluteUrl(doc.arquivoUrl) || '#', '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4" /> Abrir
            </Button>
            <Button
              size="sm"
              onClick={() =>
                downloadFileFromUrl(doc.arquivoUrl!, doc.arquivoNome || `${doc.nome}.bin`).catch(() => {})
              }
            >
              <Download className="h-4 w-4" /> Baixar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

interface DialogProps {
  open: boolean;
  doc: ErpDocument | null;
  onOpenChange: (open: boolean) => void;
}

const DocumentPreviewDialog: React.FC<DialogProps> = ({ open, doc, onOpenChange }) => {
  const kind = useMemo<PreviewKind>(
    () => (doc ? getPreviewKind(doc.arquivoNome, doc.arquivoTipo) : 'other'),
    [doc],
  );
  const [loadingText, setLoadingText] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    setTextContent('');
    setPreviewError('');
    if (!open || !doc || !doc.arquivoUrl) return;
    if (!['text', 'office', 'archive'].includes(kind)) return;
    let cancelled = false;
    setLoadingText(true);
    loadPreviewContent(doc, kind)
      .then((t) => { if (!cancelled) setTextContent(t || ''); })
      .catch((e: any) => { if (!cancelled) setPreviewError(e?.message || 'Não foi possível gerar a pré-visualização.'); })
      .finally(() => { if (!cancelled) setLoadingText(false); });
    return () => { cancelled = true; };
  }, [open, doc, kind]);

  if (!open || !doc) return null;

  const url = toAbsoluteUrl(doc.arquivoUrl);
  const hasExtracted = textContent.length > 0;
  const canExtract = kind === 'text' || kind === 'office' || kind === 'archive';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <span className="truncate">{doc.nome || 'Documento'}</span>
            <Badge variant="secondary" className="shrink-0">{previewKindLabels[kind]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto rounded-xl border bg-slate-100/60">
          {kind === 'pdf' && url && (
            <iframe
              title="Prévia do documento"
              src={url}
              className="w-full bg-white"
              style={{ height: '62vh', border: 'none' }}
            />
          )}

          {kind === 'image' && url && (
            <div className="grid place-items-center min-h-[420px] p-4">
              <img
                src={url}
                alt={doc.arquivoNome || doc.nome}
                onError={() => setPreviewError('Não foi possível renderizar a imagem.')}
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow bg-white"
              />
            </div>
          )}

          {kind === 'video' && url && (
            <div className="grid place-items-center min-h-[420px] p-4">
              <video controls className="max-w-full max-h-[60vh] rounded-lg shadow" src={url} />
            </div>
          )}

          {kind === 'audio' && url && (
            <div className="grid place-items-center min-h-[220px] p-8">
              <audio controls className="w-full" src={url} />
            </div>
          )}

          {canExtract && (
            loadingText ? (
              <div className="grid place-items-center min-h-[420px] p-8 text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <span className="text-sm">Gerando pré-visualização…</span>
                </div>
              </div>
            ) : hasExtracted ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs p-4">{textContent}</pre>
            ) : (
              <FallbackPanel doc={doc} kind={kind} />
            )
          )}

          {kind === 'other' && <FallbackPanel doc={doc} kind={kind} />}

          {previewError && !hasExtracted && (
            <div className="px-4 pb-4 text-center text-xs text-amber-600">
              {previewError} — use os botões abaixo para abrir ou baixar o arquivo.
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t items-center justify-between gap-3 sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground min-w-0">
            {doc.tipo && <Badge variant="outline">{doc.tipo}</Badge>}
            {doc.numeracao && <span className="font-medium">Nº {doc.numeracao}</span>}
            {doc.empresaEmissora && <span className="truncate">{doc.empresaEmissora}</span>}
            {doc.arquivoNome && (
              <span className="truncate max-w-[220px]" title={doc.arquivoNome}>
                {doc.arquivoNome} · {formatFileSize(doc.arquivoTamanho)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {url && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-4 w-4" /> Abrir
              </Button>
            )}
            {doc.arquivoUrl && (
              <Button
                size="sm"
                onClick={() =>
                  downloadFileFromUrl(doc.arquivoUrl!, doc.arquivoNome || `${doc.nome}.bin`).catch(() => {})
                }
                title="Baixar arquivo"
              >
                <Download className="h-4 w-4" /> Baixar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreviewDialog;