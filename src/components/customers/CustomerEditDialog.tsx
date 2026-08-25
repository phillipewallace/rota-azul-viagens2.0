/**
 * Dialog de edição/cadastro de cliente. Mantém um draft interno e só
 * propaga via onSave. O pai decide se o save segue ou abre o modal
 * de duplicata.
 */
import React, { useState } from 'react';
import { Download, Loader2, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Customer } from '@/hooks/useCustomers';
import { maskCep, maskDocument, maskPhone, onlyDigits, UF_LIST } from '@/utils/brazilianDocs';
import { getPersonType, validateCustomerDoc } from '@/utils/customerHelpers';
import { geocodingService } from '@/services/geocoding';

interface Props {
  open: boolean;
  initial: Customer | null;
  isNew: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (c: Customer) => void;
}

export const CustomerEditDialog: React.FC<Props> = ({
  open, initial, isNew, saving, onClose, onSave,
}) => {
  const [draft, setDraft] = useState<Customer | null>(initial);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);

  // Reset interno sempre que o cliente alvo muda
  React.useEffect(() => { setDraft(initial); }, [initial]);

  if (!draft) return null;

  const personType = getPersonType(draft);
  const docError = validateCustomerDoc(draft);
  const nameMissing = !(draft.customerName || '').trim();

  const setField = <K extends keyof Customer>(field: K, value: Customer[K]) =>
    setDraft(prev => prev ? { ...prev, [field]: value } : prev);

  const handleSearchByCep = async () => {
    const cep = onlyDigits(draft.cep || '');
    if (cep.length !== 8) { toast.error('Informe um CEP com 8 dígitos'); return; }
    setSearchingAddress(true);
    try {
      const vc = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then(x => x.json());
      if (!vc || vc.erro) { toast.error('CEP não encontrado'); return; }
      setDraft(prev => prev ? {
        ...prev,
        address: vc.logradouro || prev.address || '',
        bairro: vc.bairro || prev.bairro || '',
        cidade: vc.localidade || prev.cidade || '',
        estado: vc.uf || prev.estado || '',
        complemento: prev.complemento || vc.complemento || '',
      } : prev);
      try {
        const full = [vc.logradouro, vc.bairro, vc.localidade, vc.uf, 'Brasil'].filter(Boolean).join(', ');
        const g = await geocodingService.getCoordinatesFromAddress(full);
        if (g) setDraft(prev => prev ? { ...prev, lat: g.lat, lng: g.lng } : prev);
      } catch { /* geocode é best-effort */ }
      toast.success('Endereço preenchido pelo CEP');
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleLookupCnpj = async () => {
    const cnpj = onlyDigits(draft.document || '');
    if (cnpj.length !== 14) { toast.error('Digite um CNPJ válido (14 dígitos)'); return; }
    setLookingUpCnpj(true);
    try {
      const { lookupCnpj } = await import('@/utils/cnpjLookup');
      const d = await lookupCnpj(cnpj);
      const formatCep = (c: unknown) =>
        c ? String(c).replace(/\D/g, '').replace(/^(\d{5})(\d{3}).*/, '$1-$2') : '';
      setDraft(prev => prev ? {
        ...prev,
        customerName: d.razao_social || prev.customerName,
        contactName: d.nome_fantasia || prev.contactName,
        cep: d.cep ? formatCep(d.cep) : prev.cep,
        address: d.logradouro || prev.address,
        numero: d.numero ? String(d.numero) : prev.numero,
        complemento: d.complemento || prev.complemento,
        bairro: d.bairro || prev.bairro,
        cidade: d.municipio || prev.cidade,
        estado: d.uf || prev.estado,
        contactPhone: d.ddd_telefone_1 || prev.contactPhone,
        email: d.email || prev.email,
      } : prev);
      try {
        const full = [d.logradouro, d.numero, d.bairro, d.municipio, d.uf].filter(Boolean).join(', ');
        if (full.length > 5) {
          const g = await geocodingService.getCoordinatesFromAddress(full);
          if (g) setDraft(prev => prev ? { ...prev, lat: g.lat, lng: g.lng } : prev);
        }
      } catch { /* idem */ }
      const srcLabel = d._source === 'brasilapi' ? 'BrasilAPI' : d._source === 'cnpjws' ? 'CNPJ.ws' : 'ReceitaWS';
      toast.success(`Dados do CNPJ preenchidos (fonte: ${srcLabel})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao consultar CNPJ');
    } finally {
      setLookingUpCnpj(false);
    }
  };

  const handleGeocode = async () => {
    if (!draft.address || draft.address.length < 5) return;
    setSearchingAddress(true);
    try {
      const r = await geocodingService.getCoordinatesFromAddress(draft.address);
      if (r) {
        setDraft(prev => prev ? { ...prev, lat: r.lat, lng: r.lng } : prev);
        toast.success('Coordenadas atualizadas');
      } else {
        toast.error('Endereço não encontrado');
      }
    } catch {
      toast.error('Erro ao geocodificar');
    } finally {
      setSearchingAddress(false);
    }
  };

  const submit = () => {
    if (nameMissing) { toast.error('Informe o nome / razão social.'); return; }
    if (docError) { toast.error(docError); return; }
    onSave(draft);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && !saving && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Novo cliente' : (draft.customerName || 'Editar cliente')}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="endereco">Endereço</TabsTrigger>
            <TabsTrigger value="contato">Contato</TabsTrigger>
            <TabsTrigger value="obs">Observações</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4 pt-3">
            <div>
              <label className="text-xs text-muted-foreground">Tipo de pessoa</label>
              <div className="flex gap-1 mt-1">
                <Button type="button" size="sm" variant={personType === 'PJ' ? 'default' : 'outline'}
                        onClick={() => setField('personType', 'PJ')}>Pessoa Jurídica (CNPJ)</Button>
                <Button type="button" size="sm" variant={personType === 'PF' ? 'default' : 'outline'}
                        onClick={() => setField('personType', 'PF')}>Pessoa Física (CPF)</Button>
              </div>
            </div>

            {personType === 'PJ' && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <label className="text-xs font-medium text-muted-foreground">
                  CNPJ — digite e clique em buscar para preencher automaticamente
                </label>
                <div className="flex gap-2 mt-1">
                  <Input
                    className="font-mono"
                    value={maskDocument(draft.document || '', personType)}
                    onChange={e => setField('document', onlyDigits(e.target.value))}
                    placeholder="00.000.000/0000-00"
                  />
                  <Button
                    type="button"
                    onClick={handleLookupCnpj}
                    disabled={lookingUpCnpj || onlyDigits(draft.document || '').length !== 14}
                    className="gap-1 shrink-0"
                  >
                    {lookingUpCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Buscar dados
                  </Button>
                </div>
                {docError && <div className="text-[11px] text-destructive mt-1">{docError}</div>}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">
                  {personType === 'PJ' ? 'Razão social' : 'Nome completo'} *
                </label>
                <Input value={draft.customerName || ''} onChange={e => setField('customerName', e.target.value)} />
              </div>

              {personType === 'PJ' ? (
                <>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Nome fantasia</label>
                    <Input value={draft.contactName || ''} onChange={e => setField('contactName', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Inscrição estadual</label>
                    <Input value={draft.ie || ''} onChange={e => setField('ie', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Inscrição municipal</label>
                    <Input value={draft.im || ''} onChange={e => setField('im', e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">CPF</label>
                    <Input
                      className="font-mono"
                      value={maskDocument(draft.document || '', personType)}
                      onChange={e => setField('document', onlyDigits(e.target.value))}
                      placeholder="000.000.000-00"
                    />
                    {docError && <div className="text-[11px] text-destructive mt-1">{docError}</div>}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">RG</label>
                    <Input value={draft.ie || ''} onChange={e => setField('ie', e.target.value)} />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Tipo de cliente</label>
                <select
                  className="w-full border rounded-md h-10 px-2 bg-background"
                  value={draft.tipoCliente || ''}
                  onChange={e => setField('tipoCliente', e.target.value)}
                >
                  <option value="">—</option>
                  <option value="eventos">Eventos</option>
                  <option value="obra">Obra / Construção</option>
                  <option value="industria">Indústria</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="endereco" className="space-y-3 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">CEP</label>
                <div className="flex gap-1">
                  <Input
                    value={maskCep(draft.cep || '')}
                    onChange={e => setField('cep', e.target.value)}
                    maxLength={9}
                    placeholder="00000-000"
                  />
                  <Button size="sm" variant="outline" onClick={handleSearchByCep} disabled={searchingAddress}>
                    {searchingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Logradouro</label>
                <div className="flex gap-1">
                  <Input value={draft.address || ''} onChange={e => setField('address', e.target.value)} />
                  <Button size="sm" variant="outline" onClick={handleGeocode} disabled={searchingAddress} title="Buscar coordenadas">
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Número</label>
                <Input value={draft.numero || ''} onChange={e => setField('numero', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Complemento</label>
                <Input value={draft.complemento || ''} onChange={e => setField('complemento', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Bairro</label>
                <Input value={draft.bairro || ''} onChange={e => setField('bairro', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Cidade</label>
                <Input value={draft.cidade || ''} onChange={e => setField('cidade', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">UF</label>
                <select
                  className="w-full border rounded-md h-10 px-2 bg-background"
                  value={draft.estado || ''}
                  onChange={e => setField('estado', e.target.value)}
                >
                  <option value="">—</option>
                  {UF_LIST.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            {draft.lat && draft.lng && (
              <div className="text-[10px] text-muted-foreground">
                📍 Lat {Number(draft.lat).toFixed(5)} · Lng {Number(draft.lng).toFixed(5)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="contato" className="space-y-3 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Responsável no local</label>
                <Input
                  value={draft.responsavelNome || draft.contactName || ''}
                  onChange={e => setField('responsavelNome', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">CPF do responsável</label>
                <Input
                  value={maskDocument(draft.responsavelCpf || '', 'PF')}
                  onChange={e => setField('responsavelCpf', onlyDigits(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Telefone</label>
                <Input
                  value={maskPhone(draft.contactPhone || '')}
                  onChange={e => setField('contactPhone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">E-mail</label>
                <Input type="email" value={draft.email || ''} onChange={e => setField('email', e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="obs" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Banheiros (planejados)</label>
                <Input
                  type="number" min={0}
                  value={draft.restroomsQty ?? ''}
                  onChange={e => setField('restroomsQty', e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Limpezas (planejadas)</label>
                <Input
                  type="number" min={0}
                  value={draft.cleaningsQty ?? ''}
                  onChange={e => setField('cleaningsQty', e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Observações</label>
              <Textarea rows={4} value={draft.notes || ''} onChange={e => setField('notes', e.target.value)} />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {isNew ? 'Cancelar' : 'Fechar'}
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !!docError || nameMissing}
            className="bg-green-600 hover:bg-green-700"
            title={nameMissing ? 'Preencha o nome' : (docError || '')}
          >
            {saving
              ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Salvando…</>
              : (isNew ? 'Cadastrar cliente' : 'Salvar alterações')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
