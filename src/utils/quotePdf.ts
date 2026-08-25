import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quote } from '@/services/quotes';
import { maskCnpj, maskCpf } from '@/utils/brazilianDocs';
import { loadPdfImage, fitContain } from '@/utils/pdfImage';
import { OBSERVACAO_FIXA_LOCACAO, describeFormaPagamento } from '@/utils/fixedObservations';
import { formatDateBR } from '@/utils/dateFormat';

const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const D = (s?: string) => s ? formatDateBR(s) : '';

function maskDoc(doc?: string) {
  if (!doc) return '';
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return maskCpf(d);
  if (d.length === 14) return maskCnpj(d);
  return doc;
}

async function buildQuotePdfDoc(quote: Quote): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  const company = quote.companySnapshot || {};
  const customer = quote.customerSnapshot || {};

  // Faixa superior
  const HEADER_H = 34;
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, W, HEADER_H, 'F');

  const logo = company.logo_dataurl || company.logo_url || company.logoUrl;
  let titleX = M;
  if (logo) {
    try {
      const img = await loadPdfImage(logo);
      // Caixa branca para o logo, mantendo aspect ratio
      const cardX = M, cardY = 4, cardW = 26, cardH = 26;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'F');
      const fit = fitContain(img, cardX, cardY, cardW, cardH, 2);
      doc.addImage(img.dataUrl, img.format, fit.x, fit.y, fit.w, fit.h, undefined, 'FAST');
      titleX = cardX + cardW + 6;
    } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', titleX, 14);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${quote.numero}`, titleX, 22);
  doc.setFontSize(9);
  doc.text(`Emissão: ${D(quote.dataEmissao)}`, W - M, 13, { align: 'right' });
  doc.text(`Validade: ${quote.validadeDias} dias`, W - M, 19, { align: 'right' });
  doc.text(`Modalidade: ${quote.modalidade === 'diaria' ? 'Locação Diária' : 'Locação Mensal'}`, W - M, 25, { align: 'right' });

  // Empresa emissora
  doc.setTextColor(0, 0, 0);
  let y = 44;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('EMPRESA EMISSORA', M, y);
  y += 5;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(company.razao_social || quote.companyRazaoSocial || '—', M, y);
  y += 5;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  const cnpjLine = [
    company.cnpj ? `CNPJ: ${maskCnpj(company.cnpj)}` : (quote.companyCnpj ? `CNPJ: ${maskCnpj(quote.companyCnpj)}` : null),
    company.inscricao_estadual ? `IE: ${company.inscricao_estadual}` : null,
  ].filter(Boolean).join('   ');
  if (cnpjLine) { doc.text(cnpjLine, M, y); y += 5; }
  const endLine = [company.endereco, company.cidade, company.estado].filter(Boolean).join(', ');
  if (endLine) { doc.text(endLine, M, y); y += 5; }
  const contLine = [company.telefone, company.email].filter(Boolean).join('  |  ');
  if (contLine) { doc.text(contLine, M, y); y += 5; }

  // Cliente
  y += 4;
  doc.setFillColor(243, 244, 246);
  doc.rect(M, y - 4, W - 2 * M, 7, 'F');
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', M + 2, y + 1);
  y += 9;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(customer.customer_name || quote.customerName || '—', M, y);
  y += 5;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  const cDocLine = customer.document
    ? `${customer.person_type === 'PF' ? 'CPF' : 'CNPJ'}: ${maskDoc(customer.document)}`
    : (quote.customerDocument ? `Documento: ${maskDoc(quote.customerDocument)}` : null);
  if (cDocLine) { doc.text(cDocLine, M, y); y += 5; }
  const cEnd = [
    customer.address,
    customer.numero,
    customer.complemento,
    customer.bairro,
    customer.cidade,
    customer.estado,
    customer.cep ? `CEP ${customer.cep}` : null,
  ].filter(Boolean).join(', ');
  if (cEnd) { doc.text(cEnd, M, y, { maxWidth: W - 2 * M }); y += 5; }
  const cCont = [
    customer.contact_name ? `Resp.: ${customer.contact_name}` : null,
    customer.contact_phone ? `Tel.: ${customer.contact_phone}` : null,
    customer.email ? `E-mail: ${customer.email}` : null,
  ].filter(Boolean).join('  |  ');
  if (cCont) { doc.text(cCont, M, y); y += 5; }

  // Responsável específico deste orçamento (contato do pedido).
  const respLine = [
    (quote as any).responsavelNome ? `Responsável: ${(quote as any).responsavelNome}` : null,
    (quote as any).responsavelTelefone ? `Tel.: ${(quote as any).responsavelTelefone}` : null,
    (quote as any).responsavelEmail ? `E-mail: ${(quote as any).responsavelEmail}` : null,
  ].filter(Boolean).join('  |  ');
  if (respLine) {
    doc.setFont('helvetica', 'bold'); doc.text('Contato deste orçamento:', M, y); y += 4.5;
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(respLine, W - 2 * M);
    doc.text(wrapped, M, y); y += wrapped.length * 4.5 + 1;
  }

  // Dados da locação / entrega
  y += 4;
  doc.setFillColor(243, 244, 246);
  doc.rect(M, y - 4, W - 2 * M, 7, 'F');
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('DADOS DA LOCAÇÃO', M + 2, y + 1);
  y += 9;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');

  const locInfo: string[] = [];
  if (quote.tipoLocacao) {
    const tipos: Record<string, string> = { obra: 'Obra', evento: 'Evento', industria: 'Indústria', outro: 'Outro' };
    locInfo.push(`Tipo: ${tipos[quote.tipoLocacao] || quote.tipoLocacao}`);
  }
  if (quote.dataEntrega) locInfo.push(`Data de entrega: ${D(quote.dataEntrega)}`);
  if (quote.dataRecolhimento) locInfo.push(`Data de recolhimento: ${D(quote.dataRecolhimento)}`);
  if (quote.modalidade === 'mensal' && quote.limpezasSemanais != null && quote.tipoLocacao !== 'evento') {
    locInfo.push(`Limpezas semanais: ${quote.limpezasSemanais}`);
  }
  if (locInfo.length) {
    const linha = locInfo.join('  |  ');
    const wrapped = doc.splitTextToSize(linha, W - 2 * M);
    doc.text(wrapped, M, y); y += wrapped.length * 4.5 + 1;
  }
  if (quote.enderecoEntrega) {
    doc.setFont('helvetica', 'bold'); doc.text('Endereço de entrega:', M, y); y += 4.5;
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(quote.enderecoEntrega, W - 2 * M);
    doc.text(wrapped, M, y); y += wrapped.length * 4.5 + 1;
  }

  // Tabela de itens
  y += 4;
  const rows = (quote.items || []).map((it, i) => [
    String(i + 1),
    [it.produto, it.descricao].filter(Boolean).join(' — '),
    Number(it.quantidade).toLocaleString('pt-BR'),
    BRL(Number(it.valorUnitario)),
    BRL(Number(it.quantidade) * Number(it.valorUnitario)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Produto / Descrição', 'Qtd', 'Valor Unit.', 'Valor Total']],
    body: rows.length ? rows : [['', '(sem itens)', '', '', '']],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'right', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 32 },
    },
    margin: { left: M, right: M },
  });

  // [#14 médio] guarda contra autoTable indisponível por erro interno.
  let afterY = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
  // Garante espaço para o bloco de totais (45mm) — evita corte ao pé da página
  if (afterY + 45 > doc.internal.pageSize.getHeight() - 25) { doc.addPage(); afterY = 20; }




  // Resumo financeiro
  const desconto = Number(quote.subtotal) * (Number(quote.descontoPct) || 0) / 100;
  const boxX = W - M - 70;
  const boxW = 70;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  const line = (label: string, value: string, bold = false) => {
    if (bold) doc.setFont('helvetica', 'bold');
    doc.text(label, boxX + 2, afterY + 4);
    doc.text(value, boxX + boxW - 2, afterY + 4, { align: 'right' });
    if (bold) doc.setFont('helvetica', 'normal');
    afterY += 5.5;
  };
  doc.setDrawColor(220);
  doc.rect(boxX, afterY, boxW, 28);
  line('Subtotal', BRL(quote.subtotal));
  line(`Desconto${Number(quote.descontoPct) ? ` (${quote.descontoPct}%)` : ''}`, `- ${BRL(desconto)}`);
  line('Frete', BRL(quote.frete));
  doc.setFillColor(30, 58, 138); doc.rect(boxX, afterY, boxW, 8, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('TOTAL', boxX + 2, afterY + 5.5);
  doc.text(BRL(quote.total), boxX + boxW - 2, afterY + 5.5, { align: 'right' });
  doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  afterY += 14;

  const pageH = doc.internal.pageSize.getHeight();
  const ensureSpace = (needed: number) => {
    if (afterY + needed > pageH - 25) { doc.addPage(); afterY = 20; }
  };

  // Forma de pagamento (padronizada)
  const formaTexto = describeFormaPagamento(quote.formaPagamento, quote.dataEntrega) || quote.condicoesPagamento;
  if (formaTexto) {
    const fLines = doc.splitTextToSize(formaTexto, W - 2 * M);
    ensureSpace(5 + fLines.length * 4.5 + 2);
    doc.setFont('helvetica', 'bold'); doc.text('Forma de pagamento:', M, afterY); afterY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(fLines, M, afterY); afterY += fLines.length * 4.5 + 2;
  }
  // Observações: usuário + bloco fixo obrigatório (sempre presente)
  const obsCombinada = [quote.observacoes?.trim(), OBSERVACAO_FIXA_LOCACAO].filter(Boolean).join('\n\n');
  if (obsCombinada) {
    const lines = doc.splitTextToSize(obsCombinada, W - 2 * M);
    const lineH = 4.2;
    // Garante que o cabeçalho + pelo menos as 3 primeiras linhas fiquem juntos
    ensureSpace(5 + lineH * Math.min(lines.length, 3));
    doc.setFont('helvetica', 'bold'); doc.text('Observações:', M, afterY); afterY += 5;
    doc.setFont('helvetica', 'normal');
    for (const ln of lines) {
      if (afterY > pageH - 20) { doc.addPage(); afterY = 20; }
      doc.text(ln, M, afterY); afterY += lineH;
    }
    afterY += 2;
  }

  // Rodapé com assinaturas
  const footerY = Math.max(afterY + 20, doc.internal.pageSize.getHeight() - 30);
  doc.setDrawColor(180);
  doc.line(M, footerY, M + 70, footerY);
  doc.line(W - M - 70, footerY, W - M, footerY);
  doc.setFontSize(8); doc.setTextColor(80);
  doc.text('Assinatura do cliente', M + 2, footerY + 4);
  doc.text('Assinatura da empresa', W - M - 68, footerY + 4);
  doc.setFontSize(7); doc.setTextColor(120);
  doc.text(
    `Documento gerado em ${new Date().toLocaleString('pt-BR')} · ${company.razao_social || ''}`,
    W / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' }
  );

  return doc;
}

export async function generateQuotePdf(quote: Quote): Promise<void> {
  const doc = await buildQuotePdfDoc(quote);
  doc.save(`Orcamento-${quote.numero}.pdf`);
}

export async function generateQuotePdfBlob(quote: Quote): Promise<Blob> {
  const doc = await buildQuotePdfDoc(quote);
  return doc.output('blob');
}
