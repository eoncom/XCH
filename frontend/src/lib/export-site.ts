/**
 * XCH - Full Site Export
 *
 * Exports a complete site archive (ZIP) containing:
 * - manifest.json (complete data inventory)
 * - site-report.pdf (formatted report)
 * - assets-inventory.xlsx (all equipment)
 * - racks-inventory.xlsx (all racks with equipment)
 * - tasks.xlsx (all tasks)
 * - documents/ (all attachments from site, assets, racks, tasks)
 */

import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { sitesApi } from './api/sites';
import { assetsApi } from './api/assets';
import { racksApi } from './api/racks';
import { tasksApi } from './api/tasks';
import { floorPlansApi } from './api/floor-plans';
import type { Site, Asset, Rack, Task, FloorPlan } from '@/types';

// When empty, API calls use relative URLs (same origin via nginx proxy)
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface ExportProgress {
  step: string;
  percent: number;
}

type OnProgress = (progress: ExportProgress) => void;

/**
 * Export a complete site as a ZIP archive
 */
export async function exportSiteZip(
  siteId: string,
  onProgress?: OnProgress,
): Promise<void> {
  const zip = new JSZip();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  // Step 1: Fetch site data
  onProgress?.({ step: 'Chargement des informations du site...', percent: 5 });
  const site = await sitesApi.getById(siteId);

  // Step 2: Fetch related data in parallel
  onProgress?.({ step: 'Chargement des donn\ées associ\ées...', percent: 15 });
  const [allAssets, racks, allTasks, floorPlans, documents] = await Promise.all([
    assetsApi.getAll().catch(() => [] as Asset[]),
    racksApi.getAll(siteId).catch(() => [] as Rack[]),
    tasksApi.getAll().catch(() => [] as Task[]),
    floorPlansApi.getAll(siteId).catch(() => [] as FloorPlan[]),
    sitesApi.listAllDocuments(siteId).catch(() => []),
  ]);

  const assets = allAssets.filter((a: Asset) => a.siteId === siteId);
  const tasks = allTasks.filter((t: Task) => t.siteId === siteId);

  // Step 3: Create manifest
  onProgress?.({ step: 'G\én\ération du manifeste...', percent: 25 });
  const manifest = {
    version: '1.0',
    exportDate: now.toISOString(),
    exportedBy: 'XCH - Gestion IT Sites',
    site: {
      id: site.id,
      code: site.code,
      name: site.name,
      status: site.status,
      healthStatus: site.healthStatus,
      address: site.address,
      city: site.city,
      postalCode: site.postalCode,
      country: site.country,
    },
    counts: {
      assets: assets.length,
      racks: racks.length,
      tasks: tasks.length,
      floorPlans: floorPlans.length,
      documents: documents.length,
    },
    contacts: site.contacts || [],
    connectivity: site.connectivity || {},
    accessNotes: site.accessNotes || {},
    metadata: site.metadata || {},
    floorPlans: floorPlans.map(fp => ({
      id: fp.id,
      title: fp.title,
      floor: fp.floor || null,
      building: fp.building || null,
      version: fp.version,
      fileType: fp.fileType || null,
    })),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Step 4: Generate site report PDF
  onProgress?.({ step: 'G\én\ération du rapport PDF...', percent: 35 });
  const reportPdf = generateSiteReportPdf(site, assets, racks, tasks, floorPlans);
  zip.file(`rapport-${site.code}.pdf`, reportPdf);

  // Step 5: Generate assets Excel
  onProgress?.({ step: 'G\én\ération de l\'inventaire \équipements...', percent: 45 });
  if (assets.length > 0) {
    const assetsXlsx = generateAssetsExcel(assets, racks);
    zip.file('equipements.xlsx', assetsXlsx);
  }

  // Step 6: Generate racks Excel
  onProgress?.({ step: 'G\én\ération de l\'inventaire baies...', percent: 55 });
  if (racks.length > 0) {
    const racksXlsx = generateRacksExcel(racks);
    zip.file('baies.xlsx', racksXlsx);
  }

  // Step 7: Generate tasks Excel
  onProgress?.({ step: 'G\én\ération de la liste des t\âches...', percent: 65 });
  if (tasks.length > 0) {
    const tasksXlsx = generateTasksExcel(tasks);
    zip.file('taches.xlsx', tasksXlsx);
  }

  // Step 8: Download documents
  onProgress?.({ step: 'T\él\échargement des documents attach\és...', percent: 75 });
  if (documents.length > 0) {
    const docsFolder = zip.folder('documents');
    if (docsFolder) {
      // Group by source
      const bySource: Record<string, any[]> = {};
      for (const doc of documents) {
        const source = doc.source || 'site';
        if (!bySource[source]) bySource[source] = [];
        bySource[source].push(doc);
      }

      for (const [source, docs] of Object.entries(bySource)) {
        const sourceFolder = docsFolder.folder(source);
        if (sourceFolder) {
          for (const doc of docs) {
            try {
              const response = await fetch(doc.url, { credentials: 'include' });
              if (response.ok) {
                const blob = await response.blob();
                sourceFolder.file(doc.originalFilename || `document-${doc.id}`, blob);
              }
            } catch {
              // Skip files that can't be downloaded
            }
          }
        }
      }
    }
  }

  // Step 8b: Download floor plan images
  onProgress?.({ step: 'T\él\échargement des plans...', percent: 82 });
  if (floorPlans.length > 0) {
    const plansFolder = zip.folder('plans');
    if (plansFolder) {
      for (const plan of floorPlans) {
        if (!plan.fileUrl) continue;
        try {
          const response = await fetch(plan.fileUrl, { credentials: 'include' });
          if (response.ok) {
            const blob = await response.blob();
            // Build filename: title + floor info + extension
            const ext = plan.fileType || plan.mimeType?.split('/')[1] || 'png';
            const planName = [
              plan.title || 'plan',
              plan.floor ? `etage-${plan.floor}` : '',
              plan.building ? `bat-${plan.building}` : '',
            ].filter(Boolean).join('_');
            const safeFilename = planName.replace(/[/\\:*?"<>|]/g, '_');
            plansFolder.file(`${safeFilename}.${ext}`, blob);
          }
        } catch {
          // Skip floor plans that can't be downloaded
        }
      }
    }
  }

  // Step 9: Add contacts and connectivity data
  onProgress?.({ step: 'Ajout des donn\ées compl\émentaires...', percent: 90 });
  if (site.contacts && site.contacts.length > 0) {
    zip.file('contacts.json', JSON.stringify(site.contacts, null, 2));
  }
  if (site.connectivity) {
    zip.file('connectivite.json', JSON.stringify(site.connectivity, null, 2));
  }

  // Step 10: Generate ZIP and download
  onProgress?.({ step: 'G\én\ération du fichier ZIP...', percent: 95 });
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  onProgress?.({ step: 'T\él\échargement...', percent: 100 });
  saveAs(zipBlob, `site-${site.code}-${dateStr}.zip`);
}

// ==================== PDF Report ====================

function generateSiteReportPdf(
  site: Site,
  assets: Asset[],
  racks: Rack[],
  tasks: Task[],
  floorPlans: FloorPlan[],
): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const margin = 14;
  let y = 20;

  // === Header ===
  doc.setFontSize(24);
  doc.setTextColor(59, 130, 246);
  doc.text('XCH', margin, y);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Gestion IT Sites', margin + 25, y);
  y += 15;

  // === Title ===
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text(`Rapport: ${site.name}`, margin, y);
  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Code: ${site.code} | ${new Date().toLocaleDateString('fr-FR')}`, margin, y);
  y += 15;

  // === Informations g\én\érales ===
  doc.setFontSize(14);
  doc.setTextColor(59, 130, 246);
  doc.text('Informations g\én\érales', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const info = [
    ['Statut', site.status],
    ['Sant\é', site.healthStatus],
    ['Adresse', `${site.address || ''}, ${site.postalCode || ''} ${site.city || ''}`],
    ['\Équipements', `${assets.length}`],
    ['Baies', `${racks.length}`],
    ['T\âches', `${tasks.length}`],
    ['Plans', `${floorPlans.length}`],
  ];

  for (const [label, value] of info) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 35, y);
    y += 6;
  }
  y += 5;

  // === Contacts ===
  if (site.contacts && site.contacts.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text(`Contacts (${site.contacts.length})`, margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Nom', 'R\ôle', 'T\él\éphone', 'Email']],
      body: site.contacts.map((c: any) => [c.name, c.role || '-', c.phone || '-', c.email || '-']),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      margin: { left: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // === Connectivit\é ===
  if (site.connectivity && (site.connectivity.primary || site.connectivity.backup)) {
    if (y > pageH - 50) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text('Connectivit\é', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    if (site.connectivity.primary) {
      doc.setFont('helvetica', 'bold');
      doc.text('Principale:', margin, y); y += 5;
      doc.setFont('helvetica', 'normal');
      if (site.connectivity.primary.provider) { doc.text(`  Op\érateur: ${site.connectivity.primary.provider}`, margin, y); y += 5; }
      if (site.connectivity.primary.type) { doc.text(`  Type: ${site.connectivity.primary.type}`, margin, y); y += 5; }
      if (site.connectivity.primary.ref) { doc.text(`  R\éf: ${site.connectivity.primary.ref}`, margin, y); y += 5; }
      y += 3;
    }
    if (site.connectivity.backup) {
      doc.setFont('helvetica', 'bold');
      doc.text('Secours:', margin, y); y += 5;
      doc.setFont('helvetica', 'normal');
      if (site.connectivity.backup.provider) { doc.text(`  Op\érateur: ${site.connectivity.backup.provider}`, margin, y); y += 5; }
      if (site.connectivity.backup.type) { doc.text(`  Type: ${site.connectivity.backup.type}`, margin, y); y += 5; }
      if (site.connectivity.backup.ref) { doc.text(`  R\éf: ${site.connectivity.backup.ref}`, margin, y); y += 5; }
      y += 3;
    }
    y += 5;
  }

  // === \Équipements ===
  if (assets.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text(`\Équipements (${assets.length})`, margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Type', 'Nom', 'Fabricant', 'Mod\èle', 'N\° S\érie', 'Statut']],
      body: assets.map((a) => [
        a.type, a.name || '-', a.manufacturer || '-', a.model || '-', a.serialNumber || '-', a.status,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
      styles: { fontSize: 8 },
      margin: { left: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // === Baies ===
  if (racks.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text(`Baies (${racks.length})`, margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Nom', 'Hauteur', 'Type', '\Équipements', 'Emplacement', 'Statut']],
      body: racks.map((r) => [
        r.name, `${r.heightU}U`, r.rackType || '-', `${r.assets?.length || 0}`, r.location || '-', r.status,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [147, 51, 234] },
      styles: { fontSize: 9 },
      margin: { left: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Rack details with mounted equipment
    for (const rack of racks) {
      if (rack.assets && rack.assets.length > 0) {
        if (y > pageH - 50) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setTextColor(147, 51, 234);
        doc.text(`Baie: ${rack.name} (${rack.heightU}U)`, margin, y);
        y += 3;

        autoTable(doc, {
          startY: y,
          head: [['Position', 'Hauteur', '\Équipement', 'Type', 'Fabricant', 'N\° S\érie']],
          body: rack.assets
            .sort((a, b) => (b.rackPositionU || 0) - (a.rackPositionU || 0))
            .map((a) => [
              `U${a.rackPositionU}`, `${a.rackHeightU}U`,
              a.name || `${a.manufacturer || ''} ${a.model || ''}`.trim() || '-',
              a.type, a.manufacturer || '-', a.serialNumber || '-',
            ]),
          theme: 'grid',
          headStyles: { fillColor: [147, 51, 234], fontSize: 8 },
          styles: { fontSize: 8 },
          margin: { left: margin + 5 },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }
    }
  }

  // === T\âches ===
  if (tasks.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text(`T\âches (${tasks.length})`, margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Titre', 'Statut', 'Priorit\é', 'Assign\é \à', '\Éch\éance']],
      body: tasks.map((t) => [
        t.title,
        t.status,
        t.priority,
        t.assignedUser?.name || '-',
        t.dueDate ? new Date(t.dueDate).toLocaleDateString('fr-FR') : '-',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
      styles: { fontSize: 9 },
      margin: { left: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // === Server Info ===
  if (site.metadata?.serverInfo) {
    if (y > pageH - 50) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text('Serveurs & Donn\ées de production', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const si = site.metadata.serverInfo;
    if (si.smbPath) { doc.text(`SMB: ${si.smbPath}`, margin, y); y += 5; }
    if (si.sharepointUrl) { doc.text(`SharePoint: ${si.sharepointUrl}`, margin, y); y += 5; }
    if (si.gedUrl) { doc.text(`GED: ${si.gedUrl}`, margin, y); y += 5; }
    if (si.accessRightsUrl) { doc.text(`Droits: ${si.accessRightsUrl}`, margin, y); y += 5; }
    if (si.notes) { doc.text(`Notes: ${si.notes}`, margin, y); y += 5; }
  }

  // === Footer on all pages ===
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `XCH - Rapport ${site.code} | Page ${i}/${totalPages} | ${new Date().toLocaleDateString('fr-FR')}`,
      pageW / 2, pageH - 10, { align: 'center' },
    );
  }

  return doc.output('arraybuffer');
}

// ==================== Excel Generators ====================

function generateAssetsExcel(assets: Asset[], racks: Rack[]): ArrayBuffer {
  const rackMap = Object.fromEntries(racks.map((r) => [r.id, r.name]));

  const formatWarranty = (warrantyEnd?: string) => {
    if (!warrantyEnd) return '';
    const end = new Date(warrantyEnd);
    if (end < new Date()) return `Expirée (${end.toLocaleDateString('fr-FR')})`;
    return `Valide → ${end.toLocaleDateString('fr-FR')}`;
  };

  const wsData: any[][] = [
    ['Inventaire Équipements', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [],
    ['Type', 'Nom', 'Fabricant', 'Modèle', 'N° Série', 'Statut', 'IP', 'Hostname', 'MAC', 'Tag inv.', 'Garantie', 'Date achat', 'Baie', 'Notes'],
  ];

  for (const a of assets) {
    const net = a.networkInfo as any;
    wsData.push([
      a.type,
      a.name || '',
      a.manufacturer || '',
      a.model || '',
      a.serialNumber || '',
      a.status,
      net?.ip || '',
      net?.hostname || '',
      net?.mac || '',
      a.inventoryTag || '',
      formatWarranty(a.warrantyEnd),
      a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('fr-FR') : '',
      a.rackId ? rackMap[a.rackId] || '' : '',
      a.notes || '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 14 }, { wch: 22 }, { wch: 15 }, { wch: 20 },
    { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 12 },
    { wch: 12 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Équipements');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

function generateRacksExcel(racks: Rack[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData: any[][] = [
    ['Inventaire Baies', '', '', '', '', ''],
    [],
    ['Nom', 'Hauteur', 'Type', 'Statut', 'Emplacement', '\Équipements mont\és'],
  ];
  for (const r of racks) {
    summaryData.push([
      r.name, `${r.heightU}U`, r.rackType || '', r.status, r.location || '',
      r.assets?.length || 0,
    ]);
  }

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [
    { wch: 20 }, { wch: 10 }, { wch: 18 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'R\ésum\é');

  // Detail sheet per rack
  for (const rack of racks) {
    if (rack.assets && rack.assets.length > 0) {
      const detailData: any[][] = [
        [`Baie: ${rack.name} (${rack.heightU}U)`, '', '', '', '', ''],
        [],
        ['Position', 'Hauteur', 'Type', 'Fabricant', 'Mod\èle', 'N\° S\érie'],
      ];
      for (const a of rack.assets.sort((x, y) => (y.rackPositionU || 0) - (x.rackPositionU || 0))) {
        detailData.push([
          `U${a.rackPositionU}`, `${a.rackHeightU}U`, a.type,
          a.manufacturer || '', a.model || '', a.serialNumber || '',
        ]);
      }
      const detailWs = XLSX.utils.aoa_to_sheet(detailData);
      detailWs['!cols'] = [
        { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
      ];
      const sheetName = rack.name.substring(0, 31).replace(/[/\\*?[\]]/g, '_');
      XLSX.utils.book_append_sheet(wb, detailWs, sheetName);
    }
  }

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

function generateTasksExcel(tasks: Task[]): ArrayBuffer {
  const wsData: any[][] = [
    ['Liste des T\âches', '', '', '', '', '', ''],
    [],
    ['Titre', 'Statut', 'Priorit\é', 'Assign\é \à', '\Éch\éance', 'Cr\é\é le', 'Description'],
  ];

  for (const t of tasks) {
    wsData.push([
      t.title,
      t.status,
      t.priority,
      t.assignedUser?.name || '',
      t.dueDate ? new Date(t.dueDate).toLocaleDateString('fr-FR') : '',
      new Date(t.createdAt).toLocaleDateString('fr-FR'),
      t.description || '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 35 }, { wch: 12 }, { wch: 10 }, { wch: 20 },
    { wch: 12 }, { wch: 12 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'T\âches');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}
