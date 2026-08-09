import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { hslToHex } from '@/lib/branding';

/** "0 82% 52%" -> [r, g, b] */
function hslToRgb(hsl: string): [number, number, number] {
  const hex = hslToHex(hsl).replace('#', '');
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/**
 * Generador de reportes PDF con la identidad de marca configurada por el admin
 * (logotipo + color primario) y la información ordenada en secciones/tablas.
 */

export interface PdfSection {
  /** Título de la sección */
  title: string;
  /** Encabezados de la tabla */
  columns: string[];
  /** Filas (mismo orden que `columns`) */
  rows: (string | number)[][];
  /** Mensaje cuando no hay filas */
  emptyText?: string;
}

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  /** Pares clave/valor mostrados en la cabecera (periodo, servicio, etc.) */
  meta?: { label: string; value: string }[];
  sections: PdfSection[];
  logoUrl?: string;
  /** Color primario en formato HSL "0 82% 52%" */
  primaryHsl?: string;
  fileName: string;
  footerNote?: string;
}

/** Descarga una imagen y la convierte a dataURL para incrustarla en el PDF. */
async function toDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = data;
    });
    return { data, ...dims };
  } catch {
    return null;
  }
}

export async function generateReportPdf(opts: PdfReportOptions): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 32;
  const [pr, pg, pb] = hslToRgb(opts.primaryHsl || '0 82% 52%');

  // ---- Cabecera de marca ----
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, pageW, 74, 'F');

  const logo = opts.logoUrl ? await toDataUrl(opts.logoUrl) : null;
  let textX = margin;
  if (logo) {
    const maxH = 40;
    const w = Math.min(120, (logo.w / logo.h) * maxH);
    try {
      doc.addImage(logo.data, 'PNG', margin, 17, w, maxH, undefined, 'FAST');
      textX = margin + w + 14;
    } catch {
      /* logo no compatible: se omite */
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(opts.title, textX, 34);
  if (opts.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(opts.subtitle, textX, 50);
  }
  doc.setFontSize(9);
  doc.text(
    `Generado: ${new Date().toLocaleString('es-MX')}`,
    pageW - margin,
    50,
    { align: 'right' },
  );

  let cursorY = 96;

  // ---- Datos del reporte ----
  if (opts.meta?.length) {
    autoTable(doc, {
      startY: cursorY,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 150 } },
      body: opts.meta.map((m) => [m.label, m.value]),
      margin: { left: margin, right: margin },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 18;
  }

  // ---- Secciones ----
  for (const section of opts.sections) {
    if (cursorY > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      cursorY = margin + 20;
    }
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(section.title, margin, cursorY);
    cursorY += 8;

    if (section.rows.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(section.emptyText || 'Sin registros en el periodo.', margin, cursorY + 12);
      cursorY += 36;
      continue;
    }

    autoTable(doc, {
      startY: cursorY,
      head: [section.columns],
      body: section.rows.map((r) => r.map((c) => (c == null ? '' : String(c)))),
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [pr, pg, pb], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 247] },
      margin: { left: margin, right: margin },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 24;
  }

  // ---- Pie de página con numeración ----
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    const h = doc.internal.pageSize.getHeight();
    if (opts.footerNote) doc.text(opts.footerNote, margin, h - 16);
    doc.text(`Página ${i} de ${total}`, pageW - margin, h - 16, { align: 'right' });
  }

  doc.save(opts.fileName);
}
