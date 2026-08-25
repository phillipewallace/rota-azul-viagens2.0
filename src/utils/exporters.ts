import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanyLogoDataUrl } from '@/utils/companyLogo';

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: any) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",;\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [headers.map(escape).join(';'),
    ...rows.map(r => r.map(escape).join(';'))].join('\n');
  // BOM para Excel reconhecer UTF-8
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPdf(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  orientation?: 'portrait' | 'landscape';
}) {
  const doc = new jsPDF({ orientation: opts.orientation || 'portrait' });

  // Logo da empresa (canto superior direito) — silencioso se indisponível
  const logo = await getCompanyLogoDataUrl();
  if (logo) {
    try {
      const W = doc.internal.pageSize.getWidth();
      doc.addImage(logo, 'PNG', W - 10 - 18, 6, 18, 18, undefined, 'FAST');
    } catch { /* ignora falha de render */ }
  }

  doc.setFontSize(14);
  doc.text(opts.title, 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `${opts.subtitle ? opts.subtitle + ' · ' : ''}Gerado em ${new Date().toLocaleString('pt-BR')}`,
    14, 21
  );
  autoTable(doc, {
    startY: 28,
    head: [opts.headers],
    body: opts.rows.map(r => r.map(c => (c == null ? '' : String(c)))),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    margin: { left: 10, right: 10 },
  });
  doc.save(opts.filename.endsWith('.pdf') ? opts.filename : `${opts.filename}.pdf`);
}
