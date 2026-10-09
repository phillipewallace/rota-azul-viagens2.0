/**
 * Gerador de PDF das Rotas do ERP.
 *
 * Formato: TABELA em retrato (A4), texto com quebra de linha (sem truncar com "…"),
 * células mais altas, fonte maior e mais espaço entre linhas. SEM assinatura do
 * motorista. Colunas enxutas: Empresa, Endereço, Limp., Banh., Sanit.,
 * Peças, Contato, Observação.
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

    const doc = new jsPDF({ orientation: 'portrait', format: 'a4', units: 'mm' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    const contentWidth = pageWidth - margin * 2;

    // ===== CABEÇALHO (barra azul) =====
    doc.setFillColor(0, 51, 102); // #003366
    doc.rect(0, 0, pageWidth, 22, 'F');

    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, 11);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const statusLabel =
      rota.status === 'ativa' ? 'Ativa' : rota.status === 'inativa' ? 'Inativa' : 'Concluída';
    const info = `Status: ${statusLabel}   |   ${rota.pontos.length} ponto(s)   |   Emitido: ${new Date().toLocaleDateString('pt-BR')}`;
    doc.text(info, margin, 18);

    // ===== Definição das colunas (larguras em mm; a última absorve o resto) =====
    const fontSize = 9;
    const columns: { header: string; key: keyof Rota['pontos'][number] | 'n'; width: number }[] = [
      { header: '#', key: 'n', width: 7 },
      { header: 'Empresa', key: 'company', width: 34 },
      { header: 'Endereço', key: 'address', width: 40 },
      { header: 'Limp.', key: 'cleaning', width: 15 },
      { header: 'Banh.', key: 'bathrooms', width: 12 },
      { header: 'Sanit.', key: 'toilets', width: 12 },
      { header: 'Peças', key: 'pieces', width: 12 },
      { header: 'Contato', key: 'contact', width: 20 },
      { header: 'Observação', key: 'observation', width: 0 },
    ];
    const used = columns.reduce((sum, c) => sum + c.width, 0);
    columns[columns.length - 1].width = Math.max(contentWidth - used, 24);

    // Texto com quebra de linha natural (sem truncar com "…").
    const head = [columns.map((c) => c.header)];
    const body = rota.pontos.map((p, i) =>
      columns.map((c) => {
        if (c.key === 'n') return String(i + 1);
        const value = String((p as any)[c.key] ?? '').trim();
        return value || '—';
      })
    );

    autoTable(doc, {
      startY: 26,
      head,
      body: body.length ? body : [columns.map((_, i) => (i === 0 ? '—' : ''))],
      theme: 'grid',
      margin: { left: margin, right: margin, top: 26, bottom: 10 },
      styles: {
        fontSize,
        cellPadding: { top: 3.5, right: 2.5, bottom: 3.5, left: 2.5 },
        minCellHeight: 12,
        lineWidth: 0.1,
        valign: 'middle',
        lineColor: [185, 195, 205],
        textColor: [40, 45, 55],
      },
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        minCellHeight: 9,
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
