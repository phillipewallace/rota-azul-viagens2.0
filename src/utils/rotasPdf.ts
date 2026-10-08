import { jsPDF } from 'jspdf';
import { Rota } from '@/types/rota';

export interface RotaPdfOptions {
  /**
   * Modo português do Brasil (dados formatados com formato pt-BR)
   * @default true
   */
  ptBR?: boolean;
  /** Incluir identificação do motorista */
  showDriverSignature?: boolean;
  /** Em branco para preencher */
  blankMode?: boolean;
}

export class RotaPdfGenerator {
  private doc: jsPDF;
  private options: RotaPdfOptions;

  constructor(options: RotaPdfOptions = {}) {
    this.options = { ptBR: true, showDriverSignature: true, ...options };
    // Orientação retrato, tamanho A4
    this.doc = new jsPDF({
      orientation: 'portrait',
      format: 'a4',
      units: 'mm',
    });
  }

  generateRotaPdf(rota: Rota | null, title: string = 'Rota de Entrega') {
    if (!rota) {
      throw new Error('Nenhuma rota encontrada para gerar PDF');
    }

    this.doc = new jsPDF({
      orientation: 'portrait',
      format: 'a4',
      units: 'mm',
    });

    // ===== CABEÇALHO =====
    const margin = 12;
    const headerHeight = 28;

    // Cor de fundo azul da empresa (estilo Azul)
    this.doc.setFillColor(0, 51, 102); // #003366
    this.doc.rect(0, 0, 210, headerHeight, 'F');

    // Título
    this.doc.setFillColor(255, 255, 255);
    this.doc.rect(margin, 4, 186, 18, 'F');

    this.doc.setFontSize(22);
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, margin + 6, 16);

    // ===== CORPO DOS DADOS =====
    let y = headerHeight + 8;

    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont('helvetica', 'normal');

    // Labels e valores
    const drawLabel = (label: string, value: string, labelW: number = 38) => {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(0, 51, 102);
      this.doc.text(label, margin, y + 3);

      this.doc.setFontSize(13);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(30, 30, 30);
      const x = margin + labelW;
      const text = value || '—';
      const lineWidth = 160;
      this.doc.text(text, x, y + 3, { maxWidth: lineWidth });
    };

    drawLabel('Rota:', rota.name, 38);
    y += 10;

    drawLabel('Empresa:', rota.company, 38);
    y += 10;

    drawLabel('Endereço:', rota.address, 38);
    y += 10;

    drawLabel('Limpezas:', rota.cleaning, 38);
    y += 10;

    drawLabel('Banheiros:', rota.bathrooms, 38);
    y += 10;

    drawLabel('Contato:', rota.contact, 38);
    y += 10;

    drawLabel('Observação:', rota.observation, 38);
    y += 10;

    drawLabel('Número do Sanitário:', rota.sanitarioNumber, 50);
    y += 10;

    drawLabel('Modelo:', rota.model, 38);
    y += 10;

    drawLabel('Cor:', rota.color, 38);
    y += 10;

    // ===== ESPAÇO PARA MOTORISTA =====
    const signatureTop = y + 5;
    const signatureAreaHeight = 40;

    // Linha divisória
    this.doc.setDrawColor(0, 51, 102);
    this.doc.setLineWidth(0.5);
    this.doc.rect(margin, signatureTop, 186, signatureAreaHeight, 'S');

    // Título da área
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 51, 102);
    const signatureLabel = this.options.blankMode
      ? 'ASSINATURA DO MOTORISTA (em branco)'
      : 'ASSINATURA DO MOTORISTA';
    this.doc.text(signatureLabel, margin + 5, signatureTop + 6);

    // Subtítulos
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(80, 80, 80);
    this.doc.text('Nome:', margin + 5, signatureTop + 18);
    this.doc.text('Assinatura:', margin + 38, signatureTop + 18);

    // Linha de texto para motorista escrever
    this.doc.setDrawColor(150, 150, 150);
    this.doc.setLineWidth(0.3);
    this.doc.rect(margin + 20, signatureTop + 22, 120, 12, 'S');

    this.doc.text('Data:', margin + 5, signatureTop + 36);
    this.doc.rect(margin + 20, signatureTop + 33, 60, 8, 'S');

    // ===== RODAPÉ =====
    const footerY = this.doc.internal.pageSize.height - 15;
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(120, 120, 120);
    this.doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, footerY);

    const fileName = `rota-${rota.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')}-${new Date().toISOString().split('T')[0]}.pdf`;
    this.doc.save(fileName);
  }
}

export const rotaPdfGenerator = new RotaPdfGenerator();