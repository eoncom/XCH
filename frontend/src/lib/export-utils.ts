/**
 * XCH - Export Utilities
 *
 * Fonctions pour exporter les données en PDF et Excel
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Types
interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

interface ExportOptions {
  filename: string;
  title?: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
}

interface SiteExportData {
  name: string;
  code: string;
  status: string;
  address: string;
  healthStatus: string;
  assetsCount?: number;
  tasksCount?: number;
}

interface AssetExportData {
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  siteName?: string;
}

// ==================== PDF EXPORT ====================

/**
 * Export data to PDF with table format
 */
export function exportToPDF(options: ExportOptions): void {
  const { filename, title, subtitle, columns, data } = options;

  // Create PDF document
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Add title
  if (title) {
    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246); // Primary blue
    doc.text(title, 14, 20);
  }

  // Add subtitle
  if (subtitle) {
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, 28);
  }

  // Add date
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 14, title ? 35 : 15);

  // Prepare table data
  const tableHeaders = columns.map((col) => col.header);
  const tableData = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      return value !== null && value !== undefined ? String(value) : '-';
    })
  );

  // Add table
  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: title ? 40 : 20,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246], // Primary blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: columns.reduce((acc, col, index) => {
      if (col.width) {
        acc[index] = { cellWidth: col.width };
      }
      return acc;
    }, {} as Record<number, { cellWidth: number }>),
  });

  // Add footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `XCH - Gestion IT Sites | Page ${i}/${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Save
  doc.save(`${filename}.pdf`);
}

// ==================== EXCEL EXPORT ====================

/**
 * Export data to Excel (xlsx)
 */
export function exportToExcel(options: ExportOptions): void {
  const { filename, title, columns, data } = options;

  // Prepare worksheet data
  const wsData: any[][] = [];

  // Add title row
  if (title) {
    wsData.push([title]);
    wsData.push([]); // Empty row
  }

  // Add header row
  wsData.push(columns.map((col) => col.header));

  // Add data rows
  data.forEach((row) => {
    wsData.push(
      columns.map((col) => {
        const value = row[col.key];
        return value !== null && value !== undefined ? value : '';
      })
    );
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = columns.map((col) => ({
    wch: col.width || 15,
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Données');

  // Generate Excel file
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  // Save
  saveAs(blob, `${filename}.xlsx`);
}

// ==================== CSV EXPORT ====================

/**
 * Export data to CSV
 */
export function exportToCSV(options: ExportOptions): void {
  const { filename, columns, data } = options;

  // Create CSV content
  const headers = columns.map((col) => `"${col.header}"`).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key];
        if (value === null || value === undefined) return '""';
        // Escape quotes and wrap in quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  const csv = [headers, ...rows].join('\n');

  // Create blob and save
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}.csv`);
}

// ==================== SPECIFIC EXPORTS ====================

/**
 * Export sites list
 */
export function exportSites(sites: SiteExportData[], format: 'pdf' | 'excel' | 'csv' = 'excel'): void {
  const options: ExportOptions = {
    filename: `xch-sites-${new Date().toISOString().split('T')[0]}`,
    title: 'Liste des Sites',
    subtitle: `${sites.length} site(s)`,
    columns: [
      { header: 'Nom', key: 'name', width: 30 },
      { header: 'Code', key: 'code', width: 15 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Adresse', key: 'address', width: 40 },
      { header: 'Santé', key: 'healthStatus', width: 12 },
      { header: 'Équipements', key: 'assetsCount', width: 12 },
      { header: 'Tâches', key: 'tasksCount', width: 10 },
    ],
    data: sites,
  };

  switch (format) {
    case 'pdf':
      exportToPDF(options);
      break;
    case 'csv':
      exportToCSV(options);
      break;
    case 'excel':
    default:
      exportToExcel(options);
      break;
  }
}

/**
 * Export assets list
 */
export function exportAssets(assets: AssetExportData[], format: 'pdf' | 'excel' | 'csv' = 'excel'): void {
  const options: ExportOptions = {
    filename: `xch-assets-${new Date().toISOString().split('T')[0]}`,
    title: 'Liste des Équipements',
    subtitle: `${assets.length} équipement(s)`,
    columns: [
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Marque', key: 'brand', width: 15 },
      { header: 'Modèle', key: 'model', width: 25 },
      { header: 'N° Série', key: 'serialNumber', width: 20 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Site', key: 'siteName', width: 25 },
    ],
    data: assets,
  };

  switch (format) {
    case 'pdf':
      exportToPDF(options);
      break;
    case 'csv':
      exportToCSV(options);
      break;
    case 'excel':
    default:
      exportToExcel(options);
      break;
  }
}

/**
 * Export site report (detailed PDF)
 */
export function exportSiteReport(
  site: SiteExportData,
  assets: AssetExportData[],
  tasks: { title: string; status: string; priority: string; assignee?: string }[]
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header
  doc.setFontSize(24);
  doc.setTextColor(59, 130, 246);
  doc.text('XCH', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Gestion IT Sites', 14, 26);

  // Title
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(`Rapport - ${site.name}`, 14, 45);

  // Site info
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  let y = 55;

  doc.text(`Code: ${site.code}`, 14, y);
  y += 7;
  doc.text(`Statut: ${site.status}`, 14, y);
  y += 7;
  doc.text(`Santé: ${site.healthStatus}`, 14, y);
  y += 7;
  if (site.address) {
    doc.text(`Adresse: ${site.address}`, 14, y);
    y += 7;
  }

  y += 10;

  // Assets table
  if (assets.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(`Équipements (${assets.length})`, 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Type', 'Marque', 'Modèle', 'N° Série', 'Statut']],
      body: assets.map((a) => [a.type, a.brand || '-', a.model || '-', a.serialNumber || '-', a.status]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
    });

    y = (doc as any).lastAutoTable.finalY + 15;
  }

  // Tasks table
  if (tasks.length > 0 && y < 250) {
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(`Tâches (${tasks.length})`, 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Titre', 'Statut', 'Priorité', 'Assigné']],
      body: tasks.map((t) => [t.title, t.status, t.priority, t.assignee || '-']),
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
      styles: { fontSize: 9 },
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
    doc.internal.pageSize.width / 2,
    doc.internal.pageSize.height - 10,
    { align: 'center' }
  );

  // Save
  doc.save(`rapport-${site.code}-${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Export rack diagram to PDF
 */
export function exportRackDiagram(
  rackName: string,
  totalUnits: number,
  assets: { name: string; position: number; height: number; brand?: string }[]
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text(`Baie: ${rackName}`, 14, 20);

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`${totalUnits}U - ${assets.length} équipement(s)`, 14, 28);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 14, 35);

  // Equipment table
  autoTable(doc, {
    startY: 45,
    head: [['Position', 'Hauteur', 'Équipement', 'Marque']],
    body: assets
      .sort((a, b) => b.position - a.position)
      .map((a) => [`U${a.position}`, `${a.height}U`, a.name, a.brand || '-']),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 10 },
  });

  // Calculate occupancy
  const usedUnits = assets.reduce((sum, a) => sum + a.height, 0);
  const occupancy = Math.round((usedUnits / totalUnits) * 100);

  const y = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`Occupation: ${usedUnits}U / ${totalUnits}U (${occupancy}%)`, 14, y);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('XCH - Gestion IT Sites', doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, {
    align: 'center',
  });

  doc.save(`baie-${rackName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
}
