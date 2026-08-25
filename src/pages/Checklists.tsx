import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ArrowLeft, FileDown, Printer, Search, Trash2, Loader2, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { checklistsService, ChecklistDetail, ChecklistSummary } from '@/services/checklists';
import { STATUS_LABEL } from '@/data/checklistTemplate';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanyLogoDataUrl } from '@/utils/companyLogo';

import { confirmDialog } from '@/lib/confirm';
const SUMMARY_BADGE: Record<string, { label: string; cls: string }> = {
  ok:        { label: 'OK',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  attention: { label: 'Atenção',  cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  critical:  { label: 'Crítico',  cls: 'bg-red-100 text-red-700 border-red-300' },
};

async function exportChecklistPdf(d: ChecklistDetail) {
  const doc = new jsPDF();
  const isCarretinha = d.vehicleKind === 'carretinha';
  const vehicleLabel = isCarretinha ? 'Carretinha' : 'Caminhão';
  const mode = (d.signatureMode || 'none') as 'none' | 'cliente' | 'conferente';

  // Logo da empresa (topo direito)
  const logo = await getCompanyLogoDataUrl();
  if (logo) {
    try { doc.addImage(logo, 'PNG', doc.internal.pageSize.getWidth() - 14 - 22, 8, 22, 22, undefined, 'FAST'); } catch {}
  }

  doc.setFontSize(16);
  doc.text(`Checklist de Inspeção — ${vehicleLabel}`, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 22);
  doc.setTextColor(0);

  doc.setFontSize(11);
  let y = 32;
  const line = (label: string, val: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(val, 60, y);
    y += 6;
  };
  line(`${vehicleLabel}:`, `${d.truckName || '-'} (${d.truckPlate})`);
  if (d.truckModel) line('Modelo:', d.truckModel);
  line('Data:', new Date(d.createdAt).toLocaleString('pt-BR'));
  if (!isCarretinha) {
    line('Hodômetro:', d.odometerKm != null ? `${d.odometerKm} km` : '-');
    line('Combustível:', d.fuelLevel || '-');
  }
  line('Status geral:', SUMMARY_BADGE[d.summaryStatus]?.label || d.summaryStatus);
  line('Críticos / Atenção:', `${d.criticalCount} / ${d.attentionCount}`);

  // Group by category
  const byCat: Record<string, typeof d.items> = {};
  d.items.forEach(it => { (byCat[it.category] ||= []).push(it); });

  Object.entries(byCat).forEach(([cat, list]) => {
    autoTable(doc, {
      startY: y + 2,
      head: [[cat, 'Status', 'Observações']],
      body: list.map(i => [i.itemLabel, STATUS_LABEL[i.status], i.notes || '']),
      styles: { fontSize: 9, cellPadding: 1.5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 25 } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    if (y > 250) { doc.addPage(); y = 20; }
  });

  if (d.generalNotes) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.text('Observações gerais:', 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(d.generalNotes, 180);
    doc.text(lines, 14, y); y += lines.length * 5 + 4;
  }

  // ==================== Bloco de assinaturas ====================
  if (y > 200) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Assinaturas', 14, y); y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const showSecond = mode !== 'none';
  const colW = showSecond ? 88 : 180;
  const sigBoxH = 32;
  const leftX = 14;
  const rightX = 14 + colW + 8;

  // Caixa motorista
  doc.rect(leftX, y, colW, sigBoxH);
  if (d.signatureDataUrl) {
    try { doc.addImage(d.signatureDataUrl, 'PNG', leftX + 2, y + 2, colW - 4, sigBoxH - 4); } catch {}
  }

  // Caixa segundo signatário (apenas se modo != none)
  if (showSecond) {
    doc.rect(rightX, y, colW, sigBoxH);
    if (d.secondSignatureDataUrl) {
      try { doc.addImage(d.secondSignatureDataUrl, 'PNG', rightX + 2, y + 2, colW - 4, sigBoxH - 4); } catch {}
    }
  }

  y += sigBoxH + 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Motorista responsável', leftX, y);
  if (showSecond) {
    doc.text(mode === 'cliente' ? 'Cliente' : 'Conferente', rightX, y);
  }
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${d.signerName}`, leftX, y);
  if (showSecond) {
    doc.text(`Nome: ${d.secondSignerName || '________________________'}`, rightX, y);
  }
  y += 5;
  doc.text(`RG/CPF: ${d.signerDocument}`, leftX, y);
  if (showSecond) {
    doc.text(`RG/CPF: ${d.secondSignerDocument || '________________________'}`, rightX, y);
  }
  y += 6;

  doc.save(`checklist-${d.truckPlate}-${new Date(d.createdAt).toISOString().slice(0,10)}.pdf`);
}

export default function Checklists() {
  const [list, setList] = useState<ChecklistSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [plate, setPlate] = useState('');
  const [signer, setSigner] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChecklistDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await checklistsService.list({ plate, signer, from, to, status });
      setList(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [plate, signer, from, to, status]);

  // Carregamento inicial (filtros disparam o load via botão "Buscar")
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!openId) { setDetail(null); return; }
    let cancelled = false;
    setLoadingDetail(true);
    checklistsService.get(openId)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(e => { if (!cancelled) toast.error(e.message); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [openId]);

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ description: 'Excluir esta checklist?', destructive: true }))) return;
    try {
      await checklistsService.remove(id);
      toast.success('Excluída');
      setOpenId(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar ao início"><Link to="/"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <ClipboardCheck className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold">Checklists de Caminhões</h1>
            <p className="text-sm text-muted-foreground">Inspeções enviadas pelos motoristas</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div><Label>Placa</Label><Input value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} /></div>
            <div><Label>Assinante</Label><Input value={signer} onChange={e => setSigner(e.target.value)} /></div>
            <div><Label>De</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><Label>Até</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
            <div>
              <Label>Status</Label>
              <SearchableSelect
                value={status || 'all'}
                onValueChange={v => setStatus(v === 'all' ? '' : v)}
                placeholder="Status"
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'ok', label: 'OK' },
                  { value: 'attention', label: 'Atenção' },
                  { value: 'critical', label: 'Crítico' },
                ]}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={load} className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-2" />Filtrar</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left">
                  <th className="p-3">Data</th>
                  <th className="p-3">Placa</th>
                  <th className="p-3">Caminhão</th>
                  <th className="p-3">Assinante</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Crítico/Atenção</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma checklist encontrada</td></tr>
                )}
                {list.map(c => {
                  const b = SUMMARY_BADGE[c.summaryStatus] || SUMMARY_BADGE.ok;
                  return (
                    <tr key={c.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setOpenId(c.id)}>
                      <td className="p-3">{new Date(c.createdAt).toLocaleString('pt-BR')}</td>
                      <td className="p-3 font-mono font-bold">{c.truckPlate}</td>
                      <td className="p-3">{c.truckName || '-'}</td>
                      <td className="p-3">{c.signerName}</td>
                      <td className="p-3"><Badge variant="outline" className={b.cls}>{b.label}</Badge></td>
                      <td className="p-3 text-center">{c.criticalCount} / {c.attentionCount}</td>
                      <td className="p-3 text-right"><Button variant="ghost" size="sm">Abrir</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!openId} onOpenChange={o => !o && setOpenId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Checklist</DialogTitle>
          </DialogHeader>
          {loadingDetail || !detail ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : (
            <div className="space-y-4" id="checklist-print">
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button onClick={() => exportChecklistPdf(detail)}><FileDown className="h-4 w-4 mr-2" />Exportar PDF</Button>
                <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
                <Button variant="destructive" onClick={() => handleDelete(detail.id)}><Trash2 className="h-4 w-4 mr-2" />Excluir</Button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><b>{detail.vehicleKind === 'carretinha' ? 'Carretinha' : 'Caminhão'}:</b> {detail.truckName} ({detail.truckPlate})</div>
                <div><b>Modelo:</b> {detail.truckModel || '-'}</div>
                <div><b>Data:</b> {new Date(detail.createdAt).toLocaleString('pt-BR')}</div>
                {detail.vehicleKind !== 'carretinha' && (
                  <>
                    <div><b>Hodômetro:</b> {detail.odometerKm != null ? `${detail.odometerKm} km` : '-'}</div>
                    <div><b>Combustível:</b> {detail.fuelLevel || '-'}</div>
                  </>
                )}
                <div><b>Status:</b> <Badge variant="outline" className={SUMMARY_BADGE[detail.summaryStatus]?.cls}>{SUMMARY_BADGE[detail.summaryStatus]?.label}</Badge></div>
              </div>

              {Object.entries(detail.items.reduce<Record<string, typeof detail.items>>((acc, i) => {
                (acc[i.category] ||= []).push(i); return acc;
              }, {})).map(([cat, list]) => (
                <Card key={cat}>
                  <CardHeader className="py-2"><CardTitle className="text-sm">{cat}</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <tbody>
                        {list.map((i, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{i.itemLabel}</td>
                            <td className="p-2 w-24"><Badge variant="outline" className={
                              i.status === 'ok' ? 'bg-emerald-50 text-emerald-700' :
                              i.status === 'attention' ? 'bg-amber-50 text-amber-700' :
                              i.status === 'critical' ? 'bg-red-50 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }>{STATUS_LABEL[i.status]}</Badge></td>
                            <td className="p-2 text-muted-foreground">{i.notes || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              ))}

              {detail.generalNotes && (
                <Card>
                  <CardHeader className="py-2"><CardTitle className="text-sm">Observações gerais</CardTitle></CardHeader>
                  <CardContent className="text-sm whitespace-pre-wrap">{detail.generalNotes}</CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="py-2"><CardTitle className="text-sm">Assinaturas</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  <div className={`grid grid-cols-1 ${detail.signatureMode && detail.signatureMode !== 'none' ? 'md:grid-cols-2' : ''} gap-6 items-start`}>
                    {/* Motorista */}
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Motorista responsável</div>
                      <div className="bg-white border rounded h-32 flex items-center justify-center overflow-hidden">
                        {detail.signatureDataUrl ? (
                          <img src={detail.signatureDataUrl} alt="Assinatura do motorista" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sem assinatura</span>
                        )}
                      </div>
                      <div className="border-t pt-1 text-center">
                        <div className="font-medium">{detail.signerName}</div>
                        <div className="text-xs text-muted-foreground">RG/CPF: {detail.signerDocument}</div>
                      </div>
                    </div>
                    {/* Cliente / Conferente — só aparece se modo != none */}
                    {detail.signatureMode && detail.signatureMode !== 'none' && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                          {detail.signatureMode === 'cliente' ? 'Cliente' : 'Conferente'}
                        </div>
                        <div className="bg-white border rounded h-32 flex items-center justify-center overflow-hidden">
                          {detail.secondSignatureDataUrl ? (
                            <img src={detail.secondSignatureDataUrl} alt="Assinatura adicional" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <span className="text-xs text-amber-600 italic">Pendente — buscar pela placa para assinar</span>
                          )}
                        </div>
                        <div className="border-t pt-1 text-center">
                          <div className="font-medium">{detail.secondSignerName || '—'}</div>
                          <div className="text-xs text-muted-foreground">RG/CPF: {detail.secondSignerDocument || '—'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
