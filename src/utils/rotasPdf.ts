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

  /**
   * Gera o PDF de uma rota completa: cabeçalho com o nome da rota,
   * uma seção por ponto (empresa, endereço, limpezas, etc.) e
   * área de assinatura do motorista no final.
   */
  generateRotaPdf(rota: Rota | null, title: string = 'Rota de Entrega') {
    if (!rota) {
      throw new Error('Nenhuma rota encontrada para gerar PDF');
    }

    this.doc = new jsPDF({
      orientation: 'portrait',
      format: 'a4',
      units: 'mm',
    });

    const pageHeight = this.doc.internal.pageSize.height;
    const margin = 12;
    const contentWidth = 186;

    // ===== CABEÇALHO =====
    const headerHeight = 28;

    // Cor de fundo azul da empresa (estilo Azul)
    this.doc.setFillColor(0, 51, 102); // #003366
    this.doc.rect(0, 0, 210, headerHeight, 'F');

    // Título
    this.doc.setFillColor(255, 255, 255);
    this.doc.rect(margin, 4, contentWidth, 18, 'F');

    this.doc.setFontSize(20);
    this.doc.setTextColor(0, 51, 102);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, margin + 6, 16);

    // ===== CORPO: DADOS DA ROTA =====
    let y = headerHeight + 8;

    const drawLabel = (label: string, value: string, labelW: number = 38) => {
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(0, 51, 102);
      this.doc.text(label, margin, y + 3);

      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(30, 30, 30);
      this.doc.text(value || '—', margin + labelW, y + 3, { maxWidth: contentWidth - labelW });
      y += 7;
    };

    drawLabel('Rota:', rota.name);
    drawLabel('Status:', rota.status === 'ativa' ? 'Ativa' : rota.status === 'inativa' ? 'Inativa' : 'Concluída');
    drawLabel('Pontos:', String(rota.pontos.length));
    y += 3;

    // ===== SEÇÕES DOS PONTOS =====
    if (rota.pontos.length === 0) {
      this.doc.setFont('helvetica', 'italic');
      this.doc.setFontSize(11);
      this.doc.setTextColor(120, 120, 120);
      this.doc.text('Nenhum ponto cadastrado nesta rota.', margin, y + 3);
      y += 10;
    }

    rota.pontos.forEach((ponto, index) => {
      // Reserva de espaço do bloco do ponto + folga
      const blockHeight = 78;
      if (y + blockHeight > pageHeight - 55) {
        this.doc.addPage();
        y = 15;
      }

      // Barra de título do ponto
      this.doc.setFillColor(0, 51, 102);
      this.doc.rect(margin, y, contentWidth, 8, 'F');
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(11);
      this.doc.text(`Ponto ${index + 1} de ${rota.pontos.length}`, margin + 3, y + 5.5);
      y += 12;

      drawLabel('Empresa:', ponto.company);
      drawLabel('Endereço:', ponto.address);
      drawLabel('Limpezas:', ponto.cleaning);
      drawLabel('Banheiros:', ponto.bathrooms);
      drawLabel('Contato:', ponto.contact);
      drawLabel('Nº Sanitário:', ponto.sanitarioNumber, 44);
      drawLabel('Modelo:', ponto.model);
      drawLabel('Cor:', ponto.color);

      // Observação (fundo destacado + quebra de linha controlada)
      if (ponto.observation) {
        const obsLines = this.doc.splitTextToSize(ponto.observation, contentWidth - 8);
        const obsHeight = Math.min(obsLines.length * 5 + 8, 30);
        if (y + obsHeight > pageHeight - 55) {
          this.doc.addPage();
          y = 15;
        }
        this.doc.setFillColor(255, 247, 237); // âmbar-50
        this.doc.setDrawColor(245, 158, 11);  // âmbar-500
        this.doc.rect(margin, y, contentWidth, obsHeight, 'FD');
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(10);
        this.doc.setTextColor(146, 64, 14);
        this.doc.text('Observação:', margin + 3, y + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(120, 53, 15);
        this.doc.text(obsLines.slice(0, 4), margin + 3, y + 10);
        y += obsHeight + 5;
      }

      y += 4;
    });

    // ===== ESPAÇO PARA MOTORISTA =====
    if (y + 50 > pageHeight - 25) {
      this.doc.addPage();
      y = 15;
    }

    const signatureTop = y + 5;
    const signatureAreaHeight = 40;

    // Linha divisória
    this.doc.setDrawColor(0, 51, 102);
    this.doc.setLineWidth(0.5);
    this.doc.rect(margin, signatureTop, contentWidth, signatureAreaHeight, 'S');

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
    const footerY = pageHeight - 15;
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(120, 120, 120);
    this.doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, footerY);

    const fileName = `rota-${rota.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')}-${new Date().toISOString().split('T')[0]}.pdf`;
    this.doc.save(fileName);
  }
}

export const rotaPdfGenerator = new RotaPdfGenerator();

