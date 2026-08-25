import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Plus, Trash2, Save, Upload, Hash, Loader2, ImageIcon, PenLine } from 'lucide-react';
import { erpService, type ErpCompany, uploadSignedPdf } from '@/services/erp';
import { docSettingsService, type DocSetting, type CompanyDocSetting } from '@/services/contracts';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const MAX = 3;
const empty: Partial<ErpCompany> = {
  razaoSocial: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '',
  endereco: '', cidade: '', estado: '', cep: '', telefone: '', email: '',
  logoUrl: '', sigla: '',
  ativo: true,
};

function formatCnpj(v: string) {
  const d = (v || '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export default function CompaniesSettings() {
  const [list, setList] = useState<ErpCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Partial<ErpCompany>>(empty);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ErpCompany | null>(null);
  const [uploadingNew, setUploadingNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setList(await erpService.listCompanies()); }
    catch (e: any) { toast.error(e.message || 'Erro ao carregar empresas'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.razaoSocial || !form.cnpj) {
      toast.error('Razão Social e CNPJ são obrigatórios');
      return;
    }
    setCreating(true);
    try {
      await erpService.createCompany(form);
      toast.success('Empresa cadastrada');
      setForm(empty);
      await load();
    } catch (e: any) { toast.error(e.message || 'Erro ao cadastrar'); }
    finally { setCreating(false); }
  };

  const update = async (c: ErpCompany, patch: Partial<ErpCompany>) => {
    setSavingId(c.id);
    try {
      await erpService.updateCompany(c.id, { ...c, ...patch });
      toast.success('Atualizado');
      await load();
    } catch (e: any) { toast.error(e.message || 'Erro ao atualizar'); }
    finally { setSavingId(null); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await erpService.deleteCompany(deleteTarget.id);
      toast.success('Empresa removida');
      setDeleteTarget(null);
      await load();
    } catch (e: any) { toast.error(e.message || 'Erro ao remover'); }
  };

  const uploadLogo = async (file: File) => {
    setUploadingNew(true);
    try {
      const url = await uploadSignedPdf(file);
      setForm((f) => ({ ...f, logoUrl: url }));
      toast.success('Logo enviada');
    } catch (e: any) { toast.error(e.message); }
    finally { setUploadingNew(false); }
  };

  return (
    <div className="space-y-6">


      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Empresas Emissoras (CNPJs)
            </CardTitle>
            <Badge variant="outline">{list.length}/{MAX}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre até {MAX} CNPJs com logo. Serão usados em Orçamentos, OS, Contratos e Recibos.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <>
              {list.map((c) => (
                <CompanyRow
                  key={c.id}
                  company={c}
                  saving={savingId === c.id}
                  onSave={(patch) => update(c, patch)}
                  onDelete={() => setDeleteTarget(c)}
                />
              ))}

              {list.length < MAX && (
                <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Plus className="h-4 w-4" /> Nova empresa
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Razão Social *" value={form.razaoSocial || ''}
                      onChange={(v) => setForm({ ...form, razaoSocial: v })} />
                    <Field label="Nome Fantasia" value={form.nomeFantasia || ''}
                      onChange={(v) => setForm({ ...form, nomeFantasia: v })} />
                    <Field label="Sigla (ex.: MIC, DSR — aparece na numeração)"
                      value={form.sigla || ''}
                      onChange={(v) => setForm({ ...form, sigla: v.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 6) })} />
                    <Field label="CNPJ *" value={formatCnpj(form.cnpj || '')}
                      onChange={(v) => setForm({ ...form, cnpj: v })} />
                    <Field label="Inscrição Estadual" value={form.inscricaoEstadual || ''}
                      onChange={(v) => setForm({ ...form, inscricaoEstadual: v })} />
                    <Field label="Endereço" value={form.endereco || ''}
                      onChange={(v) => setForm({ ...form, endereco: v })} className="md:col-span-2" />
                    <Field label="Cidade" value={form.cidade || ''}
                      onChange={(v) => setForm({ ...form, cidade: v })} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="UF" value={form.estado || ''}
                        onChange={(v) => setForm({ ...form, estado: v.toUpperCase().slice(0, 2) })} />
                      <Field label="CEP" value={form.cep || ''}
                        onChange={(v) => setForm({ ...form, cep: v })} />
                    </div>
                    <Field label="Telefone" value={form.telefone || ''}
                      onChange={(v) => setForm({ ...form, telefone: v })} />
                    <Field label="E-mail" value={form.email || ''}
                      onChange={(v) => setForm({ ...form, email: v })} />
                    <div className="md:col-span-2">
                      <Label className="text-xs flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" /> Logo (PNG/JPG)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input type="file" accept="image/*"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }}
                          disabled={uploadingNew} />
                        {uploadingNew && <Loader2 className="h-4 w-4 animate-spin" />}
                        {form.logoUrl && <img src={toAbsoluteUrl(form.logoUrl)} alt="logo" className="h-10 border rounded" />}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={create} disabled={creating}>
                      <Plus className="h-4 w-4 mr-1" /> {creating ? 'Salvando…' : 'Adicionar Empresa'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover empresa?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget?.razaoSocial} ({deleteTarget?.cnpj}). Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, className }:
  { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CompanyRow({ company, saving, onSave, onDelete }: {
  company: ErpCompany; saving: boolean;
  onSave: (patch: Partial<ErpCompany>) => void;
  onDelete: () => void;
}) {
  const [local, setLocal] = useState<ErpCompany>(company);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  useEffect(() => setLocal(company), [company]);
  const dirty = JSON.stringify(local) !== JSON.stringify(company);

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const url = await uploadSignedPdf(file);
      setLocal({ ...local, logoUrl: url });
      toast.success('Logo enviada — clique em Salvar');
    } catch (e: any) { toast.error(e.message); }
    finally { setUploadingLogo(false); }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {local.logoUrl && <img src={toAbsoluteUrl(local.logoUrl)} alt="logo" className="h-12 w-12 object-contain border rounded bg-white" />}
          <div>
            <div className="font-semibold flex items-center gap-2">
              {company.razaoSocial}
              {company.sigla && <Badge variant="outline" className="text-[10px]">{company.sigla}</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">{formatCnpj(company.cnpj)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Label className="text-xs">Ativo</Label>
            <Switch checked={local.ativo}
              onCheckedChange={(v) => setLocal({ ...local, ativo: v })} />
          </div>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Razão Social" value={local.razaoSocial}
          onChange={(v) => setLocal({ ...local, razaoSocial: v })} />
        <Field label="Nome Fantasia" value={local.nomeFantasia || ''}
          onChange={(v) => setLocal({ ...local, nomeFantasia: v })} />
        <Field label="Sigla (ex.: MIC, DSR — aparece na numeração)" value={local.sigla || ''}
          onChange={(v) => setLocal({ ...local, sigla: v.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 6) })} />
        <Field label="CNPJ" value={formatCnpj(local.cnpj)}
          onChange={(v) => setLocal({ ...local, cnpj: v })} />
        <Field label="Inscrição Estadual" value={local.inscricaoEstadual || ''}
          onChange={(v) => setLocal({ ...local, inscricaoEstadual: v })} />
        <Field label="Endereço" value={local.endereco || ''}
          onChange={(v) => setLocal({ ...local, endereco: v })} className="md:col-span-2" />
        <Field label="Cidade" value={local.cidade || ''}
          onChange={(v) => setLocal({ ...local, cidade: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="UF" value={local.estado || ''}
            onChange={(v) => setLocal({ ...local, estado: v.toUpperCase().slice(0, 2) })} />
          <Field label="CEP" value={local.cep || ''}
            onChange={(v) => setLocal({ ...local, cep: v })} />
        </div>
        <Field label="Telefone" value={local.telefone || ''}
          onChange={(v) => setLocal({ ...local, telefone: v })} />
        <Field label="E-mail" value={local.email || ''}
          onChange={(v) => setLocal({ ...local, email: v })} />
        <div className="md:col-span-2">
          <Label className="text-xs flex items-center gap-1">
            <ImageIcon className="h-3 w-3" /> Logo (aparece em Orçamento, OS e Recibo)
          </Label>
          <div className="flex items-center gap-2">
            <Input type="file" accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }}
              disabled={uploadingLogo} />
            {uploadingLogo && <Loader2 className="h-4 w-4 animate-spin" />}
            {local.logoUrl && (
              <Input value={local.logoUrl}
                onChange={(e) => setLocal({ ...local, logoUrl: e.target.value })}
                className="text-xs" placeholder="URL da logo" />
            )}
          </div>
        </div>
        <Field label="Contato do Financeiro (nome / telefone / e-mail — aparece no recibo)"
          value={local.financeiroContato || ''}
          onChange={(v) => setLocal({ ...local, financeiroContato: v.slice(0, 500) })}
          className="md:col-span-2" />
        <SignatureField
          value={local.assinaturaUrl || ''}
          onChange={(v) => setLocal({ ...local, assinaturaUrl: v })}
        />
      </div>
      <CompanyDocNumberingSection companyId={company.id} />
      <div className="flex justify-end">
        <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(local)}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  );
}

