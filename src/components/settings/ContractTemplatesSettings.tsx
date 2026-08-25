import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bold, Italic, Underline, List, ListOrdered, Heading2, Pilcrow, Save, RotateCcw, FileText, Variable } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { contractTemplatesService, type ContractTemplate, type ContractTemplateTipo } from '@/services/contractTemplates';
import { TEMPLATE_VARIABLES } from '@/utils/contractTemplatesDefaults';

import { confirmDialog } from '@/lib/confirm';
function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

function ToolbarButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // não perder seleção
      onClick={onClick}
      title={title}
      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition"
    >
      {children}
    </button>
  );
}

function TemplateEditor({ tipo }: { tipo: ContractTemplateTipo }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [tpl, setTpl] = useState<ContractTemplate | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const t = await contractTemplatesService.get(tipo);
      setTitulo(t.titulo);
      setTpl(t);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar template', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tipo]);

  // Injeta o HTML no editor sempre que o template carregado mudar,
  // garantindo que o ref já está montado (evita race com o early return de loading).
  useEffect(() => {
    if (tpl && editorRef.current) {
      editorRef.current.innerHTML = tpl.corpoHtml || '';
    }
  }, [tpl]);

  const insertVariable = (key: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    exec('insertText', `{{${key}}}`);
  };

  const save = async () => {
    if (!editorRef.current) return;
    const corpoHtml = editorRef.current.innerHTML.trim();
    if (!corpoHtml) {
      toast({ title: 'O corpo do contrato não pode ficar vazio', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const saved = await contractTemplatesService.save(tipo, { titulo: titulo.trim() || tpl?.titulo || '', corpoHtml });
      toast({ title: 'Modelo salvo com sucesso' });
      setTitulo(saved.titulo);
      setTpl(saved);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!(await confirmDialog({ description: `Restaurar o modelo de ${tipo.toUpperCase()} para o padrão original? Suas edições atuais serão perdidas.`, destructive: true }))) return;
    try {
      setSaving(true);
      const restored = await contractTemplatesService.reset(tipo);
      setTitulo(restored.titulo);
      // força re-injeção mesmo se o conteúdo for idêntico ao tpl anterior
      setTpl(null);
      setTimeout(() => setTpl(restored), 0);
      toast({ title: 'Modelo restaurado para o padrão' });
    } catch (e: any) {
      toast({ title: 'Erro ao restaurar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
      <div className="space-y-3 min-w-0">
        <div>
          <Label className="text-xs">Título do contrato (cabeçalho do PDF)</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>

        <div>
          <Label className="text-xs">Corpo do contrato</Label>
          <div className="border rounded-md overflow-hidden bg-white">
            <div className="flex flex-wrap items-center gap-1 border-b bg-slate-50 px-2 py-1.5">
              <ToolbarButton onClick={() => exec('bold')} title="Negrito"><Bold className="h-3.5 w-3.5" /></ToolbarButton>
              <ToolbarButton onClick={() => exec('italic')} title="Itálico"><Italic className="h-3.5 w-3.5" /></ToolbarButton>
              <ToolbarButton onClick={() => exec('underline')} title="Sublinhado"><Underline className="h-3.5 w-3.5" /></ToolbarButton>
              <div className="w-px h-5 bg-slate-300 mx-1" />
              <ToolbarButton onClick={() => exec('formatBlock', 'H2')} title="Título de cláusula (H2)"><Heading2 className="h-3.5 w-3.5" /></ToolbarButton>
              <ToolbarButton onClick={() => exec('formatBlock', 'P')} title="Parágrafo"><Pilcrow className="h-3.5 w-3.5" /></ToolbarButton>
              <div className="w-px h-5 bg-slate-300 mx-1" />
              <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Lista com marcadores"><List className="h-3.5 w-3.5" /></ToolbarButton>
              <ToolbarButton onClick={() => exec('insertOrderedList')} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></ToolbarButton>
              <div className="ml-auto text-[11px] text-slate-500 px-2">
                Use a barra lateral para inserir variáveis
              </div>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="prose prose-sm max-w-none p-4 min-h-[420px] max-h-[600px] overflow-y-auto focus:outline-none text-sm leading-relaxed [&_h2]:font-bold [&_h2]:text-base [&_h2]:mt-4 [&_h2]:mb-1 [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:my-1"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="h-4 w-4 mr-1" /> Salvar modelo
          </Button>
          <Button variant="outline" onClick={reset} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-1" /> Restaurar padrão
          </Button>
          {tpl?.atualizadoEm && (
            <span className="text-xs text-slate-500 ml-auto">
              Última atualização: {new Date(tpl.atualizadoEm).toLocaleString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      <aside className="border rounded-md bg-slate-50 p-3 max-h-[640px] overflow-y-auto">
        <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <Variable className="h-3.5 w-3.5" /> Variáveis disponíveis
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Clique para inserir na posição do cursor. Serão substituídas pelos dados reais ao gerar o PDF.
        </p>
        {TEMPLATE_VARIABLES.map(group => (
          <div key={group.group} className="mb-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{group.group}</div>
            <div className="flex flex-wrap gap-1">
              {group.vars.map(v => (
                <button
                  key={v}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertVariable(v)}
                  className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition"
                  title={`Inserir {{${v}}}`}
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}

export default function ContractTemplatesSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          Modelos de Contrato
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Edite os modelos de contrato usados pelo sistema. As variáveis entre <code>{'{{ }}'}</code> são substituídas
          automaticamente pelos dados do orçamento/OS/cliente ao gerar o PDF.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="obra" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="obra">Obra</TabsTrigger>
            <TabsTrigger value="evento">Evento</TabsTrigger>
          </TabsList>
          <TabsContent value="obra" className="mt-4">
            <TemplateEditor tipo="obra" />
          </TabsContent>
          <TabsContent value="evento" className="mt-4">
            <TemplateEditor tipo="evento" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
