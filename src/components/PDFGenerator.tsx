
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportStats {
  totalRoutes: number;
  activeRoutes: number;
  totalTrucks: number;
  availableTrucks: number;
  completedTrips: number;
  totalKm: number;
  pendingMaintenance: number;
}

export class PDFGenerator {
  private doc: jsPDF;

  constructor() {
    this.doc = new jsPDF();
  }

  generateSystemReport(stats: ReportStats | null, month?: string) {
    try {
      if (!stats) {
        throw new Error('Dados de estatísticas não disponíveis');
      }

      this.doc = new jsPDF();
      
      // Header
      this.doc.setFontSize(20);
      this.doc.text('Relatório do Sistema', 20, 20);
      
      if (month) {
        this.doc.setFontSize(12);
        this.doc.text(`Período: ${month}`, 20, 30);
      }
      
      // Estatísticas gerais
      this.doc.setFontSize(16);
      this.doc.text('Estatísticas Gerais', 20, 50);
      
      const statsData = [
        ['Total de Rotas', stats.totalRoutes?.toString() || '0'],
        ['Rotas Ativas', stats.activeRoutes?.toString() || '0'],
        ['Total de Caminhões', stats.totalTrucks?.toString() || '0'],
        ['Caminhões Disponíveis', stats.availableTrucks?.toString() || '0'],
        ['Viagens Concluídas', stats.completedTrips?.toString() || '0'],
        ['Quilometragem Total', `${stats.totalKm?.toLocaleString() || '0'} km`],
        ['Manutenções Pendentes', stats.pendingMaintenance?.toString() || '0']
      ];

      autoTable(this.doc, {
        startY: 60,
        head: [['Métrica', 'Valor']],
        body: statsData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });

      // Footer
      this.doc.setFontSize(10);
      this.doc.text(
        `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
        20,
        this.doc.internal.pageSize.height - 20
      );
      
      // Salvar arquivo
      const fileName = `relatorio-sistema-${month || 'geral'}-${new Date().toISOString().split('T')[0]}.pdf`;
      this.doc.save(fileName);
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      throw error;
    }
  }

  generateManagementReport(data: any[], month: string) {
    try {
      this.doc = new jsPDF();
      
      // Header
      this.doc.setFontSize(20);
      this.doc.text('Relatório de Gestão', 20, 20);
      
      this.doc.setFontSize(12);
      this.doc.text(`Período: ${month}`, 20, 30);
      
      // Dados da tabela
      if (data && data.length > 0) {
        const tableData = data.map(item => [
          item.id || '',
          item.name || '',
          item.status || '',
          item.date || '',
          item.value || ''
        ]);

        autoTable(this.doc, {
          startY: 50,
          head: [['ID', 'Nome', 'Status', 'Data', 'Valor']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] }
        });
      } else {
        this.doc.setFontSize(14);
        this.doc.text('Nenhum dado disponível para o período selecionado', 20, 60);
      }

      // Footer  
      this.doc.setFontSize(10);
      this.doc.text(
        `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
        20,
        this.doc.internal.pageSize.height - 20
      );
      
      // Salvar arquivo
      const fileName = `relatorio-gestao-${month}-${new Date().toISOString().split('T')[0]}.pdf`;
      this.doc.save(fileName);
      
    } catch (error) {
      console.error('Erro ao gerar relatório de gestão:', error);
      throw error;
    }
  }
}

export const pdfGenerator = new PDFGenerator();
