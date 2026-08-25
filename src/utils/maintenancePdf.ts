/**
 * PDFs de manutenção:
 *  - generateMaintenanceOrderPdf: ordem de serviço individual (1 manutenção)
 *  - generateMaintenanceReportPdf: relatório consolidado por período
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MaintenanceRecord } from '@/hooks/useMaintenanceManagement';

const D = (s?: string | null) => {
  if (!s) return '—';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR');
};
const M2 = (n: number) =>
  `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const KM = (n?: number | null) =>
  n != null ? `${Number(n).toLocaleString('pt-BR')} km` : '—';

const TYPE_LABEL: Record<string, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
  preditiva: 'Preditiva',
  revisao: 'Revisão',
  inspecao: 'Inspeção',
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendada',
  pending: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
};

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(21, 128, 61);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 14, 20);
  doc.setFontSize(9);
  doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, W - 14, 13, { align: 'right' });
  doc.setTextColor(0, 0, 0);
}

function drawFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Página ${i} de ${pages}`, W - 14, H - 6, { align: 'right' });
    doc.text('Gestão de Manutenção da Frota', 14, H - 6);
  }
}

export function generateMaintenanceOrderPdf(r: MaintenanceRecord) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;

  drawHeader(
    doc,
    'ORDEM DE MANUTENÇÃO',
    `Nº ${String(r.id).slice(0, 8).toUpperCase()}  ·  ${TYPE_LABEL[r.maintenance_type] || r.maintenance_type}`
  );

  let y = 38;

  // Bloco veículo
  doc.setFillColor(240, 253, 244);
  doc.rect(M, y - 5, W - 2 * M, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('VEÍCULO', M + 2, y);
  y += 6;
  doc.setFontSize(13);
  doc.text(r.truck_name || '—', M + 2, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Placa: ${r.truck_plate || '—'}`, W - M - 2, y, { align: 'right' });
  y += 5;
  doc.text(`Km no momento: ${KM(r.mileage)}`, M + 2, y);
  if (r.next_maintenance_km) {
    doc.text(`Próxima revisão: ${KM(r.next_maintenance_km)}`, W - M - 2, y, { align: 'right' });
  }
  y += 10;

  // Dados gerais (tabela 2 colunas)
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2.5 },
    headStyles: { fillColor: [21, 128, 61], textColor: 255 },
    head: [['Campo', 'Valor']],
    body: [
      ['Tipo', TYPE_LABEL[r.maintenance_type] || r.maintenance_type],
      ['Status', STATUS_LABEL[r.status] || r.status],
      ['Data agendada', D(r.scheduled_date)],
      ['Fornecedor / Oficina', r.supplier || '—'],
      ['Nota fiscal', r.invoice_number || '—'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Descrição
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Descrição do serviço', M, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const desc = doc.splitTextToSize(r.description || '—', W - 2 * M);
  doc.text(desc, M, y);
  y += desc.length * 5 + 4;

  // Itens
  const items = r.items || [];
  const totalItens = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );
  if (items.length) {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Peça / Serviço', 'Qtd', 'Vlr unit.', 'Subtotal']],
      body: items.map((it, i) => [
        String(i + 1),
        it.description || '—',
        String(Number(it.quantity) || 0),
        M2(Number(it.unit_price) || 0),
        M2((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)),
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [21, 128, 61], textColor: 255 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
      },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // Totais
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(21, 128, 61);
  doc.text(`CUSTO TOTAL: ${M2(r.cost || totalItens)}`, W - M, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 12;

  // Assinaturas
  const H = doc.internal.pageSize.getHeight();
  y = Math.max(y, H - 45);
  doc.setDrawColor(180);
  doc.line(M, y, M + 80, y);
  doc.line(W - M - 80, y, W - M, y);
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text('Responsável pela frota', M, y + 4);
  doc.text('Oficina / Mecânico', W - M - 80, y + 4);

  drawFooter(doc);
  doc.save(`OS-Manutencao-${String(r.id).slice(0, 8)}.pdf`);
}

export function generateMaintenanceReportPdf(
  records: MaintenanceRecord[],
  range: { startDate?: string; endDate?: string }
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const M = 12;

  drawHeader(
    doc,
    'RELATÓRIO DE MANUTENÇÕES',
    `Período: ${D(range.startDate)} a ${D(range.endDate)}  ·  ${records.length} registro(s)`
  );

  let y = 36;

  // KPIs
  const total = records.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const concluidas = records.filter((r) => r.status === 'completed').length;
  const pendentes = records.filter((r) => r.status !== 'completed').length;
  const media = records.length ? total / records.length : 0;

  const kpis = [
    ['Total gasto', M2(total)],
    ['Custo médio', M2(media)],
    ['Concluídas', String(concluidas)],
    ['Pendentes / em andamento', String(pendentes)],
  ];
  const colW = (W - 2 * M) / kpis.length;
  kpis.forEach(([label, value], i) => {
    const x = M + i * colW;
    doc.setFillColor(243, 244, 246);
    doc.rect(x + 2, y, colW - 4, 18, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(label, x + 6, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(21, 128, 61);
    doc.text(value, x + 6, y + 14);
  });
  doc.setTextColor(0, 0, 0);
  y += 24;

  // Resumo por tipo
  const byType: Record<string, { count: number; cost: number }> = {};
  records.forEach((r) => {
    const k = TYPE_LABEL[r.maintenance_type] || r.maintenance_type || '—';
    byType[k] = byType[k] || { count: 0, cost: 0 };
    byType[k].count += 1;
    byType[k].cost += Number(r.cost) || 0;
  });
  autoTable(doc, {
    startY: y,
    head: [['Tipo', 'Quantidade', 'Custo total', 'Custo médio']],
    body: Object.entries(byType).map(([k, v]) => [
      k,
      String(v.count),
      M2(v.cost),
      M2(v.cost / v.count),
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [21, 128, 61], textColor: 255 },
    columnStyles: {
      1: { halign: 'center', cellWidth: 30 },
      2: { halign: 'right', cellWidth: 40, fontStyle: 'bold' },
      3: { halign: 'right', cellWidth: 40 },
    },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Resumo por caminhão
  const byTruck: Record<string, { count: number; cost: number; plate: string }> = {};
  records.forEach((r) => {
    const k = r.truck_name || '—';
    byTruck[k] = byTruck[k] || { count: 0, cost: 0, plate: r.truck_plate || '—' };
    byTruck[k].count += 1;
    byTruck[k].cost += Number(r.cost) || 0;
  });
  autoTable(doc, {
    startY: y,
    head: [['Caminhão', 'Placa', 'Manutenções', 'Custo total']],
    body: Object.entries(byTruck)
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(([k, v]) => [k, v.plate, String(v.count), M2(v.cost)]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [21, 128, 61], textColor: 255 },
    columnStyles: {
      2: { halign: 'center', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 45, fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Detalhado
  autoTable(doc, {
    startY: y,
    head: [[
      'Data', 'Caminhão', 'Placa', 'Tipo', 'Status',
      'Km', 'Fornecedor', 'NF', 'Custo',
    ]],
    body: records.map((r) => [
      D(r.scheduled_date),
      r.truck_name || '—',
      r.truck_plate || '—',
      TYPE_LABEL[r.maintenance_type] || r.maintenance_type,
      STATUS_LABEL[r.status] || r.status,
      KM(r.mileage),
      r.supplier || '—',
      r.invoice_number || '—',
      M2(r.cost || 0),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [21, 128, 61], textColor: 255 },
    columnStyles: {
      8: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
    didDrawPage: () => {
      // header em páginas extras
    },
  });

  drawFooter(doc);
  doc.save(`Relatorio-Manutencoes-${range.startDate || ''}_${range.endDate || ''}.pdf`);
}
