/**
 * XCH - Export Utilities
 *
 * Fonctions pour exporter les données en PDF, Excel, CSV et JSON
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * Sanitize a value for safe Excel/CSV export.
 * Prevents formula injection (CSV injection / DDE attacks).
 * Characters =, +, -, @, tab, CR at the start of a cell trigger formula interpretation.
 */
export function sanitizeForExcel(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

// Types
interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportOptions {
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
  city?: string;
  postalCode?: string;
  healthStatus: string;
  assetsCount?: number;
  tasksCount?: number;
  connectivity?: string;
}

interface AssetExportData {
  type: string;
  name?: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  siteName?: string;
  ip?: string;
  hostname?: string;
  warranty?: string;
  inventoryTag?: string;
  purchaseDate?: string;
  rack?: string;
}

// ==================== PDF EXPORT ====================

/**
 * Export data to PDF with table format
 * Uses landscape for many columns, portrait otherwise
 * Reduced margins for maximum content area
 */
export function exportToPDF(options: ExportOptions): void {
  const { filename, title, subtitle, columns, data } = options;

  // Auto-detect orientation: landscape if >7 columns
  const orientation = columns.length > 7 ? 'landscape' : 'portrait';
  const margin = 10; // Reduced margins for more space

  // Create PDF document
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Add title
  if (title) {
    doc.setFontSize(16);
    doc.setTextColor(59, 130, 246); // Primary blue
    doc.text(title, margin, 15);
  }

  // Add subtitle + date on same line
  const subtitleY = title ? 22 : 10;
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, margin, subtitleY);
  }
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Export ${new Date().toLocaleDateString('fr-FR')}`,
    doc.internal.pageSize.width - margin,
    subtitleY,
    { align: 'right' }
  );

  // Prepare table data
  const tableHeaders = columns.map((col) => col.header);
  const tableData = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      return value !== null && value !== undefined ? String(value) : '-';
    })
  );

  // Adaptive font size based on column count
  const fontSize = columns.length > 8 ? 7 : columns.length > 6 ? 8 : 9;

  // Add table — fills the width
  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: title ? 27 : 15,
    margin: { left: margin, right: margin },
    tableWidth: 'auto',
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: fontSize,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    styles: {
      fontSize: fontSize,
      cellPadding: 2,
      overflow: 'linebreak',
    },
  });

  // Add footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `XCH - Gestion IT Sites | Page ${i}/${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 7,
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

  // Add data rows (sanitized to prevent formula injection)
  data.forEach((row) => {
    wsData.push(
      columns.map((col) => {
        const value = row[col.key];
        return sanitizeForExcel(value);
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
        // Sanitize for formula injection + escape quotes and wrap in quotes
        const sanitized = sanitizeForExcel(value);
        return `"${sanitized.replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  const csv = [headers, ...rows].join('\n');

  // Create blob and save
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}.csv`);
}

// ==================== JSON EXPORT ====================

/**
 * Export data to JSON
 */
export function exportToJSON(options: ExportOptions): void {
  const { filename, title, data } = options;

  const jsonData = {
    title: title || filename,
    exportedAt: new Date().toISOString(),
    count: data.length,
    data,
  };

  const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
  saveAs(blob, `${filename}.json`);
}

// ==================== SPECIFIC EXPORTS ====================

/**
 * Export sites list
 */
export function exportSites(sites: SiteExportData[], format: 'pdf' | 'excel' | 'csv' | 'json' = 'excel'): void {
  const options: ExportOptions = {
    filename: `xch-sites-${new Date().toISOString().split('T')[0]}`,
    title: 'Liste des Sites',
    subtitle: `${sites.length} site(s)`,
    columns: [
      { header: 'Nom', key: 'name', width: 25 },
      { header: 'Code', key: 'code', width: 10 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Ville', key: 'city', width: 15 },
      { header: 'CP', key: 'postalCode', width: 8 },
      { header: 'Adresse', key: 'address', width: 30 },
      { header: 'Santé', key: 'healthStatus', width: 10 },
      { header: 'Équip.', key: 'assetsCount', width: 8 },
      { header: 'Tâches', key: 'tasksCount', width: 8 },
      { header: 'Connectivité', key: 'connectivity', width: 25 },
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
    case 'json':
      exportToJSON(options);
      break;
    case 'excel':
    default:
      exportToExcel(options);
      break;
  }
}

/**
 * Export assets list (enriched with IP, warranty, hostname, etc.)
 */
export function exportAssets(assets: AssetExportData[], format: 'pdf' | 'excel' | 'csv' | 'json' = 'excel'): void {
  const options: ExportOptions = {
    filename: `xch-assets-${new Date().toISOString().split('T')[0]}`,
    title: 'Liste des Équipements',
    subtitle: `${assets.length} équipement(s)`,
    columns: [
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Nom', key: 'name', width: 18 },
      { header: 'Marque', key: 'brand', width: 12 },
      { header: 'Modèle', key: 'model', width: 18 },
      { header: 'N° Série', key: 'serialNumber', width: 18 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Site', key: 'siteName', width: 18 },
      { header: 'IP', key: 'ip', width: 14 },
      { header: 'Hostname', key: 'hostname', width: 16 },
      { header: 'Garantie', key: 'warranty', width: 14 },
      { header: 'Tag inv.', key: 'inventoryTag', width: 12 },
      { header: 'Baie', key: 'rack', width: 10 },
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
    case 'json':
      exportToJSON(options);
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
      head: [['Type', 'Nom', 'Marque', 'Modèle', 'N° Série', 'Statut']],
      body: assets.map((a) => [a.type, a.name || '-', a.brand || '-', a.model || '-', a.serialNumber || '-', a.status]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
      margin: { left: 10, right: 10 },
    });

    y = (doc as any).lastAutoTable.finalY + 15;
  }

  // Tasks table
  if (tasks.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
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
      margin: { left: 10, right: 10 },
    });
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `XCH | Page ${i}/${pageCount} | ${new Date().toLocaleDateString('fr-FR')}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 7,
      { align: 'center' }
    );
  }

  // Save
  doc.save(`rapport-${site.code}-${new Date().toISOString().split('T')[0]}.pdf`);
}

// ==================== TASKS EXPORT ====================

interface TaskExportData {
  title: string;
  status: string;
  priority: string;
  siteName?: string;
  assignedTo?: string;
  dueDate?: string;
  createdAt?: string;
}

/**
 * Export tasks list
 */
export function exportTasks(tasks: TaskExportData[], format: 'pdf' | 'excel' | 'csv' | 'json' = 'excel'): void {
  const options: ExportOptions = {
    filename: `xch-taches-${new Date().toISOString().split('T')[0]}`,
    title: 'Liste des Tâches',
    subtitle: `${tasks.length} tâche(s)`,
    columns: [
      { header: 'Titre', key: 'title', width: 30 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Priorité', key: 'priority', width: 12 },
      { header: 'Site', key: 'siteName', width: 18 },
      { header: 'Assigné à', key: 'assignedTo', width: 18 },
      { header: 'Échéance', key: 'dueDate', width: 12 },
      { header: 'Créée le', key: 'createdAt', width: 12 },
    ],
    data: tasks,
  };

  switch (format) {
    case 'pdf':
      exportToPDF(options);
      break;
    case 'csv':
      exportToCSV(options);
      break;
    case 'json':
      exportToJSON(options);
      break;
    case 'excel':
    default:
      exportToExcel(options);
      break;
  }
}

// ==================== CONTACTS EXPORT ====================

interface ContactExportData {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  category?: string;
  type?: string;
  active?: string;
}

/**
 * Export contacts list
 */
export function exportContacts(contacts: ContactExportData[], format: 'pdf' | 'excel' | 'csv' | 'json' = 'excel'): void {
  const options: ExportOptions = {
    filename: `xch-contacts-${new Date().toISOString().split('T')[0]}`,
    title: 'Liste des Contacts',
    subtitle: `${contacts.length} contact(s)`,
    columns: [
      { header: 'Nom', key: 'name', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Téléphone', key: 'phone', width: 15 },
      { header: 'Entreprise', key: 'company', width: 20 },
      { header: 'Catégorie', key: 'category', width: 14 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Actif', key: 'active', width: 8 },
    ],
    data: contacts,
  };

  switch (format) {
    case 'pdf':
      exportToPDF(options);
      break;
    case 'csv':
      exportToCSV(options);
      break;
    case 'json':
      exportToJSON(options);
      break;
    case 'excel':
    default:
      exportToExcel(options);
      break;
  }
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

  const yFinal = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`Occupation: ${usedUnits}U / ${totalUnits}U (${occupancy}%)`, 14, yFinal);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('XCH - Gestion IT Sites', doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, {
    align: 'center',
  });

  doc.save(`baie-${rackName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
}
