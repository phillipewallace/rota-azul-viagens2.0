/**
 * Recibo de Locação — PDF premium, alinhado ao modelo "MICBAN".
 * Cabeçalho com gradiente da empresa, dados completos e área de assinatura elegante.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { maskCnpj, maskCpf } from '@/utils/brazilianDocs';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { loadPdfImage, fitContain } from '@/utils/pdfImage';
import { erpService } from '@/services/erp';
import type { Receipt } from '@/services/contracts';
import { formatDateBR, formatPeriodo } from '@/utils/dateFormat';

const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const D   = (s?: string) => s ? formatDateBR(s) : '—';
const maskDoc = (d?: string) => {
  if (!d) return '';
  const x = d.replace(/\D/g, '');
  if (x.length === 11) return maskCpf(x);
  if (x.length === 14) return maskCnpj(x);
  return d;
};

const PRIMARY: [number, number, number] = [16, 42, 96];     // azul corporativo
const ACCENT:  [number, number, number] = [212, 175, 55];   // dourado

export async function generateReceiptPdf(
  rec: Receipt,
  opts?: { returnBlob?: boolean }
): Promise<{ blob: Blob; filename: string } | void> {

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const snap = rec.snapshot || {};
  const co = snap.company || {};
  const cu = snap.customer || {};
  const ct = snap.contract || {};
  // Número exibido: quando o recibo é "sem validade jurídica" o backend
  // grava um número interno (SV-0001) para unicidade, mas mostramos apenas o
  // display (0001) — o PDF nunca revela essa distinção.
  const numeroImpresso = (rec.numeroDisplay && String(rec.numeroDisplay)) || rec.numero;


  // ---------- Cabeçalho com faixa azul + acento dourado ----------
  const HEADER_H = 42;
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, HEADER_H, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, HEADER_H, W, 1.5, 'F');

  // Caixa Nº/data à direita — definida antes para calcular espaço do texto
  const boxW = 58, boxH = 30, boxX = W - M - boxW, boxY = 6;

  // logo — caixa branca com aspect ratio preservado
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

  // ---- empresa (com largura limitada para não invadir a caixa da direita) ----
  const textMaxW = boxX - textX - 4;
  doc.setTextColor(255, 255, 255);

  // Nome — auto-ajuste de fonte para caber em 1 linha quando possível
  const rawName = String(co.razaoSocial || '—').toUpperCase();
  doc.setFont('helvetica', 'bold');
  let nameSize = 13;
  doc.setFontSize(nameSize);
  while (nameSize > 8 && doc.getTextWidth(rawName) > textMaxW) {
    nameSize -= 0.5;
    doc.setFontSize(nameSize);
  }
  let lineY = 13;
  if (doc.getTextWidth(rawName) <= textMaxW) {
    doc.text(rawName, textX, lineY); lineY += 6;
  } else {
    const wrapped = doc.splitTextToSize(rawName, textMaxW).slice(0, 2);
    for (const w of wrapped) { doc.text(w, textX, lineY); lineY += 5; }
    lineY += 1;
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const lin = [
    co.cnpj ? `CNPJ ${maskCnpj(co.cnpj)}` : null,
    co.inscricaoEstadual ? `IE ${co.inscricaoEstadual}` : null,
  ].filter(Boolean).join('  ·  ');
  if (lin) { doc.text(lin, textX, lineY, { maxWidth: textMaxW }); lineY += 5; }
  const end = [co.endereco, co.cidade && `${co.cidade}/${co.estado || ''}`, co.cep && `CEP ${co.cep}`]
    .filter(Boolean).join(' · ');
  if (end) {
    const wEnd = doc.splitTextToSize(end, textMaxW).slice(0, 2);
    for (const w of wEnd) { doc.text(w, textX, lineY); lineY += 4.5; }
  }
  const cont = [co.telefone, co.email].filter(Boolean).join('  ·  ');
  if (cont) { doc.text(cont, textX, lineY, { maxWidth: textMaxW }); lineY += 4.5; }
  if (co.financeiroContato) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('Financeiro: ', textX, lineY);
    const labelW = doc.getTextWidth('Financeiro: ');
    doc.setFont('helvetica', 'normal');
    doc.text(String(co.financeiroContato), textX + labelW, lineY, { maxWidth: textMaxW - labelW });
  }

  // Caixa Nº/data à direita
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'F');
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('RECIBO Nº', boxX + 3, boxY + 6);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(numeroImpresso, boxX + boxW - 3, boxY + 14, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('Emissão', boxX + 3, boxY + 20);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(D(rec.dataEmissao), boxX + boxW - 3, boxY + 20, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('Vencimento', boxX + 3, boxY + 27);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(D(rec.dataVencimento), boxX + boxW - 3, boxY + 27, { align: 'right' });

  // ---------- Título ----------
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('RECIBO DE LOCAÇÃO DE BENS MÓVEIS', W / 2, 50, { align: 'center' });

  // ---------- Valor em destaque ----------
  const valor = Number(rec.valor || 0);
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(M, 56, W - 2 * M, 18, 2, 2, 'F');
  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.4);
  doc.line(M, 56, M, 74); // barra lateral
  doc.setFillColor(...PRIMARY);
  doc.rect(M, 56, 1.5, 18, 'F');
  doc.setTextColor(100, 110, 130); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(rec.semValidade ? 'VALOR' : 'VALOR RECEBIDO', M + 6, 62);
  doc.setTextColor(...PRIMARY); doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text(BRL(valor), M + 6, 71);
  // ---------- Cliente ----------
  let y = 84;
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('DADOS DO LOCATÁRIO', M, y);
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.6);
  doc.line(M, y + 1, M + 50, y + 1);
  y += 6;

  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  const linhas: string[] = [];
  linhas.push(`Nome / Razão Social:  ${cu.name || '—'}`);
  if (cu.document) linhas.push(
    `${cu.document.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'}:  ${maskDoc(cu.document)}`
  );
  const endCli = [cu.address, cu.numero, cu.bairro].filter(Boolean).join(', ');
  if (endCli) linhas.push(`Endereço:  ${endCli}`);
  const muni = [cu.cidade && `${cu.cidade}/${cu.estado || ''}`, cu.cep && `CEP ${cu.cep}`]
    .filter(Boolean).join(' · ');
  if (muni) linhas.push(`Município:  ${muni}`);
  for (const l of linhas) {
    const wrap = doc.splitTextToSize(l, W - 2 * M);
    for (const w of wrap) { doc.text(w, M, y); y += 5; }
  }

  // ---------- Endereço da obra/evento + CNO / OC (quando informados) ----------
  // O snapshot pode conter overrides feitos no momento da edição.
  const snapContract = snap.contract || {};
  const enderecoObra = ct.enderecoObra || ct.localEvento || snapContract.enderecoObra;
  const cno = ct.cno || snapContract.cno;
  
  if (enderecoObra || cno) {
    y += 2;
    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('LOCAL DE PRESTAÇÃO / REFERÊNCIAS', M, y);
    doc.setDrawColor(...ACCENT); doc.setLineWidth(0.6);
    doc.line(M, y + 1, M + 66, y + 1);
    y += 6;

    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    if (enderecoObra) {
      const label = (ct.tipoContrato === 'evento' ? 'Endereço do evento' : 'Endereço da obra') + ':  ';
      const wrap = doc.splitTextToSize(label + enderecoObra, W - 2 * M);
      for (const w of wrap) { doc.text(w, M, y); y += 5; }
    }
    if (cno) {
      doc.text(`CNO / Ordem de Compra:  ${cno}`, M, y); y += 5;
    }
  }

  // ---------- Tabela de itens ----------
  y += 4;
  const freteIncluso = Number(snap.freteIncluso || 0);
  const valorLocacao = Number(snap.valorLocacao ?? (valor - freteIncluso));
  const descLocacao = ct.descricao || `Locação mensal — Contrato ${ct.numero || ''}`.trim();

  const body: any[] = [
    ['1', 'MÊS', descLocacao, BRL(valorLocacao), BRL(valorLocacao)],
  ];
  if (freteIncluso > 0) {
    body.push([
      '1', 'UN',
      'Frete de entrega/recolhimento (cobrança única no 1º recibo — não se repete nas próximas competências)',
      BRL(freteIncluso), BRL(freteIncluso),
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Qtd', 'Unid', 'Descrição', 'Valor Unitário', 'Total']],
    body,
    styles: { fontSize: 9, cellPadding: 3, lineColor: [220, 224, 230] },
    headStyles: { fillColor: PRIMARY, textColor: 255, halign: 'center', fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right',  cellWidth: 30 },
      4: { halign: 'right',  cellWidth: 30, fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
  });
  let afterY = (doc as any).lastAutoTable.finalY + 4;

  // Competência: quando o recibo tem período exato, exibimos "DD/MM/YYYY - DD/MM/YYYY".
  const competenciaLabel = (rec.periodoInicio || rec.periodoFim)
    ? formatPeriodo(rec.periodoInicio, rec.periodoFim, formatComp(rec.competencia))
    : formatComp(rec.competencia);

  autoTable(doc, {
    startY: afterY,
    head: [['Competência', 'Vencimento', 'Total da Cobrança']],
    body: [[competenciaLabel, D(rec.dataVencimento), BRL(valor)]],
    styles: { fontSize: 9.5, cellPadding: 3 },
    headStyles: { fillColor: [240, 242, 247], textColor: PRIMARY, fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold', textColor: PRIMARY } },
    margin: { left: M, right: M },
  });
  afterY = (doc as any).lastAutoTable.finalY + 8;





  // ---------- Assinatura ----------
  if (afterY > H - 60) { doc.addPage(); afterY = 30; }
  doc.text(`${co.cidade || 'Belo Horizonte'}, ${D(rec.dataEmissao)}.`, M, afterY);
  afterY += 22;

  // Resolve URL da assinatura digital da empresa (com fallback por CNPJ)
  let sigUrl: string | undefined = (co as any).assinaturaUrl || (co as any).assinatura_url;
  if (!sigUrl && co.cnpj) {
    try {
      const all = await erpService.listCompanies();
      const cnpjDigits = String(co.cnpj).replace(/\D/g, '');
      const found = all.find((c: any) => String(c.cnpj || '').replace(/\D/g, '') === cnpjDigits);
      if (found?.assinaturaUrl) sigUrl = found.assinaturaUrl;
    } catch { /* sem assinatura */ }
  }

  // Imagem de assinatura acima da linha
  if (sigUrl) {
    try {
      const sigImg = await loadPdfImage(sigUrl);
      const sigH = 18;
      const sigW = 80;
      const sigX = W / 2 - sigW / 2;
      const fit = fitContain(sigImg, sigX, afterY - sigH, sigW, sigH, 1);
      doc.addImage(sigImg.dataUrl, sigImg.format, fit.x, fit.y, fit.w, fit.h);
    } catch { /* segue sem assinatura */ }
  }

  doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.3);
  doc.line(M + 25, afterY, W - M - 25, afterY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...PRIMARY);
  doc.text(String(co.razaoSocial || '—').toUpperCase(), W / 2, afterY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
  if (co.cnpj) doc.text(`CNPJ ${maskCnpj(co.cnpj)}`, W / 2, afterY + 10, { align: 'center' });
  doc.text('LOCADORA', W / 2, afterY + 15, { align: 'center' });

  // rodapé
  doc.setFontSize(7); doc.setTextColor(140, 140, 140);
  doc.text(
    `Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}`,
    W / 2, H - 6, { align: 'center' }
  );

  const filename = `Recibo-${numeroImpresso}.pdf`;
  if (opts?.returnBlob) {
    return { blob: doc.output('blob'), filename };
  }
  doc.save(filename);
}


