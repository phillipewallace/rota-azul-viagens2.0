/**
 * Gerador de PDF das Rotas do ERP.
 *
 * Formato: TABELA densa em paisagem (A4), 1 linha por ponto, SEM assinatura
 * do motorista. Objetivo: mesma legibilidade da planilha do Excel (~2 folhas),
 * em vez do formato antigo de blocos altos que gastava ~10 folhas.
 *
 * Uso: rotaPdfGenerator.generateRotaPdf(rota, rota.name)
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Rota } from '@/types/rota';

export interface RotaPdfOptions {
  /** Formatar datas/números no padrão pt-BR. @default true */
  ptBR?: boolean;
}

export class RotaPdfGenerator {
  private options: RotaPdfOptions;

  constructor(options: RotaPdfOptions = {}) {
    this.options = { ptBR: true, ...options };
  }

  generateRotaPdf(rota: Rota | null, title: string = 'Rota de Entrega') {
    if (!rota) {
      throw new Error('Nenhuma rota encontrada para gerar PDF');
    }

    // Paisagem = mais largura => cabe tudo em 1 linha por ponto => ~2 folhas.
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4', units: 'mm' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    const contentWidth = pageWidth - margin * 2;

    // ===== CABEÇALHO (barra azul) =====
    doc.setFillColor(0, 51, 102); // #003366
    doc.rect(0, 0, pageWidth, 15, 'F');

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, 10);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const statusLabel =
      rota.status === 'ativa' ? 'Ativa' : rota.status === 'inativa' ? 'Inativa' : 'Concluída';
    const info = `Status: ${statusLabel}    |    Pontos: ${rota.pontos.length}    |    Emitido: ${new Date().toLocaleDateString('pt-BR')}`;
    doc.text(info, pageWidth - margin, 10, { align: 'right' });

    // ===== Definição das colunas (larguras em mm; a última absorve o resto) =====
    const fontSize = 8;
    const columns: { header: string; key: keyof Rota['pontos'][number] | 'n'; width: number }[] = [
      { header: '#', key: 'n', width: 8 },
      { header: 'Empresa', key: 'company', width: 44 },
      { header: 'Endereço', key: 'address', width: 64 },
      { header: 'Limp.', key: 'cleaning', width: 20 },
      { header: 'Banh.', key: 'bathrooms', width: 15 },
      { header: 'Contato', key: 'contact', width: 36 },
      { header: 'Sanit.', key: 'sanitarioNumber', width: 20 },
      { header: 'Modelo', key: 'model', width: 22 },
      { header: 'Cor', key: 'color', width: 17 },
      { header: 'Observação', key: 'observation', width: 0 },
    ];
    const used = columns.reduce((sum, c) => sum + c.width, 0);
    columns[columns.length - 1].width = Math.max(contentWidth - used, 24);

    // Trunca o texto medindo a largura REAL (mm) para NUNCA quebrar linha.
    const truncate = (text: string, widthMm: number): string => {
      doc.setFontSize(fontSize);
      const value = (text || '').trim() || '—';
      if (doc.getTextWidth(value) <= widthMm) return value;
      let cut = value;
      while (cut.length > 1 && doc.getTextWidth(cut + '…') > widthMm) {
        cut = cut.slice(0, -1);
      }
      return cut + '…';
    };

    const head = [columns.map((c) => c.header)];
    const body = rota.pontos.map((p, i) =>
      columns.map((c) => (c.key === 'n' ? String(i + 1) : truncate(String((p as any)[c.key] ?? ''), c.width - 3)))
    );

    autoTable(doc, {
      startY: 19,
      head,
      body: body.length ? body : [columns.map((_, i) => (i === 0 ? '—' : ''))],
      theme: 'grid',
      margin: { left: margin, right: margin, top: 19, bottom: 8 },
      styles: {
        fontSize,
        cellPadding: 1.2,
        lineWidth: 0.1,
        overflow: 'hidden', // 1 linha por célula
        valign: 'middle',
        lineColor: [185, 195, 205],
        textColor: [40, 45, 55],
      },
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        minCellHeight: 6,
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: columns.reduce((acc, c, ci) => {
        acc[ci] = { cellWidth: c.width, halign: ci === 1 || ci === 2 ? 'left' : 'center' };
        return acc;
      }, {} as Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }>),
      didDrawPage: (data) => {
        const pages = (doc as any).getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(130);
        doc.setFont('helvetica', 'normal');
        doc.text(`Página ${data.pageNumber} de ${pages}`, pageWidth - margin, pageHeight - 4, {
          align: 'right',
        });
      },
    });

    const safeName = rota.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `rota-${safeName}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }
}

export const rotaPdfGenerator = new RotaPdfGenerator();
