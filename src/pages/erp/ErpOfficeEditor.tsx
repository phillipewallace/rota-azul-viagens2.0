/**
 * ERP → Documentos → Editor Office (Word/PPT e afins)
 * Integra com OnlyOffice Document Server (self-hosted, gratuito) quando
 * configurado no backend (env ONLYOFFICE_PUBLIC_URL). Sem o servidor, mostra
 * pré-visualização de alta fidelidade (.docx via docx-preview) e o fluxo
 * baixar → editar → reenviar. O salvamento pelo OnlyOffice acontece via
 * callback no backend, atualizando o documento automaticamente.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { renderAsync } from 'docx-preview';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { erpService, type ErpDocument } from '@/services/erp';
import { API_BASE_URL } from '@/services/config';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { downloadFileFromUrl, formatFileSize } from '@/utils/documentFiles';
import {
  ArrowLeft, Download, ExternalLink, FileText, Info, Loader2, RefreshCw, UploadCloud,
} from 'lucide-react';

interface OfficeConfig {
  enabled: boolean;
  serverUrl: string;
  editorConfig?: Record<string, any>;
  error?: string;
}

declare global {
  interface Window { DocsAPI?: any; }
}

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

/** Carrega o script api.js do OnlyOffice sob demanda e devolve a classe DocsAPI. */
function loadOnlyOfficeApi(serverUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.DocsAPI) return resolve(window.DocsAPI);
    const src = `${serverUrl.replace(/\/$/, '')}/web-apps/apps/api/documents/api.js`;
    const script = document.createElement('script');
    script.addEventListener('load', () =>
      window.DocsAPI ? resolve(window.DocsAPI) : reject(new Error('DocsAPI indisponível')));
    script.addEventListener('error', () => reject(new Error('Falha ao carregar a API do OnlyOffice')));
    script.src = src;
    document.head.appendChild(script);
  });
}