function formatComp(c: string) {
  const [a, m] = (c || '').split('-');
  const meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return m ? `${meses[Number(m)] || m}/${a}` : c;
}

/** Aceita data URL ou URL pública/relativa; devolve dataURL. */
export async function toDataUrl(src: string): Promise<string> {
  if (!src) throw new Error('empty');
  if (src.startsWith('data:')) return src;
  const url = toAbsoluteUrl(src);
  const r = await fetch(url, { credentials: 'omit', mode: 'cors' });
  if (!r.ok) throw new Error('logo fetch failed');
  const blob = await r.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// ============================================================
// Recibo UNIFICADO — múltiplos contratos, mesma empresa/cliente
// ============================================================
export interface UnifiedReceiptItem {
  contractNumero: string;
  descricao: string;
  enderecoObra?: string | null;
  cno?: string | null;
  valor: number;
  numeroRecibo?: string | null;   // nº do recibo individual gerado por contrato
  periodoInicio?: string | null;  // YYYY-MM-DD — período do recibo daquele contrato
  periodoFim?: string | null;     // YYYY-MM-DD
}
export interface UnifiedReceiptInput {
  numero: string;
  competencia: string;         // YYYY-MM (fallback do rótulo)
  periodoInicio?: string | null; // YYYY-MM-DD — período exato
  periodoFim?: string | null;    // YYYY-MM-DD
  dataEmissao: string;         // YYYY-MM-DD
  dataVencimento?: string | null;
  company: any;
  customer: any;
  items: UnifiedReceiptItem[];
  total: number;
  semValidade?: boolean;
}

export async function generateUnifiedReceiptPdf(input: UnifiedReceiptInput) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const co = input.company || {};
  const cu = input.customer || {};

  // ---------- Cabeçalho ----------
  const HEADER_H = 42;
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, HEADER_H, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, HEADER_H, W, 1.5, 'F');

  const boxW = 58, boxH = 30, boxX = W - M - boxW, boxY = 6;

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
  let nameSize = 13;
  doc.setFontSize(nameSize);
  while (nameSize > 8 && doc.getTextWidth(rawName) > textMaxW) {
    nameSize -= 0.5;
    doc.setFontSize(nameSize);
  }
  let lineY = 13;
  if (doc.getTextWidth(rawName) <= textMaxW) {
    doc.text(rawName, textX, lineY); lineY += 6;
  } else {
    const wrapped = doc.splitTextToSize(rawName, textMaxW).slice(0, 2);
    for (const w of wrapped) { doc.text(w, textX, lineY); lineY += 5; }
    lineY += 1;
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const lin = [
    co.cnpj ? `CNPJ ${maskCnpj(co.cnpj)}` : null,
    co.inscricaoEstadual ? `IE ${co.inscricaoEstadual}` : null,
  ].filter(Boolean).join('  ·  ');
  if (lin) { doc.text(lin, textX, lineY, { maxWidth: textMaxW }); lineY += 5; }
  const end = [co.endereco, co.cidade && `${co.cidade}/${co.estado || ''}`, co.cep && `CEP ${co.cep}`]
    .filter(Boolean).join(' · ');
  if (end) {
    const wEnd = doc.splitTextToSize(end, textMaxW).slice(0, 2);
    for (const w of wEnd) { doc.text(w, textX, lineY); lineY += 4.5; }
  }
  const cont = [co.telefone, co.email].filter(Boolean).join('  ·  ');
  if (cont) { doc.text(cont, textX, lineY, { maxWidth: textMaxW }); lineY += 4.5; }
  if (co.financeiroContato) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('Financeiro: ', textX, lineY);
    const labelW = doc.getTextWidth('Financeiro: ');
    doc.setFont('helvetica', 'normal');
    doc.text(String(co.financeiroContato), textX + labelW, lineY, { maxWidth: textMaxW - labelW });
  }

  // Caixa Nº/data
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'F');
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('RECIBO Nº', boxX + 3, boxY + 6);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(input.numero, boxX + boxW - 3, boxY + 14, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('Emissão', boxX + 3, boxY + 20);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(D(input.dataEmissao), boxX + boxW - 3, boxY + 20, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('Vencimento', boxX + 3, boxY + 27);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(D(input.dataVencimento || undefined), boxX + boxW - 3, boxY + 27, { align: 'right' });

  // ---------- Título ----------
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('RECIBO UNIFICADO DE LOCAÇÃO DE BENS MÓVEIS', W / 2, 50, { align: 'center' });

  // ---------- Valor em destaque ----------
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(M, 56, W - 2 * M, 18, 2, 2, 'F');
  doc.setFillColor(...PRIMARY);
  doc.rect(M, 56, 1.5, 18, 'F');
  doc.setTextColor(100, 110, 130); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(input.semValidade ? 'VALOR TOTAL' : 'VALOR TOTAL RECEBIDO', M + 6, 62);
  doc.setTextColor(...PRIMARY); doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text(BRL(input.total), M + 6, 71);
  // ---------- Cliente (sem seção "LOCAL DE PRESTAÇÃO") ----------
  let y = 84;
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('DADOS DO LOCATÁRIO', M, y);
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.6);
  doc.line(M, y + 1, M + 50, y + 1);
  y += 6;

  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  const linhas: string[] = [];
  linhas.push(`Nome / Razão Social:  ${cu.name || '—'}`);
  if (cu.document) linhas.push(
    `${cu.document.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'}:  ${maskDoc(cu.document)}`
  );
  const endCli = [cu.address, cu.numero, cu.bairro].filter(Boolean).join(', ');
  if (endCli) linhas.push(`Endereço:  ${endCli}`);
  const muni = [cu.cidade && `${cu.cidade}/${cu.estado || ''}`, cu.cep && `CEP ${cu.cep}`]
    .filter(Boolean).join(' · ');
  if (muni) linhas.push(`Município:  ${muni}`);
  
  const contCli = [cu.telefone, cu.email].filter(Boolean).join('  ·  ');
  if (contCli) linhas.push(`Contato:  ${contCli}`);
  for (const l of linhas) {
    const wrap = doc.splitTextToSize(l, W - 2 * M);
    for (const w of wrap) { doc.text(w, M, y); y += 5; }
  }

  // ---------- Local de prestação / referências (endereços de obra + CNO) ----------
  // Mesma seção do recibo individual, para que o unificado (inclusive os
  // recibos sem validade jurídica) exiba endereço da obra/evento e CNO.
  const refs = input.items
    .map(it => ({
      contrato: it.contractNumero || '',
      endereco: (it.enderecoObra || '').trim(),
      cno: (it.cno || '').trim(),
    }))
    .filter(r => r.endereco || r.cno);

  if (refs.length) {
    y += 2;
    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('LOCAL DE PRESTAÇÃO / REFERÊNCIAS', M, y);
    doc.setDrawColor(...ACCENT); doc.setLineWidth(0.6);
    doc.line(M, y + 1, M + 66, y + 1);
    y += 6;

    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    const enderecosUnicos = Array.from(new Set(refs.map(r => r.endereco).filter(Boolean)));
    const cnosUnicos = Array.from(new Set(refs.map(r => r.cno).filter(Boolean)));

    if (enderecosUnicos.length === 1 && refs.every(r => !r.endereco || r.endereco === enderecosUnicos[0])) {
      const wrap = doc.splitTextToSize(`Endereço da obra/evento:  ${enderecosUnicos[0]}`, W - 2 * M);
      for (const w of wrap) { doc.text(w, M, y); y += 5; }
    } else {
      for (const r of refs) {
        if (!r.endereco) continue;
        const wrap = doc.splitTextToSize(`Contrato ${r.contrato}:  ${r.endereco}`, W - 2 * M);
        for (const w of wrap) { doc.text(w, M, y); y += 5; }
      }
    }

    if (cnosUnicos.length) {
      const wrap = doc.splitTextToSize(`CNO / Ordem de Compra:  ${cnosUnicos.join(', ')}`, W - 2 * M);
      for (const w of wrap) { doc.text(w, M, y); y += 5; }
    }
  }

  // ---------- Itens ----------
  y += 4;
  const body = input.items.map((it, idx) => {
    const periodo = (it.periodoInicio || it.periodoFim)
      ? formatPeriodo(it.periodoInicio, it.periodoFim)
      : '—';
    return [
      String(idx + 1),
      { content: `Contrato ${it.contractNumero} · ${it.descricao}`, styles: { halign: 'left' as const } },
      periodo,
      BRL(it.valor),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Descrição', 'Período (competência)', 'Total']],
    body,
    styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: [220, 224, 230] },
    headStyles: { fillColor: PRIMARY, textColor: 255, halign: 'center', fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      2: { halign: 'center', cellWidth: 40, fontStyle: 'bold' },
      3: { halign: 'right',  cellWidth: 30, fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
  });
  let afterY = (doc as any).lastAutoTable.finalY + 2;

  afterY += 4;

  // Linha "Competência / Vencimento / Total"
  // Em recibo unificado, o período pertence a cada contrato e já aparece na
  // tabela de itens. O rodapé deve mostrar apenas a competência para não
  // sugerir um período global aplicado a todos.
  const compLabel = formatComp(input.competencia);
  autoTable(doc, {
    startY: afterY,
    head: [['Competência', 'Vencimento', 'Total da Cobrança']],
    body: [[compLabel, D(input.dataVencimento || undefined), BRL(input.total)]],
    styles: { fontSize: 9.5, cellPadding: 3 },
    headStyles: { fillColor: [240, 242, 247], textColor: PRIMARY, fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold', textColor: PRIMARY } },
    margin: { left: M, right: M },
  });
  afterY = (doc as any).lastAutoTable.finalY + 8;




  // Assinatura
  if (afterY > H - 60) { doc.addPage(); afterY = 30; }
  doc.text(`${co.cidade || 'Belo Horizonte'}, ${D(input.dataEmissao)}.`, M, afterY);
  afterY += 22;

  let sigUrl: string | undefined = (co as any).assinaturaUrl || (co as any).assinatura_url;
  if (sigUrl) {
    try {
      const sigImg = await loadPdfImage(sigUrl);
      const sigH = 18, sigW = 80;
      const sigX = W / 2 - sigW / 2;
      const fit = fitContain(sigImg, sigX, afterY - sigH, sigW, sigH, 1);
      doc.addImage(sigImg.dataUrl, sigImg.format, fit.x, fit.y, fit.w, fit.h);
    } catch { /* segue */ }
  }
  doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.3);
  doc.line(M + 25, afterY, W - M - 25, afterY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...PRIMARY);
  doc.text(String(co.razaoSocial || '—').toUpperCase(), W / 2, afterY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
  if (co.cnpj) doc.text(`CNPJ ${maskCnpj(co.cnpj)}`, W / 2, afterY + 10, { align: 'center' });
  doc.text('LOCADORA', W / 2, afterY + 15, { align: 'center' });

  doc.setFontSize(7); doc.setTextColor(140, 140, 140);
  doc.text(
    `Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}`,
    W / 2, H - 6, { align: 'center' }
  );

  doc.save(`Recibo-${input.numero}.pdf`);
}
