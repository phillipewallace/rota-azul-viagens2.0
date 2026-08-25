import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Truck, CheckCircle2, AlertTriangle, XCircle, MinusCircle, Loader2, PenLine, ArrowLeft } from 'lucide-react';
import { CHECKLIST_TEMPLATE, ChecklistStatus, STATUS_LABEL, VehicleType, getChecklistFor } from '@/data/checklistTemplate';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { SignaturePad, SignaturePadHandle } from '@/components/SignaturePad';
import { checklistsService, PendingChecklist } from '@/services/checklists';

type ItemState = { status: ChecklistStatus | null; notes: string };
type SignatureMode = 'none' | 'cliente' | 'conferente';

interface TruckInfo { id: string; name: string; plate: string; model: string; year: number; kind: 'truck' | 'carretinha' }

const STATUS_BUTTONS: { value: ChecklistStatus; label: string; icon: any; color: string }[] = [
  { value: 'ok',        label: 'OK',       icon: CheckCircle2, color: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
  { value: 'attention', label: 'Atenção',  icon: AlertTriangle, color: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { value: 'critical',  label: 'Crítico',  icon: XCircle,       color: 'bg-red-600 hover:bg-red-700 text-white' },
  { value: 'na',        label: 'N/A',      icon: MinusCircle,   color: 'bg-gray-500 hover:bg-gray-600 text-white' },
];

const SIG_MODE_LABEL: Record<SignatureMode, string> = {
  none: 'Sem assinatura adicional',
  cliente: 'Assinatura do cliente',
  conferente: 'Assinatura do conferente',
};

export default function PublicChecklist() {
  const [plate, setPlate] = useState('');
  const [truck, setTruck] = useState<TruckInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [pending, setPending] = useState<PendingChecklist[]>([]);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [signingMeta, setSigningMeta] = useState<PendingChecklist | null>(null);

  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [odometer, setOdometer] = useState('');
  const [fuelLevel, setFuelLevel] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerDoc, setSignerDoc] = useState('');
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('none');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  // Estado da tela de 2ª assinatura
  const [secondName, setSecondName] = useState('');
  const [secondDoc, setSecondDoc] = useState('');
  const secondSigRef = useRef<SignaturePadHandle>(null);
  const [savingSecond, setSavingSecond] = useState(false);

  const activeCategories = getChecklistFor(vehicleType);
  const totalItems = activeCategories.reduce((s, c) => s + c.items.length, 0);
  const filledCount = activeCategories.reduce(
    (s, c) => s + c.items.filter(it => items[it.key]?.status).length,
    0
  );

  const lookup = async () => {
    if (!plate.trim()) return toast.error('Informe a placa');
    setLoading(true);
    try {
      const t = await checklistsService.lookupTruck(plate.trim());
      setTruck(t);
      if (t.kind === 'carretinha') setVehicleType('carretinha');
      const pend = await checklistsService.listPending(t.plate).catch(() => []);
      setPending(pend);
      toast.success(`${t.kind === 'carretinha' ? 'Carretinha' : 'Caminhão'}: ${t.name}`);
    } catch (e: any) {
      toast.error(e.message || 'Veículo não encontrado');
    } finally {
      setLoading(false);
    }
  };

  const setStatus = (key: string, status: ChecklistStatus) => {
    setItems(prev => ({ ...prev, [key]: { status, notes: prev[key]?.notes || '' } }));
  };
  const setNotes = (key: string, notes: string) => {
    setItems(prev => ({ ...prev, [key]: { status: prev[key]?.status || null, notes } }));
  };

  const submit = async () => {
    if (!vehicleType) return toast.error('Selecione o tipo do veículo');
    if (filledCount < totalItems) {
      return toast.error(`Faltam ${totalItems - filledCount} itens para avaliar`);
    }
    if (signerName.trim().length < 3) return toast.error('Informe o nome de quem assina');
    if (signerDoc.trim().length < 5) return toast.error('Informe RG ou CPF');
    const sig = sigRef.current?.toDataURL();
    if (!sig) return toast.error('Capture a assinatura');

    const isCarretinha = truck!.kind === 'carretinha';
    const payload = {
      truckId: isCarretinha ? null : truck!.id,
      carretinhaId: isCarretinha ? truck!.id : null,
      vehicleKind: truck!.kind,
      truckPlate: truck!.plate,
      truckName: truck!.name,
      truckModel: truck!.model,
      vehicleType,
      signerName: signerName.trim(),
      signerDocument: signerDoc.trim(),
      signatureDataUrl: sig,
      signatureMode,
      odometerKm: isCarretinha ? null : (odometer || null),
      fuelLevel: isCarretinha ? null : (fuelLevel || null),
      generalNotes: generalNotes || null,
      items: activeCategories.flatMap(cat =>
        cat.items.map(it => ({
          category: cat.category,
          itemKey: it.key,
          itemLabel: it.label,
          status: items[it.key]?.status || 'na',
          notes: items[it.key]?.notes || null,
        }))
      ),
    };

    setSubmitting(true);
    try {
      await checklistsService.submit(payload);
      setDone(true);
      toast.success('Checklist enviada com sucesso!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar');
    } finally {
      setSubmitting(false);
    }
  };

  const submitSecondSignature = async () => {
    if (!signingId || !signingMeta) return;
    if (secondName.trim().length < 3) return toast.error('Informe o nome completo');
    if (secondDoc.trim().length < 5) return toast.error('Informe RG ou CPF');
    const sig = secondSigRef.current?.toDataURL();
    if (!sig) return toast.error('Capture a assinatura');
    setSavingSecond(true);
    try {
      await checklistsService.sendSecondSignature(signingId, {
        signerName: secondName.trim(),
        signerDocument: secondDoc.trim(),
        signatureDataUrl: sig,
      });
      toast.success('Assinatura registrada!');
      // Atualiza lista pendente
      setPending(prev => prev.filter(p => p.id !== signingId));
      setSigningId(null);
      setSigningMeta(null);
      setSecondName('');
      setSecondDoc('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSavingSecond(false);
    }
  };

  // Tela 0: buscar placa
  if (!truck) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-2 left-2 text-slate-400 hover:text-primary" 
            onClick={() => window.location.href = '/app-funcionarios'}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-center mt-4">
              <Truck className="h-5 w-5 text-primary" /> Checklist de Veículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Placa do veículo (caminhão ou carretinha)</Label>
            <Input
              value={plate}
              onChange={e => setPlate(e.target.value.toUpperCase())}
              placeholder="ABC1D23"
              className="text-lg uppercase"
              autoFocus
            />
            <Button className="w-full" onClick={lookup} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar veículo'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela 1.5: assinando uma checklist pendente
  if (signingId && signingMeta) {
    return (
      <div className="min-h-screen bg-gray-50 pb-32">
        <div className="bg-blue-600 text-white p-4 sticky top-0 z-10 shadow">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-blue-700" aria-label="Voltar à lista" onClick={() => { 
              if (signingId) { setSigningId(null); setSigningMeta(null); }
              else { window.location.href = '/app-funcionarios'; }
            }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="text-xs opacity-80">Captar assinatura</div>
              <div className="font-bold">{signingMeta.truckName} · {signingMeta.truckPlate}</div>
            </div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Detalhes da checklist</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div><b>Tipo de assinatura:</b> {SIG_MODE_LABEL[signingMeta.signatureMode]}</div>
              <div><b>Motorista:</b> {signingMeta.signerName}</div>
              <div><b>Data:</b> {new Date(signingMeta.createdAt).toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {signingMeta.signatureMode === 'cliente' ? 'Assinatura do cliente' : 'Assinatura do conferente'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Nome completo</Label>
                <Input value={secondName} onChange={e => setSecondName(e.target.value)} />
              </div>
              <div>
                <Label>RG ou CPF</Label>
                <Input value={secondDoc} onChange={e => setSecondDoc(e.target.value)} />
              </div>
              <div>
                <Label>Assinatura</Label>
                <SignaturePad ref={secondSigRef} />
              </div>
            </CardContent>
          </Card>

          <Button className="w-full h-14 text-base" onClick={submitSecondSignature} disabled={savingSecond}>
            {savingSecond ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar assinatura'}
          </Button>
        </div>
      </div>
    );
  }

  // Tela final
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold">Checklist enviada!</h2>
            <p className="text-muted-foreground">A checklist do veículo {truck?.plate} foi registrada.</p>
            <Button className="w-full" onClick={() => window.location.reload()}>Nova checklist</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCarretinha = truck.kind === 'carretinha';

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10 shadow">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" className="text-white hover:bg-blue-700 shrink-0" onClick={() => { window.location.href = '/app-funcionarios'; }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="text-xs opacity-80">{isCarretinha ? 'Carretinha' : 'Caminhão'}</div>
            <div className="font-bold">{truck.name} · {truck.plate}</div>
            {truck.model && <div className="text-xs opacity-80">{truck.model}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80">Progresso</div>
            <div className="font-bold">{filledCount}/{totalItems}</div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {pending.length > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PenLine className="h-4 w-4" /> Checklists aguardando assinatura ({pending.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pending.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white border rounded p-2">
                  <div className="text-sm">
                    <div className="font-medium">{new Date(p.createdAt).toLocaleString('pt-BR')}</div>
                    <div className="text-xs text-muted-foreground">
                      {SIG_MODE_LABEL[p.signatureMode]} · Motorista: {p.signerName}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => { setSigningId(p.id); setSigningMeta(p); }}>
                    Assinar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Informações iniciais</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isCarretinha ? (
              <div className="text-sm bg-amber-50 border border-amber-200 rounded p-2 text-amber-800">
                Veículo identificado como <b>carretinha</b>. Checklist específica carregada.
              </div>
            ) : (
              <div>
                <Label>Tipo de veículo</Label>
                <SearchableSelect
                  value={vehicleType ?? ''}
                  onValueChange={(v) => setVehicleType(v as VehicleType)}
                  placeholder="Selecione: Carroceria ou Tanque"
                  options={[
                    { value: 'carroceria', label: 'Carroceria' },
                    { value: 'tanque', label: 'Tanque' },
                  ]}
                />
              </div>
            )}
            {!isCarretinha && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hodômetro (km)</Label>
                  <Input type="number" value={odometer} onChange={e => setOdometer(e.target.value)} />
                </div>
                <div>
                  <Label>Nível combustível</Label>
                  <Input value={fuelLevel} onChange={e => setFuelLevel(e.target.value)} placeholder="Ex: 3/4" />
                </div>
              </div>
            )}
            <div>
              <Label>Assinatura adicional necessária?</Label>
              <SearchableSelect
                value={signatureMode}
                onValueChange={(v) => setSignatureMode(v as SignatureMode)}
                placeholder="Assinatura"
                options={[
                  { value: 'none', label: 'Sem assinatura adicional' },
                  { value: 'cliente', label: 'Assinatura do cliente (capturar depois)' },
                  { value: 'conferente', label: 'Assinatura do conferente (capturar depois)' },
                ]}
              />
              {signatureMode !== 'none' && (
                <p className="text-xs text-muted-foreground mt-1">
                  A checklist ficará pendente desta assinatura. Ao buscar a placa novamente, ela aparecerá no topo para ser assinada.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {!vehicleType && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            Selecione o tipo de veículo acima para carregar os itens da checklist.
          </CardContent></Card>
        )}

        {vehicleType && activeCategories.map(cat => (
          <Card key={cat.category}>
            <CardHeader><CardTitle className="text-base">{cat.category}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {cat.items.map(it => {
                const cur = items[it.key];
                return (
                  <div key={it.key} className="border-b pb-3 last:border-0 last:pb-0">
                    <div className="font-medium text-sm mb-2">{it.label}</div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {STATUS_BUTTONS.map(b => {
                        const Icon = b.icon;
                        const active = cur?.status === b.value;
                        return (
                          <button
                            key={b.value}
                            type="button"
                            onClick={() => setStatus(it.key, b.value)}
                            className={`flex flex-col items-center gap-1 py-2 px-1 rounded text-xs font-medium transition ${
                              active ? b.color : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            {b.label}
                          </button>
                        );
                      })}
                    </div>
                    {(cur?.status === 'attention' || cur?.status === 'critical') && (
                      <Textarea
                        value={cur?.notes || ''}
                        onChange={e => setNotes(it.key, e.target.value)}
                        placeholder="Observação (obrigatório descrever o problema)"
                        rows={2}
                      />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader><CardTitle className="text-base">Observações gerais</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={3} value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} placeholder="Comentários adicionais..." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Assinatura do motorista</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input value={signerName} onChange={e => setSignerName(e.target.value)} />
            </div>
            <div>
              <Label>RG ou CPF</Label>
              <Input value={signerDoc} onChange={e => setSignerDoc(e.target.value)} />
            </div>
            <div>
              <Label>Assinatura</Label>
              <SignaturePad ref={sigRef} />
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full h-14 text-base"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar checklist'}
        </Button>
      </div>
    </div>
  );
}
