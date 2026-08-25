/**
 * PDF de Ordem de Serviço para entrega operacional.
 * Mostra dados do cliente, endereço, datas, itens e quantidades.
 * NÃO mostra valores — é o documento que vai com o motorista/funcionário.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OBSERVACAO_FIXA_LOCACAO, describeFormaPagamento } from '@/utils/fixedObservations';
import { formatDateBR } from '@/utils/dateFormat';
import { loadPdfImage, fitContain } from '@/utils/pdfImage';


const D = (s?: string | null) => s ? formatDateBR(s) : '—';

export interface ServiceOrderPdfInput {
  numero: string;
  modalidade?: string;
  tipoLocacao?: string | null;
  dataInicio?: string;
  dataEntrega?: string | null;
  dataRecolhimento?: string | null;
  dataFimPrevista?: string | null;
  limpezasSemanais?: number | null;
  enderecoEntrega?: string | null;
  observacoes?: string | null;
  qtdReservada?: number;
  customerName?: string;
  customerAddress?: string;
  customerSnapshot?: any;
  companySnapshot?: any;
  companyRazaoSocial?: string;
  formaPagamento?: 'cartao' | 'pix' | 'boleto' | string | null;
  items?: Array<{ produto?: string; descricao?: string; quantidade?: number }>;
  sanitariosNumeros?: string[];
  // Contato específico deste pedido (vem do orçamento vinculado).
  responsavelNome?: string | null;
  responsavelTelefone?: string | null;
  responsavelEmail?: string | null;
}

export async function generateServiceOrderPdf(os: ServiceOrderPdfInput) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const company = os.companySnapshot || {};
  const customer = os.customerSnapshot || {};

  doc.setFillColor(21, 128, 61);
  doc.rect(0, 0, W, 30, 'F');

  const logo = company.logo_dataurl || company.logo_url || company.logoUrl;
  let titleX = M;
  if (logo) {
    try {
      // [#13 médio] detecta formato real da imagem (PNG vs JPEG) e preserva aspect ratio.
      const img = await loadPdfImage(logo);
      const cardX = M, cardY = 4, cardW = 22, cardH = 22;
      const fit = fitContain(img, cardX, cardY, cardW, cardH, 1);
      doc.addImage(img.dataUrl, img.format, fit.x, fit.y, fit.w, fit.h, undefined, 'FAST');
      titleX = M + cardW + 4;
    } catch { /* segue sem logo */ }
  }


  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO', titleX, 13);
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${os.numero}`, titleX, 21);
  doc.setFontSize(9);
  doc.text('VIA OPERACIONAL - ENTREGA', W - M, 13, { align: 'right' });
  doc.text(`Emitida em ${new Date().toLocaleDateString('pt-BR')}`, W - M, 19, { align: 'right' });
  if (os.modalidade) {
    doc.text(`Modalidade: ${os.modalidade === 'diaria' ? 'Diária' : 'Mensal'}`, W - M, 25, { align: 'right' });
  }

  doc.setTextColor(0, 0, 0);
  let y = 40;

  // Empresa
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('EMPRESA:', M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(company.razao_social || os.companyRazaoSocial || '—', M + 22, y);
  y += 6;

  // Cliente — destaque
  doc.setFillColor(220, 252, 231);
  doc.rect(M, y - 4, W - 2 * M, 8, 'F');
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', M + 2, y + 1.5);
  y += 10;
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text(customer.customer_name || os.customerName || '—', M, y);
  y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  const cCont = [
    customer.contact_name ? `Responsável: ${customer.contact_name}` : null,
    customer.contact_phone ? `Contato: ${customer.contact_phone}` : null,
  ].filter(Boolean).join('   |   ');
  if (cCont) { doc.text(cCont, M, y); y += 5; }

  // Contato deste pedido (responsável específico do orçamento vinculado).
  const respLine = [
    os.responsavelNome ? `Responsável: ${os.responsavelNome}` : null,
    os.responsavelTelefone ? `Tel.: ${os.responsavelTelefone}` : null,
    os.responsavelEmail ? `E-mail: ${os.responsavelEmail}` : null,
  ].filter(Boolean).join('   |   ');
  if (respLine) {
    doc.setFont('helvetica', 'bold');
    doc.text('Contato deste pedido:', M, y); y += 4.5;
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(respLine, W - 2 * M);
    doc.text(wrapped, M, y); y += wrapped.length * 4.5 + 1;
  }

  // Endereço de entrega — bloco grande (sem emoji: jsPDF padrão não renderiza)
  y += 2;
  doc.setFillColor(254, 240, 138);
  doc.rect(M, y - 4, W - 2 * M, 8, 'F');
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('ENDERECO DE ENTREGA', M + 2, y + 1.5);
  y += 10;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('Endereço:', M, y);
  y += 5;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  const enderecoFinal = os.enderecoEntrega
    || os.customerAddress
    || [customer.address, customer.numero, customer.complemento, customer.bairro, customer.cidade, customer.estado, customer.cep ? `CEP ${customer.cep}` : null].filter(Boolean).join(', ')
    || '— ENDERECO NAO INFORMADO —';
  const endLines = doc.splitTextToSize(enderecoFinal, W - 2 * M);
  doc.text(endLines, M, y);
  y += endLines.length * 5.5 + 2;


  // Datas operacionais
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  const datas: string[][] = [];
  if (os.dataEntrega) datas.push(['Data de entrega:', D(os.dataEntrega)]);
  if (os.dataRecolhimento) datas.push(['Data de recolhimento:', D(os.dataRecolhimento)]);
  else if (os.dataFimPrevista) datas.push(['Recolhimento previsto:', D(os.dataFimPrevista)]);
  if (os.tipoLocacao) {
    const tipos: Record<string, string> = { obra: 'Obra', evento: 'Evento', industria: 'Indústria', outro: 'Outro' };
    datas.push(['Tipo de locação:', tipos[os.tipoLocacao] || os.tipoLocacao]);
  }
  if (os.modalidade === 'mensal' && os.limpezasSemanais != null && os.tipoLocacao !== 'evento') {
    datas.push(['Limpezas semanais:', String(os.limpezasSemanais)]);
  }
  if (datas.length) {
    autoTable(doc, {
      startY: y,
      body: datas,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // Itens (sem valores)
  const itemRows = (os.items || []).map((it, i) => [
    String(i + 1),
    [it.produto, it.descricao].filter(Boolean).join(' — ') || '—',
    String(Number(it.quantidade || 0)),
  ]);
  if (!itemRows.length && os.qtdReservada) {
    itemRows.push(['1', 'Sanitário químico', String(os.qtdReservada)]);
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Produto / Descrição', 'Quantidade']],
    body: itemRows.length ? itemRows : [['', '(sem itens)', '']],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [21, 128, 61], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 35, fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Números de sanitários (se já vinculados)
  if (os.sanitariosNumeros && os.sanitariosNumeros.length) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Sanitários vinculados:', M, y); y += 5;
    doc.setFont('helvetica', 'normal');
    const txt = os.sanitariosNumeros.join(' · ');
    const wrapped = doc.splitTextToSize(txt, W - 2 * M);
    doc.text(wrapped, M, y); y += wrapped.length * 4.5 + 2;
  }

  const pageH = doc.internal.pageSize.getHeight();
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 30) { doc.addPage(); y = 20; }
  };

  // Forma de pagamento (sempre exibida, mesmo na via operacional, p/ alinhamento)
  const formaTxt = describeFormaPagamento(os.formaPagamento, os.dataEntrega);
  if (formaTxt) {
    const wrapped = doc.splitTextToSize(formaTxt, W - 2 * M);
    ensureSpace(5 + wrapped.length * 4.5 + 2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Forma de pagamento:', M, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(wrapped, M, y); y += wrapped.length * 4.5 + 2;
  }

  // Observações livres + bloco fixo obrigatório (sempre presente)
  const obsCombinada = [os.observacoes?.trim(), OBSERVACAO_FIXA_LOCACAO].filter(Boolean).join('\n\n');
  if (obsCombinada) {
    const wrapped = doc.splitTextToSize(obsCombinada, W - 2 * M);
    const lineH = 4.3;
    ensureSpace(5 + lineH * Math.min(wrapped.length, 3));
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Observações:', M, y); y += 5;
    doc.setFont('helvetica', 'normal');
    for (const ln of wrapped) {
      if (y > pageH - 30) { doc.addPage(); y = 20; }
      doc.text(ln, M, y); y += lineH;
    }
    y += 2;
  }

  // Campos para conferência
  y = Math.max(y + 8, H - 60);
  doc.setDrawColor(180);
  doc.line(M, y, M + 80, y);
  doc.line(W - M - 80, y, W - M, y);
  doc.setFontSize(8); doc.setTextColor(80);
  doc.text('Recebido por (nome / assinatura)', M, y + 4);
  doc.text('Entregador (nome / assinatura)', W - M - 80, y + 4);

  y += 18;
  doc.line(M, y, M + 60, y);
  doc.text('Data / Hora da entrega', M, y + 4);

  doc.setFontSize(7); doc.setTextColor(120);
  doc.text(
    `Documento operacional · sem valores financeiros · ${company.razao_social || os.companyRazaoSocial || ''}`,
    W / 2, H - 6, { align: 'center' }
  );

  doc.save(`OS-${os.numero}.pdf`);
}
