/**
 * Medição em PDF — mesmo layout visual do recibo unificado (header azul + acento
 * dourado). Diferente do recibo: é uma proposta de faturamento (pré-recibo),
 * lista produtos/quantidade/valor unitário/total e não traz "PAGO".
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { maskCnpj, maskCpf } from '@/utils/brazilianDocs';
import { loadPdfImage, fitContain } from '@/utils/pdfImage';
import { formatDateBR, formatPeriodo } from '@/utils/dateFormat';
import type { Medicao, MedicaoItem } from '@/services/medicoes';

const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const D = (s?: string | null) => s ? formatDateBR(s) : '—';
const maskDoc = (d?: string | null) => {
  if (!d) return '';
  const x = d.replace(/\D/g, '');
  if (x.length === 11) return maskCpf(x);
  if (x.length === 14) return maskCnpj(x);
  return d;
};

const PRIMARY: [number, number, number] = [16, 42, 96];
const ACCENT:  [number, number, number] = [212, 175, 55];

function formatComp(c?: string | null) {
  if (!c) return '';
  const [a, m] = c.split('-');
  const meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return m ? `${meses[Number(m)] || m}/${a}` : c;
}

export async function generateMedicaoPdf(med: Medicao & { items: MedicaoItem[] }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const snap = med.snapshot || {};
  const co = snap.company || {};
  const cu = snap.customer || {};

  // ---------- Header ----------
  const HEADER_H = 42;
  doc.setFillColor(...PRIMARY); doc.rect(0, 0, W, HEADER_H, 'F');
  doc.setFillColor(...ACCENT);  doc.rect(0, HEADER_H, W, 1.5, 'F');

  const boxW = 62, boxH = 30, boxX = W - M - boxW, boxY = 6;

  let textX = M;
  const logo = co.logoDataUrl || co.logoUrl;
  if (logo) {
    try {
      const img = await loadPdfImage(logo);
      const cardX = M, cardY = 6, cardW = 30, cardH = 30;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'F');
      const fit = fitContain(img, cardX, cardY, cardW, cardH, 2);
      doc.addImage(img.dataUrl, img.format, fit.x, fit.y, fit.w, fit.h, undefined, 'FAST');
      textX = cardX + cardW + 5;
    } catch { /* ignore */ }
  }

  const textMaxW = boxX - textX - 4;
  doc.setTextColor(255, 255, 255);
  const rawName = String(co.razaoSocial || '—').toUpperCase();
  doc.setFont('helvetica', 'bold');
  let nameSize = 13; doc.setFontSize(nameSize);
  while (nameSize > 8 && doc.getTextWidth(rawName) > textMaxW) { nameSize -= 0.5; doc.setFontSize(nameSize); }
  let lineY = 13;
  if (doc.getTextWidth(rawName) <= textMaxW) { doc.text(rawName, textX, lineY); lineY += 6; }
  else {
    const wrapped = doc.splitTextToSize(rawName, textMaxW).slice(0, 2);
    for (const w of wrapped) { doc.text(w, textX, lineY); lineY += 5; }
    lineY += 1;
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const lin = [co.cnpj ? `CNPJ ${maskCnpj(co.cnpj)}` : null,
               co.inscricaoEstadual ? `IE ${co.inscricaoEstadual}` : null].filter(Boolean).join('  ·  ');
  if (lin) { doc.text(lin, textX, lineY, { maxWidth: textMaxW }); lineY += 5; }
  const end = [co.endereco, co.cidade && `${co.cidade}/${co.estado || ''}`, co.cep && `CEP ${co.cep}`]
    .filter(Boolean).join(' · ');
  if (end) {
    const wEnd = doc.splitTextToSize(end, textMaxW).slice(0, 2);
    for (const w of wEnd) { doc.text(w, textX, lineY); lineY += 4.5; }
  }
  const cont = [co.telefone, co.email].filter(Boolean).join('  ·  ');
  if (cont) doc.text(cont, textX, lineY, { maxWidth: textMaxW });

  // Caixa MEDIÇÃO Nº
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'F');
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('MEDIÇÃO Nº', boxX + 3, boxY + 6);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(med.numero, boxX + boxW - 3, boxY + 14, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('Emissão', boxX + 3, boxY + 20);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(D(med.createdAt?.slice(0, 10)), boxX + boxW - 3, boxY + 20, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('Competência', boxX + 3, boxY + 27);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(formatComp(med.competencia) || '—', boxX + boxW - 3, boxY + 27, { align: 'right' });

  // ---------- Título ----------
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('MEDIÇÃO DE SERVIÇOS', W / 2, 50, { align: 'center' });

  // ---------- Valor em destaque ----------
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(M, 56, W - 2 * M, 18, 2, 2, 'F');
  doc.setFillColor(...PRIMARY);
  doc.rect(M, 56, 1.5, 18, 'F');
  doc.setTextColor(100, 110, 130); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('VALOR TOTAL A FATURAR', M + 6, 62);
  doc.setTextColor(...PRIMARY); doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text(BRL(med.total), M + 6, 71);

  const periodoLabel = (med.periodoInicio || med.periodoFim)
    ? formatPeriodo(med.periodoInicio, med.periodoFim, formatComp(med.competencia))
    : formatComp(med.competencia) || '—';
  doc.setTextColor(80, 80, 80); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${periodoLabel}`, W - M - 3, 71, { align: 'right' });

  // ---------- Cliente ----------
  let y = 84;
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('DADOS DO CLIENTE', M, y);
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.6);
  doc.line(M, y + 1, M + 46, y + 1);
  y += 6;

  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  const linhas: string[] = [];
  linhas.push(`Nome / Razão Social:  ${cu.name || med.clienteNome || '—'}`);
  const docCli = cu.document || med.clienteDocumento;
  if (docCli) linhas.push(`${String(docCli).replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'}:  ${maskDoc(docCli)}`);
  const endCli = [cu.address, cu.numero, cu.bairro].filter(Boolean).join(', ');
  if (endCli) linhas.push(`Endereço:  ${endCli}`);
  const muni = [cu.cidade && `${cu.cidade}/${cu.estado || ''}`, cu.cep && `CEP ${cu.cep}`]
    .filter(Boolean).join(' · ');
  if (muni) linhas.push(`Município:  ${muni}`);
  for (const l of linhas) {
    const wrap = doc.splitTextToSize(l, W - 2 * M);
    for (const w of wrap) { doc.text(w, M, y); y += 5; }
  }

  // ---------- Itens ----------
  y += 4;
  const body = med.items.map((it, idx) => {
    const periodo = (it.periodoInicio || it.periodoFim)
      ? formatPeriodo(it.periodoInicio, it.periodoFim)
      : '—';
    const contratoStr = it.contractNumero ? `Contrato ${it.contractNumero}\n` : '';
    return [
      String(idx + 1),
      `${contratoStr}${it.descricao}`,
      periodo,
      `${Number(it.quantidade || 0).toLocaleString('pt-BR')} ${it.unidade || 'UN'}`,
      BRL(Number(it.valorUnit || 0)),
      Number(it.descontoItem || 0) > 0 ? `- ${BRL(Number(it.descontoItem))}` : '—',
      BRL(Number(it.valorTotal || 0)),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Descrição', 'Período', 'Qtd', 'V. Unit.', 'Desc.', 'Total']],
    body,
    styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: [220, 224, 230], valign: 'middle' },
    headStyles: { fillColor: PRIMARY, textColor: 255, halign: 'center', fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      2: { halign: 'center', cellWidth: 34, fontSize: 8 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right',  cellWidth: 24 },
      5: { halign: 'right',  cellWidth: 20 },
      6: { halign: 'right',  cellWidth: 26, fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
  });
  let afterY = (doc as any).lastAutoTable.finalY + 4;

  // ---------- Totais ----------
  if (afterY > H - 60) { doc.addPage(); afterY = 20; }
  const totRows: any[] = [['Subtotal', BRL(Number(med.subtotal || 0))]];
  if (Number(med.desconto || 0) > 0) totRows.push(['Desconto', `- ${BRL(Number(med.desconto))}`]);
  totRows.push(['TOTAL', BRL(Number(med.total || 0))]);

  autoTable(doc, {
    startY: afterY,
    body: totRows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'right', cellWidth: W - 2 * M - 40, fontStyle: 'bold', textColor: [80, 80, 80] },
      1: { halign: 'right', cellWidth: 40, fontStyle: 'bold', textColor: PRIMARY },
    },
    margin: { left: M, right: M },
  });
  afterY = (doc as any).lastAutoTable.finalY + 6;

  // ---------- Observações ----------
  if (med.observacoes) {
    if (afterY > H - 40) { doc.addPage(); afterY = 20; }
    doc.setTextColor(...PRIMARY); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('OBSERVAÇÕES', M, afterY);
    doc.setDrawColor(...ACCENT); doc.setLineWidth(0.6);
    doc.line(M, afterY + 1, M + 34, afterY + 1);
    afterY += 6;
    doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    const wrap = doc.splitTextToSize(med.observacoes, W - 2 * M);
    doc.text(wrap, M, afterY);
    afterY += wrap.length * 5 + 6;
  }

  // ---------- Nota ----------
  if (afterY > H - 40) { doc.addPage(); afterY = 20; }
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(M, afterY, W - 2 * M, 14, 1.5, 1.5, 'F');
  doc.setTextColor(...PRIMARY); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('MEDIÇÃO DE SERVIÇOS', M + 3, afterY + 5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
  doc.text(
    'Documento de conferência do período. Após aprovação e pagamento, o(s) recibo(s) correspondente(s) serão emitidos.',
    M + 3, afterY + 10, { maxWidth: W - 2 * M - 6 },
  );

  // Rodapé
  doc.setFontSize(7); doc.setTextColor(140, 140, 140);
  doc.text(
    `Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}`,
    W / 2, H - 6, { align: 'center' },
  );

  doc.save(`Medicao-${med.numero}.pdf`);
}