const ErpOfficeEditor: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [doc, setDoc] = useState<ErpDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<OfficeConfig | null>(null);
  const [replacing, setReplacing] = useState(false);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const docEditorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Carrega documento + configuração do OnlyOffice.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await erpService.getDocument(id);
        if (cancelled) return;
        setDoc(d);
        const tk = localStorage.getItem('auth_token');
        const res = await fetch(`${API_BASE_URL}/office/documents/${id}/config`, {
          headers: tk ? { Authorization: `Bearer ${tk}` } : undefined,
        });
        const cfg = (await res.json().catch(() => null)) as OfficeConfig | null;
        if (cancelled) return;
        setConfig(cfg && cfg.enabled ? cfg : { enabled: false, serverUrl: '' });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao abrir o documento.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Inicializa o DocsAPI quando configurado.
  useEffect(() => {
    let disposed = false;
    if (!config?.enabled || !config.serverUrl || !editorHostRef.current) return;
    (async () => {
      try {
        const DocsAPI = await loadOnlyOfficeApi(config.serverUrl);
        if (disposed || !editorHostRef.current) return;
        docEditorRef.current = new DocsAPI.DocEditor('onlyoffice-editor-host', {
          ...config.editorConfig,
          height: '100%',
          width: '100%',
          events: {
            onError: () => toast({ title: 'Erro no editor OnlyOffice', variant: 'destructive' }),
          },
        });
      } catch (e: any) {
        setConfig({ enabled: false, serverUrl: '' });
        toast({
          title: 'OnlyOffice indisponível',
          description: e?.message || 'Exibindo o modo de visualização.',
          variant: 'destructive',
        });
      }
    })();
    return () => {
      disposed = true;
      try { docEditorRef.current?.destroyEditor(); } catch { /* noop */ }
      docEditorRef.current = null;
    };
  }, [config, toast]);

  // Pré-visualização .docx de alta fidelidade (docx-preview) — modo fallback.
  useEffect(() => {
    if (config?.enabled) return;
    const host = previewRef.current;
    if (!host) return;
    host.innerHTML = '';
    const ext = (doc?.arquivoNome || '').split('.').pop()?.toLowerCase() || '';
    if (!doc?.arquivoUrl || ext !== 'docx') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(toAbsoluteUrl(doc.arquivoUrl));
        if (!res.ok) throw new Error('Falha ao carregar o arquivo');
        const buffer = await res.arrayBuffer();
        if (cancelled || !previewRef.current) return;
        await renderAsync(buffer, previewRef.current, undefined, {
          className: 'docx-preview',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: true,
          useBase64URL: true,
          breakPages: true,
        });
      } catch {
        /* prévia opcional — painel de fallback permanece */
      }
    })();
    return () => { cancelled = true; };
  }, [doc, config?.enabled]);

  const handleReplaceFile = useCallback(async (file: File) => {
    if (!doc) return;
    setReplacing(true);
    try {
      const up = await uploadDocumentFile(file);
      await erpService.updateDocument(doc.id, {
        arquivoUrl: up.url,
        arquivoNome: file.name,
        arquivoTamanho: up.size,
        arquivoTipo: file.type || null,
      });
      toast({ title: 'Arquivo atualizado', description: `${file.name} vinculado ao documento.` });
      navigate('/erp/documentos');
    } catch (e: any) {
      toast({ title: 'Erro ao reenviar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setReplacing(false);
    }
  }, [doc, navigate, toast]);

  const ext = (doc?.arquivoNome || '').split('.').pop()?.toLowerCase() || '';
  const isDocx = ext === 'docx';

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/erp/documentos')} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileText className="h-5 w-5 text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-semibold text-slate-900 truncate">
              {doc?.nome || 'Editor de documento'}
            </h1>
            {doc?.arquivoNome && (
              <p className="text-xs text-muted-foreground truncate">
                {doc.arquivoNome} · {formatFileSize(doc.arquivoTamanho)}
              </p>
            )}
          </div>
          {config?.enabled && <Badge className="bg-emerald-600/90 text-white shrink-0">Edição OnlyOffice</Badge>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline" size="sm"
            onClick={() => doc?.arquivoUrl && downloadFileFromUrl(doc.arquivoUrl, doc.arquivoNome || `${doc.nome}.bin`)}
            disabled={!doc?.arquivoUrl}
          >
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Baixar</span>
          </Button>
          {!config?.enabled && (
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={replacing || !doc}>
              {replacing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Reenviar arquivo
            </Button>
          )}
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".doc,.docx,.odt,.rtf,.ppt,.pptx,.odp,.pdf,image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleReplaceFile(f);
          e.target.value = '';
        }}
      />

      <div className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-white/80 z-10">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Abrindo documento…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-white z-10 p-8 text-center">
            <div className="max-w-md space-y-3">
              <p className="text-sm font-medium text-slate-900">Não foi possível abrir o documento</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/erp/documentos')}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            </div>
          </div>
        )}

        {/* Editor OnlyOffice (quando configurado) */}
        {config?.enabled && (
          <div ref={editorHostRef} className="w-full h-full">
            <div id="onlyoffice-editor-host" className="w-full h-full" />
          </div>
        )}

        {/* Modo fallback: prévia .docx + orientação */}
        {!config?.enabled && !error && (
          <div className="h-full overflow-auto">
            <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium text-amber-900">Edição avançada não configurada</p>
                  <p className="text-amber-800/90 text-xs leading-relaxed">
                    Para editar este documento diretamente no navegador (com formatação completa),
                    instale o OnlyOffice Document Server no servidor — gratuito — e defina
                    <code className="mx-1 px-1 py-0.5 rounded bg-amber-100 font-mono text-[11px]">ONLYOFFICE_PUBLIC_URL</code>
                    no backend. Enquanto isso: baixe o arquivo, edite e use
                    <b> Reenviar arquivo</b> para atualizar a versão.
                  </p>
                </div>
              </div>

              {isDocx ? (
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-2 border-b bg-slate-50 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Pré-visualização do documento</span>
                    <a
                      href={toAbsoluteUrl(doc?.arquivoUrl) || '#'}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      Abrir original <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div ref={previewRef} className="p-4 docx-host" />
                </div>
              ) : (
                <div className="rounded-xl border bg-white p-10 text-center space-y-2">
                  <FileText className="h-10 w-10 mx-auto text-slate-300" />
                  <p className="text-sm text-muted-foreground">
                    Prévia não disponível para .{ext || '—'} — use os botões <b>Baixar</b> e <b>Reenviar arquivo</b>.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErpOfficeEditor;