// ============================
// Numeração desta empresa
// ============================
function CompanyDocNumberingSection({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CompanyDocSetting[] | null>(null);
  const [counters, setCounters] = useState<Record<string, { ultimo: number; ano: number }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingDoc, setSavingDoc] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [its, cts] = await Promise.all([
        docSettingsService.listByCompany(companyId),
        docSettingsService.getCountersByCompany(companyId),
      ]);
      setItems(its);
      setCounters(Object.fromEntries(cts.map((c) => [c.doc, { ultimo: c.ultimo, ano: c.ano }])));
    } catch (e: any) { setError(e.message || 'Erro ao carregar'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (open && items === null) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async (it: CompanyDocSetting) => {
    setSavingDoc(it.doc);
    try {
      await docSettingsService.updateByCompany(companyId, it.doc, it);
      toast.success(`Numeração de ${DOC_LABELS[it.doc]} salva para esta empresa`);
      await load();
    } catch (e: any) { toast.error(e.message || 'Erro ao salvar'); }
    finally { setSavingDoc(null); }
  };

  const reset = async (doc: string) => {
    setSavingDoc(doc);
    try {
      await docSettingsService.resetByCompany(companyId, doc);
      toast.success(`Voltou ao padrão de ${DOC_LABELS[doc]} nesta empresa`);
      await load();
    } catch (e: any) { toast.error(e.message || 'Erro ao remover override'); }
    finally { setSavingDoc(null); }
  };

  const setCounter = async (doc: string, proximo: number) => {
    if (!Number.isFinite(proximo) || proximo < 1) {
      toast.error('Informe um número ≥ 1'); return;
    }
    setSavingDoc(doc);
    try {
      const r = await docSettingsService.setCounterByCompany(companyId, doc, proximo);
      toast.success(`Próxima ${DOC_LABELS[doc]} desta empresa: ${r.proximo}${r.ano ? ` (${r.ano})` : ''}`);
      await load();
    } catch (e: any) { toast.error(e.message || 'Erro ao atualizar contador'); }
    finally { setSavingDoc(null); }
  };

  return (
    <div className="border-t pt-3">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
        <Hash className="h-4 w-4" /> Numeração de documentos desta empresa {open ? '▾' : '▸'}
      </button>
      <p className="text-[11px] text-muted-foreground mt-1">
        Cada empresa mantém seu próprio contador por documento.
      </p>


      {open && (
        <div className="mt-3">
          {loading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
            </div>
          )}
          {!loading && error && (
            <div className="text-sm text-red-600 flex items-center gap-2">
              {error}
              <Button size="sm" variant="outline" onClick={load}>Tentar de novo</Button>
            </div>
          )}
          {!loading && !error && items && items.length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhum documento configurável.</div>
          )}
          {!loading && !error && items && items.length > 0 && (
            <div className="space-y-2">
              {items.map((it) => (
                <CompanyDocRow
                  key={it.doc} item={it}
                  counter={counters[it.doc]}
                  saving={savingDoc === it.doc}
                  onSave={save} onReset={reset} onSetCounter={setCounter}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function CompanyDocRow({ item, counter, saving, onSave, onReset, onSetCounter }: {
  item: CompanyDocSetting; saving: boolean;
  counter?: { ultimo: number; ano: number };
  onSave: (it: CompanyDocSetting) => void;
  onReset: (doc: string) => void;
  onSetCounter: (doc: string, proximo: number) => void;
}) {
  const [local, setLocal] = useState<CompanyDocSetting>(item);
  const [proximo, setProximo] = useState<string>('');
  useEffect(() => setLocal(item), [item]);
  useEffect(() => { setProximo(counter ? String((counter.ultimo || 0) + 1) : ''); }, [counter?.ultimo, counter?.ano]);
  const dirty = JSON.stringify(local) !== JSON.stringify(item);

  const pad = Math.min(10, Math.max(1, Number(local.padding) || 4));
  const startN = Number(local.startNumber) || 0;
  const preview = local.includeYear
    ? `${local.prefix || local.doc}-${new Date().getFullYear()}-${String(startN + 1).padStart(pad, '0')}`
    : String(startN + 1).padStart(pad, '0');

  const validPrefix = local.prefix == null || local.prefix === '' || /^[A-Za-z0-9_-]{1,10}$/.test(local.prefix);
  const validPad = pad === Number(local.padding);
  const validStart = startN >= 0 && startN <= 9_999_999 && startN === Number(local.startNumber);
  const canSave = dirty && !saving && validPrefix && validPad && validStart;

  const proximoN = Number(proximo);
  const validProximo = Number.isFinite(proximoN) && proximoN >= 1 && proximoN <= 9_999_999;
  const proximoDirty = counter ? proximoN !== (counter.ultimo || 0) + 1 : !!proximo;

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-end border rounded p-2 bg-slate-50/50">
      <div className="md:col-span-2">
        <Label className="text-xs">Documento</Label>
        <div className="text-sm font-medium flex items-center gap-2">
          {DOC_LABELS[item.doc] || item.doc}
          {item.hasOverride
            ? <Badge variant="secondary" className="text-[10px]">personalizada</Badge>
            : <Badge variant="outline" className="text-[10px]">padrão</Badge>}
        </div>
      </div>
      <div>
        <Label className="text-xs">Último</Label>
        <Input type="number" min={0} value={local.startNumber}
          onChange={(e) => setLocal({ ...local, startNumber: Number(e.target.value) || 0 })} />
      </div>
      <div>
        <Label className="text-xs">Dígitos</Label>
        <Input type="number" min={1} max={10} value={local.padding}
          onChange={(e) => setLocal({ ...local, padding: Number(e.target.value) || 4 })} />
      </div>
      <div>
        <Label className="text-xs">Prefixo</Label>
        <Input value={local.prefix || ''} placeholder={item.doc}
          onChange={(e) => setLocal({ ...local, prefix: e.target.value })} />
        {!validPrefix && <div className="text-[10px] text-red-600 mt-0.5">até 10 chars: A-Z 0-9 - _</div>}
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={local.includeYear}
          onCheckedChange={(v) => setLocal({ ...local, includeYear: v })} />
        <span className="text-xs">Ano</span>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="text-[10px] text-slate-500">próximo: <span className="font-mono">{preview}</span></div>
        <div className="flex gap-1">
          {item.hasOverride && (
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => onReset(item.doc)}
              className="text-slate-600 h-7 px-2 text-xs">
              Usar padrão
            </Button>
          )}
          <Button size="sm" disabled={!canSave} onClick={() => onSave(local)} className="h-7 px-2">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Contador atual: retomar de onde parou */}
      <div className="md:col-span-7 flex flex-wrap items-end gap-2 border-t pt-2 mt-1">
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs">
            Próximo Nº a emitir {counter?.ano ? <span className="text-slate-400">({counter.ano})</span> : null}
          </Label>
          <Input type="number" min={1} value={proximo}
            onChange={(e) => setProximo(e.target.value)}
            placeholder={counter ? String((counter.ultimo || 0) + 1) : '1'} />
          {!validProximo && proximo !== '' && (
            <div className="text-[10px] text-red-600 mt-0.5">informe entre 1 e 9.999.999</div>
          )}
        </div>
        <div className="text-[11px] text-slate-500 flex-1 min-w-[180px]">
          Último emitido nesta empresa: <span className="font-mono">{counter?.ultimo ?? 0}</span>.
          Use para <b>retomar</b> a numeração de onde parou (ex.: 128) — a próxima emissão sairá com esse número.
        </div>
        <Button size="sm" variant="outline" disabled={saving || !validProximo || !proximoDirty}
          onClick={() => onSetCounter(item.doc, proximoN)} className="h-8 px-3 text-xs">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aplicar próximo Nº'}
        </Button>
      </div>
    </div>
  );
}

function SignatureField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const handle = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadSignedPdf(file);
      onChange(url);
      toast.success('Assinatura enviada — clique em Salvar');
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };
  return (
    <div className="md:col-span-2">
      <Label className="text-xs flex items-center gap-1">
        <PenLine className="h-3 w-3" /> Assinatura digital (imagem PNG/JPG — sai em todo contrato gerado)
      </Label>
      <div className="flex items-center gap-2 flex-wrap">
        <Input type="file" accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }}
          disabled={uploading} className="max-w-sm" />
        {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
        {value && (
          <>
            <img src={toAbsoluteUrl(value)} alt="assinatura"
              className="h-12 border rounded bg-white object-contain px-2" />
            <Button size="sm" variant="ghost" className="text-red-600"
              onClick={() => onChange('')}>Remover</Button>
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        Quando preenchida, todo PDF de contrato sai já assinado pela LOCADORA.
      </p>
    </div>
  );
}

// ============================
// Numeração de documentos
// ============================
const DOC_LABELS: Record<string, string> = {
  ORC: 'Orçamentos', OS: 'Ordens de Serviço', CTR: 'Contratos',
  REC: 'Recibos', REC_SV: 'Recibos sem validade jurídica', MED: 'Medições',
};

function DocNumberingSettings() {
  const [items, setItems] = useState<DocSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDoc, setSavingDoc] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setItems(await docSettingsService.list()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async (it: DocSetting) => {
    setSavingDoc(it.doc);
    try {
      await docSettingsService.update(it.doc, it);
      toast.success(`Numeração de ${DOC_LABELS[it.doc]} salva`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingDoc(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" /> Numeração dos Documentos
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Defina o último número emitido. O próximo documento será gerado a partir daí.
          Exemplo: último contrato foi 1001 → preencha 1001 e o próximo será 1002.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <DocRow key={it.doc} item={it} saving={savingDoc === it.doc} onSave={save} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocRow({ item, saving, onSave }:
  { item: DocSetting; saving: boolean; onSave: (it: DocSetting) => void }) {
  const [local, setLocal] = useState<DocSetting>(item);
  useEffect(() => setLocal(item), [item]);
  const dirty = JSON.stringify(local) !== JSON.stringify(item);

  const preview = local.includeYear
    ? `${local.prefix || local.doc}-${new Date().getFullYear()}-${String((local.startNumber || 0) + 1).padStart(local.padding || 4, '0')}`
    : String((local.startNumber || 0) + 1).padStart(local.padding || 4, '0');

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end border rounded-lg p-3">
      <div className="md:col-span-1">
        <Label className="text-xs">Documento</Label>
        <div className="font-semibold">{DOC_LABELS[item.doc] || item.doc}</div>
      </div>
      <div>
        <Label className="text-xs">Último emitido</Label>
        <Input type="number" min={0} value={local.startNumber}
          onChange={(e) => setLocal({ ...local, startNumber: Number(e.target.value) || 0 })} />
      </div>
      <div>
        <Label className="text-xs">Dígitos</Label>
        <Input type="number" min={1} max={8} value={local.padding}
          onChange={(e) => setLocal({ ...local, padding: Number(e.target.value) || 4 })} />
      </div>
      <div>
        <Label className="text-xs">Prefixo</Label>
        <Input value={local.prefix || ''} placeholder={item.doc}
          onChange={(e) => setLocal({ ...local, prefix: e.target.value })} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={local.includeYear}
          onCheckedChange={(v) => setLocal({ ...local, includeYear: v })} />
        <span className="text-xs">Incluir ano</span>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="text-[11px] text-slate-500">próximo: <span className="font-mono">{preview}</span></div>
        <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(local)}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
