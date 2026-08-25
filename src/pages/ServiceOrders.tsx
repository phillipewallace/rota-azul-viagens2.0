/**
 * ERP — Ordens de Serviço: lista com flag de atraso (diárias),
 * fechamento devolve sanitários, exportação financeira e histórico de movimentação.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, AlertTriangle, CheckCircle2, RefreshCcw, Trash2, Loader2, Search,
  FileDown, History, X, MapPin, Calendar, User, Building2, Package,
  FileSignature, FileText, Send, Camera, Clock, MessageSquare, Download, Map
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { serviceOrdersService, ServiceOrder } from '@/services/quotes';
import PaginationBar from '@/components/PaginationBar';
import { API_BASE_URL } from '@/services/config';
import { logger } from '@/lib/logger';


import { downloadCsv, downloadPdf } from '@/utils/exporters';
import { generateContractPdf } from '@/utils/contractPdf';
import { generateServiceOrderPdf } from '@/utils/serviceOrderPdf';
import { BoletoVencimentoDialog } from '@/components/erp/BoletoVencimentoDialog';
import { formatDateBR } from '@/utils/dateFormat';
import { calcVencimentoBoleto, describeFormaPagamento } from '@/utils/fixedObservations';

import { confirmDialog } from '@/lib/confirm';
import { BRL } from '@/utils/currency';
const D = (s?: string) => formatDateBR(s);
const DT = (s?: string) => {
  if (!s) return '—';
  // Pure date (YYYY-MM-DD) → format as local date to avoid UTC -1 day shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDateBR(s);
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR');
};

const tipoLabel = (t?: string) =>
  t === 'obra' ? '🏗️ Obra' : t === 'evento' ? '🎉 Evento' :
  t === 'industria' ? '🏭 Indústria' : t === 'outro' ? 'Outro' : '—';

const ServiceOrders: React.FC = () => {
  const [list, setList] = useState<ServiceOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(48);
  const [counts, setCounts] = useState({ todas: 0, abertas: 0, atrasadas: 0, fechadas: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'todas' | 'abertas' | 'atrasadas' | 'fechadas'>('todas');
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOs, setDetailOs] = useState<ServiceOrder | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [contractTarget, setContractTarget] = useState<ServiceOrder | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  // Debounce da busca (evita hit no server a cada tecla)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const openDetail = async (o: ServiceOrder) => {
    setDetailOs(o);
    setDetailData(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const det = await serviceOrdersService.get(o.id);
      logger.info('OS detalhada carregada', { osId: o.id, funcionarioId: (det as any).funcionarioId });
      setDetailData(det);
    } catch (e: any) { toast.error(e.message); }
    finally { setDetailLoading(false); }
  };

  // Financeiro modal
  const [finOpen, setFinOpen] = useState(false);
  const [finFrom, setFinFrom] = useState('');
  const [finTo, setFinTo] = useState('');
  const [finData, setFinData] = useState<any>(null);
  const [finLoading, setFinLoading] = useState(false);

  // Histórico modal
  const [histOpen, setHistOpen] = useState(false);
  const [hist, setHist] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histType, setHistType] = useState('');
  const [histSan, setHistSan] = useState('');

  // Novo modal de histórico detalhado da OS
  const [osHistoryOpen, setOsHistoryOpen] = useState(false);
  const [osHistory, setOsHistory] = useState<any[]>([]);
  const [osHistoryLoading, setOsHistoryLoading] = useState(false);
  const [osHistoryTarget, setOsHistoryTarget] = useState<ServiceOrder | null>(null);
  const [newNote, setNewNote] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  // Modal de Recolhimento
  const [recolhimentoOpen, setRecolhimentoOpen] = useState(false);
  const [recolhimentoTarget, setRecolhimentoTarget] = useState<ServiceOrder | null>(null);
  const [recolhimentoDate, setRecolhimentoDate] = useState(new Date().toISOString().split('T')[0]);
  const [recolhimentoObs, setRecolhimentoObs] = useState('');
  const [recolhimentoLoading, setRecolhimentoLoading] = useState(false);
  const [osSanitariosRec, setOsSanitariosRec] = useState<any[]>([]);

  const openRecolhimento = async (o: ServiceOrder) => {
    setRecolhimentoTarget(o);
    setRecolhimentoOpen(true);
    setRecolhimentoLoading(true);
    try {
      const token = localStorage.getItem('rota-azul-token');
      const res = await fetch(`${API_BASE_URL}/app-funcionarios/os/${o.id}/sanitarios`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) throw new Error('Falha ao carregar itens da OS');
      const data = await res.json();
      setOsSanitariosRec(data.map((s: any) => ({ ...s, selected: true })));
    } catch (e: any) { toast.error(e.message); }
    finally { setRecolhimentoLoading(false); }
  };

  const handleSolicitarRecolhimento = async () => {
    if (!recolhimentoTarget) return;
    setRecolhimentoLoading(true);
    try {
      const token = localStorage.getItem('rota-azul-token');
      const res = await fetch(`${API_BASE_URL}/erp/service-orders/${recolhimentoTarget.id}/solicitar-recolhimento`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '' 
        },
        body: JSON.stringify({
          data_recolhimento: recolhimentoDate,
          itens_selecionados: osSanitariosRec.filter(s => s.selected).map(s => s.id),
          observacoes: recolhimentoObs
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao solicitar recolhimento');
      }
      toast.success('Recolhimento solicitado! OS voltou para a fila global.');
      setRecolhimentoOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setRecolhimentoLoading(false); }
  };

  const openOsHistory = async (o: ServiceOrder) => {
    setOsHistoryTarget(o);
    setOsHistoryOpen(true);
    setOsHistory([]);
    await loadOsHistory(o.id);
  };

  const loadOsHistory = async (id: string) => {
    setOsHistoryLoading(true);
    try {
      const token = localStorage.getItem('rota-azul-token');
      const res = await fetch(`${API_BASE_URL}/erp/service-orders/${id}/history`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) throw new Error('Falha ao carregar histórico');
      const data = await res.json();
      setOsHistory(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setOsHistoryLoading(false); }
  };

  const addNote = async () => {
    if (!osHistoryTarget || !newNote.trim()) return;
    setNoteBusy(true);
    try {
      const token = localStorage.getItem('rota-azul-token');
      const res = await fetch(`${API_BASE_URL}/erp/service-orders/${osHistoryTarget.id}/notes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '' 
        },
        body: JSON.stringify({ note: newNote.trim() })
      });
      if (!res.ok) throw new Error('Falha ao adicionar nota');
      setNewNote('');
      toast.success('Nota adicionada');
      await loadOsHistory(osHistoryTarget.id);
    } catch (e: any) { toast.error(e.message); }
    finally { setNoteBusy(false); }
  };

  // Params server-side derivados da aba
  const serverParams = useMemo(() => {
    const p: { status?: string; overdue?: boolean; tipoLocacao?: string; search?: string } = {};
    if (tab === 'abertas') p.status = 'aberta';
    if (tab === 'fechadas') p.status = 'fechada';
    if (tab === 'atrasadas') p.overdue = true;
    if (tipoFilter) p.tipoLocacao = tipoFilter;
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [tab, tipoFilter, debouncedSearch]);

  const load = async () => {
    try {
      setLoading(true);
      const [pg, c] = await Promise.all([
        serviceOrdersService.listPaged({ ...serverParams, page, pageSize }),
        serviceOrdersService.counts({ tipoLocacao: tipoFilter || undefined, search: debouncedSearch || undefined }),
      ]);
      setList(pg.data);
      setTotal(pg.total);
      setCounts(c);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [serverParams, page, pageSize]);
  // Reset para página 1 quando filtros mudam
  useEffect(() => { setPage(1); }, [tab, tipoFilter, debouncedSearch, pageSize]);

  // Notificação de atraso ao carregar
  useEffect(() => {
    if (!loading && counts.atrasadas > 0 && tab === 'todas') {
      toast.warning(`${counts.atrasadas} diária(s) em atraso para recolhimento`, {
        duration: 6000,
        action: { label: 'Ver', onClick: () => setTab('atrasadas') },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts.atrasadas]);

  // "filtered" agora é apenas a página vinda do server
  const filtered = list;
  const visible = list;


  const submitRecolhimento = async (o: any) => {
    const data = prompt('Data para recolhimento (AAAA-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!data) return;
    try {
      const token = localStorage.getItem('rota-azul-token');
      
      // Se for fluxo antigo, apenas atualiza o status sem disparar para o app
      const endpoint = o.useNewFlow 
        ? `${API_BASE_URL}/erp/service-orders/${o.id}/solicitar-recolhimento`
        : `${API_BASE_URL}/erp/service-orders/${o.id}/recolhimento-simplificado`;

      await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ dataRecolhimento: data })
      });
      toast.success(o.useNewFlow 
        ? 'Solicitação de recolhimento enviada para a equipe de campo!'
        : 'Recolhimento registrado (fluxo simplificado)');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const close = async (o: ServiceOrder) => {
    if (!(await confirmDialog({ description: `Fechar OS ${o.numero} e devolver ${o.sanitariosAlocados || 0} sanitário(s) ao estoque?`, destructive: true }))) return;
    try { await serviceOrdersService.close(o.id); toast.success('OS fechada · estoque atualizado'); load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const remove = async (o: ServiceOrder) => {
    if (!(await confirmDialog({ description: `Excluir OS ${o.numero}? Sanitários alocados voltam ao estoque.`, destructive: true }))) return;
    try { await serviceOrdersService.remove(o.id); toast.success('Excluída'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const downloadOsPdf = async (o: ServiceOrder) => {
    setPdfBusy(o.id);
    try {
      const d = await serviceOrdersService.get(o.id) as any;
      await generateServiceOrderPdf({
        numero: d.numero || o.numero,
        modalidade: d.modalidade || o.modalidade,
        tipoLocacao: d.tipo_locacao || (o as any).tipoLocacao,
        dataInicio: d.data_inicio,
        dataEntrega: d.data_entrega || o.dataEntrega,
        dataRecolhimento: d.data_recolhimento || o.dataRecolhimento,
        dataFimPrevista: d.data_fim_prevista || o.dataFimPrevista,
        limpezasSemanais: d.limpezas_semanais ?? o.limpezasSemanais,
        enderecoEntrega: d.endereco_entrega || o.enderecoEntrega,
        observacoes: d.observacoes,
        formaPagamento: d.forma_pagamento || (o as any).formaPagamento || null,
        qtdReservada: d.qtd_reservada ?? o.qtdReservada,
        customerName: o.customerName,
        customerAddress: o.customerAddress,
        customerSnapshot: d.customer_snapshot,
        companySnapshot: d.companySnapshot,
        companyRazaoSocial: o.companyRazaoSocial,
        items: d.items || [],
        sanitariosNumeros: (d.sanitarios || []).map((s: any) => s.numero).filter(Boolean),
        responsavelNome: d.responsavelNome,
        responsavelTelefone: d.responsavelTelefone,
        responsavelEmail: d.responsavelEmail,
      });
      toast.success('OS para entrega gerada');
    } catch (e: any) { toast.error(e.message); }
    finally { setPdfBusy(null); }
  };

  const downloadContract = async (
    o: ServiceOrder,
    dataVencimento: string,
    preview: boolean,
    format: 'pdf' | 'docx' = 'pdf',
  ) => {
    setPdfBusy(o.id);
    try {
      const d = await serviceOrdersService.get(o.id) as any;
      const t = (d.tipo_locacao || (o as any).tipoLocacao || '').toLowerCase();
      const src = {
        numero: d.numero || o.numero,
        tipo: 'os' as const,
        tipoContrato: (t === 'evento' ? 'evento' : t === 'obra' ? 'obra' : 'locacao') as 'evento' | 'obra' | 'locacao',
        modalidade: d.modalidade || o.modalidade,
        dataEmissao: d.data_inicio,
        dataInicio: d.data_inicio,
        dataEntrega: d.data_entrega,
        dataFimPrevista: d.data_fim_prevista,
        dataRecolhimento: d.data_recolhimento || o.dataRecolhimento,
        horaEntrega: d.hora_entrega || null,
        localEvento: d.local_evento || null,
        limpezasSemanais: d.limpezas_semanais,
        enderecoEntrega: d.endereco_entrega || o.enderecoEntrega,
        observacoes: d.observacoes,
        frete: d.frete,
        formaPagamento: d.forma_pagamento || (o as any).formaPagamento || null,
        condicoesPagamento: describeFormaPagamento(d.forma_pagamento || (o as any).formaPagamento, d.data_entrega || o.dataEntrega),
        dataVencimento,
        total: Number(d.valor_total || o.valorTotal || 0),
        companySnapshot: d.companySnapshot,
        customerSnapshot: d.customer_snapshot,
        customerName: o.customerName,
        customerAddress: o.customerAddress,
        items: d.items || [],
      };
      if (format === 'docx') {
        const { generateContractDoc } = await import('@/utils/contractDoc');
        await generateContractDoc(src);
        toast.success('Contrato Word gerado');
      } else {
        await generateContractPdf(src, { preview });
        if (!preview) toast.success('Contrato gerado');
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setPdfBusy(null); }
  };

  const navigate = useNavigate();
  const sendToContracts = async (o: ServiceOrder) => {
    // OS já convertida → apenas navega para a aba Contratos filtrando pelo número.
    if (o.convertedContractId) {
      toast.info(`OS ${o.numero} já vinculada ao contrato ${o.convertedContractNumero || ''}`);
      navigate(`/erp/contratos?search=${encodeURIComponent(o.convertedContractNumero || '')}`);
      return;
    }
    if (!o.customerId || !o.companyId) {
      toast.error('OS precisa ter cliente e empresa emissora para gerar contrato');
      return;
    }
    if (!(await confirmDialog({
      description: `Criar contrato a partir da OS ${o.numero}? Ele aparecerá na aba Contratos para revisão/edição manual.`,
    }))) return;
    setPdfBusy(o.id);
    try {
      const r = await serviceOrdersService.convertToContract(o.id);
      toast.success(`Contrato ${r.contractNumero} criado com sucesso`, {
        action: { label: 'Abrir', onClick: () => navigate(`/erp/contratos?search=${encodeURIComponent(r.contractNumero)}`) },
      });
      await load();
    } catch (e: any) {
      // 409 → contrato já existente: navega para ele.
      const msg = String(e?.message || '');
      if (msg.includes('já foi convertida')) {
        toast.info(msg);
        await load();
      } else {
        toast.error(msg || 'Erro ao converter em contrato');
      }
    } finally { setPdfBusy(null); }
  };



  const openFinanceiro = async () => {
    setFinOpen(true);
    await loadFin();
  };
  const loadFin = async () => {
    setFinLoading(true);
    try {
      const data = await serviceOrdersService.financial({
        from: finFrom || undefined, to: finTo || undefined,
        tipoLocacao: tipoFilter || undefined,
      });
      setFinData(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setFinLoading(false); }
  };
  const exportFinCsv = () => {
    if (!finData?.rows?.length) return toast.error('Nada a exportar');
    downloadCsv(`financeiro_${new Date().toISOString().slice(0,10)}`, [
      'OS', 'Cliente', 'Empresa', 'Modalidade', 'Tipo', 'Status',
      'Início', 'Fim previsto', 'Fechamento', 'Valor (R$)',
    ], finData.rows.map((r: any) => [
      r.numero, r.customerName || '', r.companyRazaoSocial || '',
      r.modalidade, r.tipoLocacao || '', r.emAtraso ? 'em_atraso' : r.status,
      r.dataInicio || '', r.dataFimPrevista || '', r.dataFechamento || '',
      Number(r.valorTotal || 0).toFixed(2),
    ]));
  };
  const exportFinPdf = () => {
    if (!finData?.rows?.length) return toast.error('Nada a exportar');
    const periodo = `${finFrom || '...'} até ${finTo || 'hoje'}`;
    downloadPdf({
      filename: `financeiro_${new Date().toISOString().slice(0,10)}`,
      title: 'Relatório Financeiro — Ordens de Serviço',
      subtitle: `Período: ${periodo} · Total: ${BRL(finData.totals.total)} (Fechadas: ${BRL(finData.totals.fechadas)} · Abertas: ${BRL(finData.totals.abertas)})`,
      orientation: 'landscape',
      headers: ['OS', 'Cliente', 'Modalidade', 'Tipo', 'Status', 'Início', 'Fim', 'Valor'],
      rows: finData.rows.map((r: any) => [
        r.numero, r.customerName || '—', r.modalidade, r.tipoLocacao || '—',
        r.emAtraso ? 'EM ATRASO' : r.status,
        r.dataInicio ? formatDateBR(r.dataInicio) : '',
        r.dataFimPrevista ? formatDateBR(r.dataFimPrevista) : '',
        BRL(Number(r.valorTotal || 0)),
      ]),
    });
  };

  // Exportação financeira COMPLETA: OS + itens + sanitários + manutenções + breakdowns + totais
  const exportFinComplete = async (format: 'csv' | 'pdf') => {
    try {
      toast.loading('Gerando relatório completo...', { id: 'fincomp' });
      const data = await serviceOrdersService.financialComplete({
        from: finFrom || undefined, to: finTo || undefined,
      });
      toast.dismiss('fincomp');
      const stamp = new Date().toISOString().slice(0, 10);
      const periodo = `${finFrom || 'início'} → ${finTo || 'hoje'}`;

      if (format === 'csv') {
        // CSV único com múltiplas seções separadas
        const sec = (title: string, headers: string[], rows: any[][]) => [
          [`### ${title}`], headers, ...rows, [''],
        ];
        const all: any[][] = [
          [`RELATÓRIO FINANCEIRO COMPLETO — ${periodo}`], [''],
          ...sec('TOTAIS', ['Métrica', 'Valor'], [
            ['Receita total (R$)', data.totais.receitaTotal.toFixed(2)],
            ['Receita fechadas (R$)', data.totais.receitaFechadas.toFixed(2)],
            ['Receita abertas (R$)', data.totais.receitaAbertas.toFixed(2)],
            ['Receita em atraso (R$)', data.totais.receitaEmAtraso.toFixed(2)],
            ['Custo manutenção (R$)', data.totais.custoManutencao.toFixed(2)],
            ['Resultado líquido (R$)', data.totais.resultadoLiquido.toFixed(2)],
            ['Qtd OS', data.totais.qtdOs],
            ['Qtd Manutenções', data.totais.qtdManutencoes],
          ]),
          ...sec('POR STATUS', ['Status', 'Qtd', 'Total (R$)'],
            data.breakdowns.porStatus.map(b => [b.key, b.count, b.total.toFixed(2)])),
          ...sec('POR MODALIDADE', ['Modalidade', 'Qtd', 'Total (R$)'],
            data.breakdowns.porModalidade.map(b => [b.key, b.count, b.total.toFixed(2)])),
          ...sec('POR TIPO LOCAÇÃO', ['Tipo', 'Qtd', 'Total (R$)'],
            data.breakdowns.porTipoLocacao.map(b => [b.key, b.count, b.total.toFixed(2)])),
          ...sec('POR EMPRESA', ['Empresa', 'Qtd', 'Total (R$)'],
            data.breakdowns.porEmpresa.map(b => [b.key, b.count, b.total.toFixed(2)])),
          ...sec('ORDENS DE SERVIÇO',
            ['OS', 'Cliente', 'CPF/CNPJ', 'Empresa', 'CNPJ', 'Modalidade', 'Tipo', 'Status',
             'Início', 'Fim previsto', 'Fechamento', 'Sanitários', 'Valor (R$)', 'Observações'],
            data.os.map(r => [
              r.numero, r.customerName || '', r.customerDocument || '',
              r.companyRazaoSocial || '', r.companyCnpj || '',
              r.modalidade, r.tipoLocacao || '',
              r.emAtraso ? 'em_atraso' : r.status,
              r.dataInicio || '', r.dataFimPrevista || '', r.dataFechamento || '',
              r.totalSanitarios, Number(r.valorTotal || 0).toFixed(2), r.observacoes || '',
            ])),
          ...sec('ITENS POR OS',
            ['OS', 'Orçamento', 'Produto', 'Descrição', 'Qtd', 'Vlr Unit (R$)', 'Vlr Total (R$)'],
            data.items.map(i => [
              i.osNumero || '', i.quoteNumero, i.produto, i.descricao || '',
              i.quantidade, Number(i.valorUnitario || 0).toFixed(2),
              Number(i.valorTotal || 0).toFixed(2),
            ])),
          ...sec('SANITÁRIOS ALOCADOS',
            ['OS', 'Sanitário', 'Alocado em', 'Devolvido em'],
            data.sanitarios.map(s => [s.osNumero, s.sanitarioNumero, s.alocadoEm || '', s.devolvidoEm || ''])),
          ...sec('MANUTENÇÕES (CUSTOS)',
            ['Data', 'Caminhão', 'Placa', 'Tipo', 'Descrição', 'Status', 'Responsável', 'Custo (R$)'],
            data.manutencoes.map(m => [
              m.maintenanceDate || '', m.truckName || '', m.truckPlate || '',
              m.tipo || '', m.description || '', m.status || '', m.performedBy || '',
              Number(m.cost || 0).toFixed(2),
            ])),
        ];
        downloadCsv(`financeiro_completo_${stamp}`, [], all);
        toast.success('CSV completo gerado');
      } else {
        // PDF abrangente com seções
        const { default: jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14);
        doc.text('Relatório Financeiro Completo — Ordens de Serviço', 14, 14);
        doc.setFontSize(9); doc.setTextColor(100);
        doc.text(`Período: ${periodo} · Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20);

        const T = data.totais;
        autoTable(doc, {
          startY: 25,
          head: [['Métrica', 'Valor']],
          body: [
            ['Receita total', BRL(T.receitaTotal)],
            ['Receita fechadas (realizada)', BRL(T.receitaFechadas)],
            ['Receita abertas (prevista)', BRL(T.receitaAbertas)],
            ['Receita em atraso', BRL(T.receitaEmAtraso)],
            ['Custo manutenção', BRL(T.custoManutencao)],
            ['Resultado líquido (fechadas − manutenção)', BRL(T.resultadoLiquido)],
            ['Qtd OS / Manutenções', `${T.qtdOs} / ${T.qtdManutencoes}`],
          ],
          styles: { fontSize: 9 }, headStyles: { fillColor: [37, 99, 235] },
        });

        const addSection = (title: string, head: string[], body: any[][]) => {
          if (!body.length) return;
          doc.addPage();
          doc.setFontSize(12); doc.setTextColor(0); doc.text(title, 14, 14);
          autoTable(doc, {
            startY: 18, head: [head], body,
            styles: { fontSize: 8, cellPadding: 1.5 },
            headStyles: { fillColor: [37, 99, 235] },
            alternateRowStyles: { fillColor: [243, 244, 246] },
          });
        };

        addSection('Breakdown por Status', ['Status', 'Qtd', 'Total'],
          data.breakdowns.porStatus.map(b => [b.key, b.count, BRL(b.total)]));
        addSection('Breakdown por Modalidade', ['Modalidade', 'Qtd', 'Total'],
          data.breakdowns.porModalidade.map(b => [b.key, b.count, BRL(b.total)]));
        addSection('Breakdown por Tipo de Locação', ['Tipo', 'Qtd', 'Total'],
          data.breakdowns.porTipoLocacao.map(b => [b.key, b.count, BRL(b.total)]));
        addSection('Breakdown por Empresa Emissora', ['Empresa', 'Qtd', 'Total'],
          data.breakdowns.porEmpresa.map(b => [b.key, b.count, BRL(b.total)]));
        addSection('Ordens de Serviço',
          ['OS', 'Cliente', 'Modal.', 'Tipo', 'Status', 'Início', 'Fim', 'San.', 'Valor'],
          data.os.map(r => [
            r.numero, r.customerName || '—', r.modalidade, r.tipoLocacao || '—',
            r.emAtraso ? 'EM ATRASO' : r.status, D(r.dataInicio), D(r.dataFimPrevista),
            r.totalSanitarios, BRL(Number(r.valorTotal || 0)),
          ]));
        addSection('Itens por OS',
          ['OS', 'Produto', 'Qtd', 'Vlr Unit', 'Vlr Total'],
          data.items.map(i => [
            i.osNumero || '—', i.produto, i.quantidade,
            BRL(Number(i.valorUnitario || 0)), BRL(Number(i.valorTotal || 0)),
          ]));
        addSection('Sanitários Alocados',
          ['OS', 'Sanitário', 'Alocado em', 'Devolvido em'],
          data.sanitarios.map(s => [s.osNumero, s.sanitarioNumero, D(s.alocadoEm), D(s.devolvidoEm)]));
        addSection('Manutenções (custos)',
          ['Data', 'Caminhão', 'Tipo', 'Descrição', 'Status', 'Custo'],
          data.manutencoes.map(m => [
            D(m.maintenanceDate), `${m.truckName || ''} ${m.truckPlate || ''}`.trim(),
            m.tipo || '—', m.description || '', m.status || '—', BRL(Number(m.cost || 0)),
          ]));

        doc.save(`financeiro_completo_${stamp}.pdf`);
        toast.success('PDF completo gerado');
      }
    } catch (e: any) {
      toast.dismiss('fincomp');
      toast.error(e.message || 'Falha ao gerar relatório');
    }
  };

  const openHistorico = async () => {
    setHistOpen(true);
    await loadHist();
  };
  const loadHist = async () => {
    setHistLoading(true);
    try {
      const data = await serviceOrdersService.movements({
        type: histType || undefined,
        sanitarioNumero: histSan || undefined,
        limit: 500,
      });
      setHist(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setHistLoading(false); }
  };
  const exportHistCsv = () => {
    if (!hist.length) return toast.error('Nada a exportar');
    downloadCsv(`historico_movimentacao_${new Date().toISOString().slice(0,10)}`, [
      'Quando', 'Sanitário', 'Operação', 'Cliente', 'Endereço', 'Motorista', 'Notas',
    ], hist.map(m => [
      new Date(m.occurredAt).toLocaleString('pt-BR'),
      m.sanitarioNumero, m.operationType, m.customerName || '',
      m.address || '', m.driverName || '', m.notes || '',
    ]));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Ordens de Serviço</h1>
            <Badge variant="secondary">{counts.todas}</Badge>
            {counts.atrasadas > 0 && (
              <Badge className="bg-red-600 text-white gap-1 animate-pulse">
                <AlertTriangle className="h-3 w-3" /> {counts.atrasadas} em atraso
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openHistorico}>
              <History className="h-4 w-4 mr-1" />Histórico
            </Button>
            <Button variant="outline" size="sm" onClick={openFinanceiro}>
              <FileDown className="h-4 w-4 mr-1" />Financeiro
            </Button>
            <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" />Recarregar</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por número ou cliente…"
                     value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="border rounded-md h-9 px-2 bg-background text-sm"
                    value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}>
              <option value="">Todos tipos</option>
              <option value="obra">🏗️ Obra</option>
              <option value="evento">🎉 Evento</option>
              <option value="industria">🏭 Indústria</option>
              <option value="outro">Outro</option>
            </select>
            <div className="flex gap-1 flex-wrap">
              {(['todas', 'abertas', 'atrasadas', 'fechadas'] as const).map(t => (
                <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'}
                        onClick={() => setTab(t)}
                        className={tab !== t && t === 'atrasadas' && counts.atrasadas > 0 ? 'border-red-300 text-red-700' : ''}>
                  {t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t]})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhuma OS</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visible.map(o => {
              return (
              <Card
                key={o.id}
                className={`hover:shadow-md hover:border-primary/40 transition-all cursor-pointer ${o.emAtraso ? 'border-red-300 bg-red-50/40' : ''}`}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="w-full flex items-start justify-between gap-2 cursor-pointer" onClick={() => openDetail(o)}>
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-sm">{o.numero}</div>
                      <div className="text-sm font-semibold truncate">{o.customerName || '—'}</div>
                    </div>
                    {o.emAtraso ? (
                      <Badge className="bg-red-600 text-white gap-1"><AlertTriangle className="h-3 w-3" />Atrasada</Badge>
                    ) : (
                      <>
                        {o.status === 'em_cliente' || o.status === 'entregue' ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Em Cliente</Badge>
                        ) : o.status === 'recolhimento' || o.status === 'recolhimento_solicitado' ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200">Recolhimento</Badge>
                        ) : (
                          <Badge className={o.status === 'fechada' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'}>
                            {o.status}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 cursor-pointer" onClick={() => openDetail(o)}>
                    <div>{o.modalidade === 'diaria' ? '🗓 Diária' : '📅 Mensal'} · {BRL(o.valorTotal)}</div>
                    <div>Tipo: {tipoLabel((o as any).tipoLocacao)}</div>
                    <div>
                      Início: {D(o.dataEntrega || o.dataInicio)}
                      {o.dataRecolhimento && <> · Fim previsto: {D(o.dataRecolhimento)}</>}
                    </div>
                    <div>Sanitários alocados: <strong>{o.sanitariosAlocados || 0}</strong></div>
                  </div>

                  <div className="flex gap-1 pt-2 border-t flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="flex-1 min-w-[110px]"
                            onClick={() => openOsHistory(o)}>
                      <History className="h-3.5 w-3.5 mr-1" /> Histórico / Fotos
                    </Button>
                    <Button size="sm" variant="default" className="flex-1 min-w-[110px] bg-green-700 hover:bg-green-800"
                            onClick={() => downloadOsPdf(o)} disabled={pdfBusy === o.id}>
                      {pdfBusy === o.id
                        ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        : <FileText className="h-3.5 w-3.5 mr-1" />}
                      Gerar OS PDF
                    </Button>
                    <Button size="sm" variant="default" className="flex-1 min-w-[110px] bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => setContractTarget(o)} disabled={pdfBusy === o.id}>
                      <FileSignature className="h-3.5 w-3.5 mr-1" /> Gerar Contrato (PDF)
                    </Button>
                  </div>
                  <div className="flex gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline"
                            className={`flex-1 min-w-[140px] ${o.convertedContractId ? 'text-emerald-700 border-emerald-300 hover:bg-emerald-50' : 'text-indigo-700 border-indigo-300 hover:bg-indigo-50'}`}
                            onClick={() => sendToContracts(o)} disabled={pdfBusy === o.id}>
                      <FileSignature className="h-3.5 w-3.5 mr-1" />
                      {o.convertedContractId
                        ? `Ver contrato ${o.convertedContractNumero || ''}`.trim()
                        : 'Enviar para Contratos'}
                    </Button>
                  </div>
                  <div className="flex gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    {(o.status === 'entregue' || o.status === 'em_cliente') ? (
                      <Button size="sm" variant="outline" className="flex-1 text-amber-600 border-amber-300 hover:bg-amber-50" 
                              onClick={() => openRecolhimento(o)}>
                        <RefreshCcw className="h-3.5 w-3.5 mr-1" />Indicar Recolhimento
                      </Button>
                    ) : (o.status !== 'fechada' && o.status !== 'cancelada' && o.status !== 'recolhimento') && (
                      <Button size="sm" variant="outline" className="flex-1 text-green-700 border-green-300 hover:bg-green-50" 
                              onClick={() => close(o)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Fechar e devolver
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(o)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[24, 48, 96, 200]}
        />

      </div>

      {/* Financeiro */}
      <Dialog open={finOpen} onOpenChange={setFinOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório Financeiro · Ordens de Serviço</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">De</label>
              <Input type="date" value={finFrom} onChange={e => setFinFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Até</label>
              <Input type="date" value={finTo} onChange={e => setFinTo(e.target.value)} className="h-9" />
            </div>
            <Button size="sm" onClick={loadFin} disabled={finLoading}>
              {finLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={exportFinCsv}>
              <FileDown className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportFinPdf}>
              <FileDown className="h-4 w-4 mr-1" />PDF
            </Button>
            <Button size="sm" onClick={() => exportFinComplete('csv')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <FileDown className="h-4 w-4 mr-1" />Completo CSV
            </Button>
            <Button size="sm" onClick={() => exportFinComplete('pdf')} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              <FileDown className="h-4 w-4 mr-1" />Completo PDF
            </Button>
          </div>
          {finData && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Card><CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Total geral</div>
                <div className="text-xl font-bold text-primary">{BRL(finData.totals.total)}</div>
                <div className="text-[10px] text-muted-foreground">{finData.totals.count} OS</div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Fechadas (realizado)</div>
                <div className="text-xl font-bold text-green-700">{BRL(finData.totals.fechadas)}</div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Abertas (previsto)</div>
                <div className="text-xl font-bold text-blue-700">{BRL(finData.totals.abertas)}</div>
              </CardContent></Card>
            </div>
          )}
          <div className="border rounded overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">OS</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Modal.</th>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Início</th>
                  <th className="text-right p-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(finData?.rows || []).map((r: any) => (
                  <tr key={r.id} className={r.emAtraso ? 'bg-red-50' : 'border-t'}>
                    <td className="p-2 font-mono">{r.numero}</td>
                    <td className="p-2">{r.customerName || '—'}</td>
                    <td className="p-2">{r.modalidade}</td>
                    <td className="p-2">{r.tipoLocacao || '—'}</td>
                    <td className="p-2">{r.emAtraso ? 'EM ATRASO' : r.status}</td>
                    <td className="p-2">{D(r.dataInicio)}</td>
                    <td className="p-2 text-right tabular-nums">{BRL(Number(r.valorTotal || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Histórico de movimentação */}
      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Movimentação · Sanitários</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Sanitário (nº)</label>
              <Input value={histSan} onChange={e => setHistSan(e.target.value)} className="h-9 w-32" placeholder="Ex.: 042" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Operação</label>
              <select className="border rounded-md h-9 px-2 bg-background text-sm"
                      value={histType} onChange={e => setHistType(e.target.value)}>
                <option value="">Todas</option>
                <option value="entrega">Entrega</option>
                <option value="recolhimento">Recolhimento</option>
                <option value="manutencao">Manutenção</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
            <Button size="sm" onClick={loadHist} disabled={histLoading}>
              {histLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={exportHistCsv}>
              <FileDown className="h-4 w-4 mr-1" />CSV
            </Button>
          </div>
          <div className="border rounded overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Quando</th>
                  <th className="text-left p-2">Sanitário</th>
                  <th className="text-left p-2">Operação</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Endereço</th>
                  <th className="text-left p-2">Motorista</th>
                </tr>
              </thead>
              <tbody>
                {hist.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2">{DT(m.occurredAt)}</td>
                    <td className="p-2 font-mono">{m.sanitarioNumero}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">{m.operationType}</Badge>
                    </td>
                    <td className="p-2">{m.customerName || '—'}</td>
                    <td className="p-2 max-w-[240px] truncate" title={m.address}>{m.address || '—'}</td>
                    <td className="p-2">{m.driverName || '—'}</td>
                  </tr>
                ))}
                {!hist.length && !histLoading && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma movimentação encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <BoletoVencimentoDialog
        open={!!contractTarget}
        contractLabel={contractTarget ? `contrato da OS ${contractTarget.numero}` : undefined}
        formaPagamento={(contractTarget as any)?.formaPagamento || 'boleto'}
        dataEntrega={contractTarget?.dataEntrega || null}
        onClose={() => setContractTarget(null)}
        onConfirm={async ({ dataVencimento, preview, format }) => {
          const o = contractTarget;
          setContractTarget(null);
          if (o) await downloadContract(o, dataVencimento, preview, format);
        }}
      />

      {/* Detalhes da OS — modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              OS <span className="font-mono">{detailOs?.numero}</span>
              {detailOs && (detailOs.emAtraso
                ? <Badge className="bg-red-600 text-white gap-1 ml-2"><AlertTriangle className="h-3 w-3" />Atrasada</Badge>
                : (detailOs.status === 'em_cliente' || detailOs.status === 'entregue')
                  ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 ml-2">Em Cliente</Badge>
                  : (detailOs.status === 'recolhimento' || detailOs.status === 'recolhimento_solicitado')
                  ? <Badge className="bg-amber-100 text-amber-700 border-amber-200 ml-2">Recolhimento</Badge>
                  : <Badge className={`ml-2 ${detailOs.status === 'fechada' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'}`}>{detailOs.status}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando detalhes…
            </div>
          )}

          {!detailLoading && detailOs && detailData && (() => {
            const o = detailOs as any;
            const det = detailData as any;
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div><strong>Empresa:</strong> {o.companyRazaoSocial || det.companySnapshot?.razao_social || '—'}</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <strong>Cliente:</strong> {o.customerName || '—'}
                      {det.customer_snapshot?.contact_phone && <> · {det.customer_snapshot.contact_phone}</>}
                      {det.customer_snapshot?.contact_name && <> · {det.customer_snapshot.contact_name}</>}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 md:col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div><strong>Endereço:</strong> {det.endereco_entrega || o.customerAddress || '—'}</div>
                  </div>
                  <div className="flex items-start gap-2 md:col-span-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <strong>Entrega:</strong> {D(det.data_entrega || o.dataEntrega)}
                      {(det.data_recolhimento || o.dataRecolhimento) && <> · <strong>Recolhimento:</strong> {D(det.data_recolhimento || o.dataRecolhimento)}</>}
                      {det.data_fechamento && <> · <strong>Fechada em:</strong> {D(det.data_fechamento)}</>}
                    </div>
                  </div>
                  <div>
                    <strong>Modalidade:</strong> {o.modalidade === 'diaria' ? '🗓 Diária' : '📅 Mensal'}
                  </div>
                  <div>
                    <strong>Tipo:</strong> {tipoLabel((o as any).tipoLocacao)}
                  </div>
                  {o.modalidade === 'mensal' && (det.limpezas_semanais ?? o.limpezasSemanais) != null && (det.tipo_locacao || o.tipoLocacao) !== 'evento' && (
                    <div>🧽 <strong>Limpezas/semana:</strong> {det.limpezas_semanais ?? o.limpezasSemanais}</div>
                  )}
                </div>

                {(det.forma_pagamento || (o as any).formaPagamento) && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded p-2 text-indigo-900 text-xs">
                    💳 <strong>Pagamento:</strong> {describeFormaPagamento(det.forma_pagamento || (o as any).formaPagamento, det.data_entrega || o.dataEntrega)}
                  </div>
                )}
                {det.observacoes && (
                  <div className="bg-muted/30 rounded p-2 text-xs">
                    <strong>Observações:</strong> {det.observacoes}
                  </div>
                )}

                {Array.isArray(det.items) && det.items.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 font-semibold mt-1 mb-1">
                      <Package className="h-4 w-4" /> Itens
                    </div>
                    <table className="w-full border rounded overflow-hidden text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left p-1.5">Produto</th>
                          <th className="text-right p-1.5">Qtd</th>
                          <th className="text-right p-1.5">Valor un.</th>
                          <th className="text-right p-1.5">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {det.items.map((it: any, i: number) => {
                          const isGeneric = it.isGenericService || !it.isSanitario;
                          return (
                            <tr key={i} className="border-t">
                              <td className="p-1.5">
                                <div className="flex flex-col">
                                  <span className="font-medium">{it.produto}</span>
                                  {it.descricao && <span className="text-[10px] text-muted-foreground">{it.descricao}</span>}
                                  {isGeneric && (det.entreguePorNome || det.recolhidoPorNome) && (
                                    <Badge variant="outline" className="w-fit text-[9px] h-4 px-1 mt-1 bg-blue-50 text-blue-600 border-blue-200">Serviço</Badge>
                                  )}
                                  {!isGeneric && (
                                    <Badge variant="outline" className="w-fit text-[9px] h-4 px-1 mt-1 bg-emerald-50 text-emerald-600 border-emerald-200">Sanitário</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-1.5 text-right">{Number(it.quantidade || 0)}</td>
                              <td className="p-1.5 text-right">{BRL(Number(it.valorUnitario || it.valor_unitario || 0))}</td>
                              <td className="p-1.5 text-right tabular-nums">{BRL(Number(it.valorTotal || it.valor_total || (Number(it.quantidade) || 0) * Number(it.valorUnitario || it.valor_unitario || 0)))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {(det.entreguePorNome || det.recolhidoPorNome) && (
                  <div className="grid grid-cols-2 gap-4 border-t pt-2 mt-1">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Entrega realizada por</p>
                      <p className="text-xs font-semibold">{det.entreguePorNome || '—'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Recolhimento realizado por</p>
                      <p className="text-xs font-semibold">{det.recolhidoPorNome || '—'}</p>
                    </div>
                  </div>
                )}

                {Array.isArray(det.sanitarios) && det.sanitarios.length > 0 && (
                  <div>
                    <div className="font-semibold mt-1 mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" /> Sanitários vinculados ({det.sanitarios.filter((s: any) => s.numero).length})
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {det.sanitarios.filter((s: any) => s.numero).map((s: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50">
                          <div className="w-10 h-10 rounded border bg-white overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                            {s.ultimaFotoUrl || s.fotoFinalizacaoUrl ? (
                              <img src={s.ultimaFotoUrl || s.fotoFinalizacaoUrl} alt="Foto" className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(s.ultimaFotoUrl || s.fotoFinalizacaoUrl, '_blank')} />
                            ) : (
                              <Package className="h-4 w-4 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold truncate">#{s.numero}</div>
                            <div className="text-[9px] text-muted-foreground uppercase truncate">{s.categoria || 'Comum'}</div>
                            {(s.devolvidoEm || s.devolvido_em) && <Badge className="bg-emerald-100 text-emerald-700 text-[8px] h-3 px-1 mt-0.5">Devolvido</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Relatos de Serviços Genéricos */}
                {det.items.some((it: any) => it.isGenericService || !it.isSanitario) && (det.entreguePorNome || det.recolhidoPorNome) && (
                  <div className="mt-2 space-y-2">
                    <div className="font-semibold text-xs flex items-center gap-2">
                      <FileSignature className="h-3 w-3" /> Execução de Serviços
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {det.items.filter((it: any) => it.isGenericService || !it.isSanitario).map((it: any, idx: number) => {
                        // Tenta achar um registro de finalização correspondente (pode estar na OS ou nos vinculados)
                        // Como serviços genéricos não têm numeração de sanitário, eles salvam o relato na erp_os_sanitarios com id nulo ou similar?
                        // Na verdade, a implementação anterior salvava no app-funcionarios.ts o relato.
                        return (
                          <div key={idx} className="p-2 border rounded-lg bg-blue-50/30 text-xs">
                            <div className="font-bold text-blue-700">{it.produto}</div>
                            <div className="mt-1 text-slate-600 italic">
                              {det.sanitarios?.find((s: any) => !s.numero && s.relatoFinalizacao)?.relatoFinalizacao || "Aguardando execução ou relato não preenchido."}
                            </div>
                            {det.sanitarios?.find((s: any) => !s.numero && s.fotoFinalizacaoUrl)?.fotoFinalizacaoUrl && (
                              <div className="mt-2 w-24 h-24 rounded border overflow-hidden">
                                <img 
                                  src={det.sanitarios?.find((s: any) => !s.numero && s.fotoFinalizacaoUrl).fotoFinalizacaoUrl} 
                                  className="w-full h-full object-cover cursor-pointer" 
                                  onClick={() => window.open(det.sanitarios?.find((s: any) => !s.numero && s.fotoFinalizacaoUrl).fotoFinalizacaoUrl, '_blank')}
                                  alt="Execução" 
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="border-t pt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Frete: {BRL(Number(det.frete || 0))}</span>
                  <span className="text-base"><strong>Total: {BRL(Number(det.valor_total || o.valorTotal || 0))}</strong></span>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      {/* Histórico Detalhado da OS com Fotos e Auditoria */}
      <Dialog open={osHistoryOpen} onOpenChange={setOsHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico Completo OS <span className="font-mono">{osHistoryTarget?.numero}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Timeline */}
            <div className="relative space-y-6">
              {/* Linha vertical central */}
              <div className="absolute left-[19px] top-2 bottom-0 w-0.5 bg-slate-200"></div>

              {osHistoryLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                </div>
              )}

              {!osHistoryLoading && osHistory.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p>Nenhum registro no histórico ainda.</p>
                </div>
              )}

              {osHistory.map((item, idx) => {
                const isPhoto = item.source === 'FOTO';
                const isNote = item.source === 'NOTA';
                const isStatus = item.tipo === 'STATUS_CHANGE';

                return (
                  <div key={idx} className="relative pl-10">
                    {/* Ícone da timeline */}
                    <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${
                      isPhoto ? 'bg-blue-100 text-blue-600' :
                      isNote ? 'bg-amber-100 text-amber-600' :
                      isStatus ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isPhoto ? <Camera className="h-4 w-4" /> :
                       isNote ? <MessageSquare className="h-4 w-4" /> :
                       isStatus ? <RefreshCcw className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>

                    <div className="bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {isPhoto ? 'Foto Operacional' : isNote ? 'Nota Interna' : isStatus ? 'Alteração de Status' : item.tipo}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {DT(item.created_at)}
                        </span>
                      </div>

                      <div className="text-sm font-medium text-slate-800">
                        {item.descricao}
                      </div>

                      {item.author_name && (
                        <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                          <User className="h-3 w-3" /> {item.author_name}
                        </div>
                      )}

                      {/* Conteúdo Extra: Foto */}
                      {isPhoto && item.payload?.url && (
                        <div className="mt-3 space-y-2">
                          <div className="relative group w-full max-w-sm rounded-lg overflow-hidden border shadow-inner bg-slate-50 aspect-video flex items-center justify-center">
                            <img 
                              src={item.payload.url} 
                              alt="Evidência" 
                              className="w-full h-full object-contain cursor-pointer transition-transform group-hover:scale-105"
                              onClick={() => window.open(item.payload.url, '_blank')}
                            />
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-lg" onClick={() => window.open(item.payload.url, '_blank')}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {item.payload.estado && (
                            <Badge variant="outline" className="text-[9px] uppercase">Estado: {item.payload.estado}</Badge>
                          )}
                        </div>
                      )}

                      {/* Conteúdo Extra: Status Change */}
                      {isStatus && item.payload && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 line-through opacity-50">{item.payload.old_status}</Badge>
                          <RefreshCcw className="h-3 w-3 text-slate-300" />
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{item.payload.new_status}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Área de Notas Internas */}
          <div className="p-4 bg-slate-50 border-t space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <textarea
                  placeholder="Adicionar nota interna..."
                  className="w-full min-h-[80px] pl-10 pr-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none bg-white"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                />
              </div>
              <Button 
                className="self-end rounded-xl px-6" 
                onClick={addNote} 
                disabled={noteBusy || !newNote.trim()}
              >
                {noteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Nota'}
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 italic px-1">
              * Notas internas são visíveis apenas para o administrativo.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceOrders;
