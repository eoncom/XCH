/**
 * XCH - Full Site Export
 *
 * Exports a complete site archive (ZIP) containing:
 * - manifest.json (complete data inventory)
 * - site-report.pdf (formatted report)
 * - assets-inventory.xlsx (all equipment)
 * - racks-inventory.xlsx (all racks with equipment)
 * - tasks.xlsx (all tasks)
 * - plans/ (floor plan PDFs with pins rendered - all versions)
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
import type { Site, Asset, Rack, Task, FloorPlan, PinType } from '@/types';

// When empty, API calls use relative URLs (same origin via nginx proxy)
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface ExportProgress {
  step: string;
  percent: number;
}

type OnProgress = (progress: ExportProgress) => void;

// ==================== Pin Constants (shared with FloorPlanViewer) ====================

const PIN_COLORS: Record<PinType, string> = {
  SWITCH: '#3b82f6',
  FIREWALL: '#ef4444',
  ACCESS_POINT: '#10b981',
  PRINTER: '#6366f1',
  RACK: '#8b5cf6',
  CAMERA: '#f59e0b',
  PATCH_PANEL: '#06b6d4',
  RJ45: '#14b8a6',
  NRO: '#a855f7',
  ROUTER: '#f97316',
  TEAMS_ROOM: '#0ea5e9',
  WEBCAM: '#ec4899',
  DISPLAY: '#84cc16',
  SERVER: '#475569',
  PDU: '#d97706',
  BOX_5G: '#e11d48',
  OTHER: '#6b7280',
};

const PIN_LABELS: Record<PinType, string> = {
  SWITCH: 'SW',
  FIREWALL: 'FW',
  ACCESS_POINT: 'AP',
  PRINTER: 'PRN',
  RACK: 'RK',
  CAMERA: 'CAM',
  PATCH_PANEL: 'PP',
  RJ45: 'RJ',
  NRO: 'NRO',
  ROUTER: 'RT',
  TEAMS_ROOM: 'TR',
  WEBCAM: 'WC',
  DISPLAY: 'EC',
  SERVER: 'SV',
  PDU: 'PDU',
  BOX_5G: '5G',
  OTHER: '?',
};

const PIN_TYPE_NAMES: Record<PinType, string> = {
  SWITCH: 'Switch',
  FIREWALL: 'Firewall',
  ACCESS_POINT: 'AP WiFi',
  PRINTER: 'Imprimante',
  RACK: 'Baie',
  CAMERA: 'Cam\u00e9ra',
  PATCH_PANEL: 'Panneau brassage',
  RJ45: 'Prise RJ-45',
  NRO: 'Arriv\u00e9e Fibre NRO',
  ROUTER: 'Routeur',
  TEAMS_ROOM: 'Teams Room',
  WEBCAM: 'Webcam',
  DISPLAY: '\u00c9cran',
  SERVER: 'Serveur',
  PDU: 'PDU',
  BOX_5G: 'Box 5G',
  OTHER: 'Autre',
};

// ==================== Canvas Drawing Helpers ====================

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawRegularPolygon(ctx: CanvasRenderingContext2D, sides: number, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawPinShapeCanvas(ctx: CanvasRenderingContext2D, pinType: PinType, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;

  switch (pinType) {
    case 'SWITCH':
      roundRect(ctx, -13, -11, 26, 22, 4);
      ctx.fill(); ctx.stroke();
      break;
    case 'FIREWALL':
      drawRegularPolygon(ctx, 6, 14);
      ctx.fill(); ctx.stroke();
      break;
    case 'ACCESS_POINT':
      drawRegularPolygon(ctx, 4, 14);
      ctx.fill(); ctx.stroke();
      break;
    case 'PRINTER':
      ctx.fillRect(-12, -12, 24, 24);
      ctx.strokeRect(-12, -12, 24, 24);
      break;
    case 'RACK':
      roundRect(ctx, -10, -14, 20, 28, 3);
      ctx.fill(); ctx.stroke();
      break;
    case 'CAMERA':
      drawRegularPolygon(ctx, 3, 14);
      ctx.fill(); ctx.stroke();
      break;
    case 'PATCH_PANEL':
      roundRect(ctx, -15, -9, 30, 18, 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      [-8, 0, 8].forEach(x => {
        ctx.beginPath(); ctx.moveTo(x, -3); ctx.lineTo(x, 3); ctx.stroke();
      });
      break;
    case 'RJ45':
      roundRect(ctx, -11, -11, 22, 22, 3);
      ctx.fill(); ctx.stroke();
      ctx.fillRect(-5, -13, 10, 4);
      break;
    case 'NRO':
      drawRegularPolygon(ctx, 5, 14);
      ctx.fill(); ctx.stroke();
      break;
    case 'ROUTER':
      roundRect(ctx, -13, -10, 26, 20, 5);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(-4, -15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, -10); ctx.lineTo(4, -15); ctx.stroke();
      break;
    case 'TEAMS_ROOM':
      roundRect(ctx, -13, -11, 26, 22, 5);
      ctx.fill(); ctx.stroke();
      break;
    case 'WEBCAM':
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'DISPLAY':
      roundRect(ctx, -15, -10, 30, 20, 3);
      ctx.fill(); ctx.stroke();
      break;
    case 'SERVER':
      roundRect(ctx, -10, -14, 20, 28, 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      [-7, 0, 7].forEach(y => {
        ctx.beginPath(); ctx.moveTo(-6, y); ctx.lineTo(6, y); ctx.stroke();
      });
      break;
    case 'PDU':
      roundRect(ctx, -8, -14, 16, 28, 2);
      ctx.fill(); ctx.stroke();
      break;
    case 'BOX_5G':
      roundRect(ctx, -13, -10, 26, 20, 5);
      ctx.fill(); ctx.stroke();
      break;
    case 'OTHER':
    default:
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
  }
}

// ==================== Image Loader ====================

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });
}

// ==================== Floor Plan PDF with Pins ====================

/**
 * Generate a PDF for a single floor plan with pins rendered on the image,
 * including legend, pin list, racks with mounted equipment, and NRO connectivity.
 */
async function generateFloorPlanPdf(
  plan: any, // FloorPlan with pins from API
  site: Site,
  allAssets: Asset[],
): Promise<ArrayBuffer> {
  const pins: any[] = (plan.pins || []);

  // Load the plan image
  const img = await loadImageFromUrl(plan.fileUrl);

  // Create offscreen canvas at 2x resolution and draw image + pins
  const canvas = document.createElement('canvas');
  canvas.width = img.width * 2;
  canvas.height = img.height * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, 0);

  // Draw each pin on canvas
  pins.forEach((pin: any) => {
    const px = pin.x * img.width;
    const py = pin.y * img.height;
    const color = PIN_COLORS[pin.pinType as PinType] || PIN_COLORS.OTHER;
    const sigle = PIN_LABELS[pin.pinType as PinType] || '?';

    ctx.save();
    ctx.translate(px, py);

    // Shadow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(1, 1, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Shape
    drawPinShapeCanvas(ctx, pin.pinType as PinType, color);

    // Label inside shape
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sigle, 0, 0);

    // Label below pin
    if (pin.label) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      const labelWidth = ctx.measureText(pin.label).width + 8;
      ctx.fillRect(-labelWidth / 2, 16, labelWidth, 16);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(pin.label, 0, 25);
    }

    ctx.restore();
  });

  const planDataUrl = canvas.toDataURL('image/png');

  // --- Build PDF ---
  const planName = plan.name || plan.title || 'Plan';
  const planVersion = plan.version || 1;
  const isLandscape = img.width > img.height;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // Title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${planName} \u2014 v${planVersion}`, margin, margin + 6);

  // Subtitle: site + floor info
  let subtitle = site.name || '';
  if (plan.building) subtitle += (subtitle ? ' \u2014 ' : '') + 'B\u00e2t. ' + plan.building;
  if (plan.floor) subtitle += (subtitle ? ' \u2014 ' : '') + '\u00c9tage ' + plan.floor;
  if (subtitle) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(subtitle, margin, margin + 12);
    pdf.setTextColor(0, 0, 0);
  }

  // Date
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text('Export\u00e9 le ' + new Date().toLocaleDateString('fr-FR') + ' \u2014 XCH', pageW - margin, margin + 6, { align: 'right' });
  pdf.setTextColor(0, 0, 0);

  // Plan image - fit to page with margins
  const imgTop = margin + 18;
  const availW = pageW - margin * 2;
  const availH = pageH - imgTop - margin - 30; // reserve 30mm for legend
  const imgRatio = img.width / img.height;
  let imgW = availW;
  let imgH = imgW / imgRatio;
  if (imgH > availH) {
    imgH = availH;
    imgW = imgH * imgRatio;
  }
  const imgX = margin + (availW - imgW) / 2;

  pdf.addImage(planDataUrl, 'PNG', imgX, imgTop, imgW, imgH);

  // Border around image
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.rect(imgX, imgTop, imgW, imgH);

  // --- Legend ---
  const usedPinTypes = Array.from(new Set(pins.map((p: any) => p.pinType))) as PinType[];
  const legendPinTypes = usedPinTypes.length > 0 ? usedPinTypes : Object.keys(PIN_COLORS) as PinType[];

  const legendTop = imgTop + imgH + 5;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('L\u00e9gende', margin, legendTop + 4);

  const legendColWidth = 38;
  const legendRowHeight = 5;
  const legendStartX = margin;
  const legendStartY = legendTop + 7;
  const maxCols = Math.floor(availW / legendColWidth);

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');

  legendPinTypes.forEach((pinType, i) => {
    const col = i % maxCols;
    const row = Math.floor(i / maxCols);
    const lx = legendStartX + col * legendColWidth;
    const ly = legendStartY + row * legendRowHeight;

    // Color dot
    const colorHex = PIN_COLORS[pinType] || '#6b7280';
    const r = parseInt(colorHex.slice(1, 3), 16);
    const g = parseInt(colorHex.slice(3, 5), 16);
    const b = parseInt(colorHex.slice(5, 7), 16);
    pdf.setFillColor(r, g, b);
    pdf.circle(lx + 2, ly + 1.5, 1.5, 'F');

    // Sigle + name
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(4);
    pdf.setFont('courier', 'bold');
    pdf.text(PIN_LABELS[pinType], lx + 2, ly + 2, { align: 'center' });

    pdf.setTextColor(50, 50, 50);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text(PIN_TYPE_NAMES[pinType], lx + 5, ly + 2.5);
  });

  // --- Pin list table ---
  let tY = legendStartY + Math.ceil(legendPinTypes.length / maxCols) * legendRowHeight + 4;
  if (pins.length > 0) {
    if (tY + 10 > pageH - margin) {
      pdf.addPage();
      tY = margin + 6;
    }

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Liste des rep\u00e8res (${pins.length})`, margin, tY);
    tY += 4;

    // Table header
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, tY, availW, 5, 'F');
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(60, 60, 60);
    pdf.text('Type', margin + 2, tY + 3.5);
    pdf.text('Libell\u00e9', margin + 30, tY + 3.5);
    pdf.text('Description', margin + 80, tY + 3.5);
    tY += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 30, 30);

    pins.forEach((pin: any, index: number) => {
      if (tY + 5 > pageH - margin) {
        pdf.addPage();
        tY = margin + 6;
      }

      // Alternating row color
      if (index % 2 === 0) {
        pdf.setFillColor(248, 248, 248);
        pdf.rect(margin, tY, availW, 5, 'F');
      }

      // Build description
      let pinDesc = pin.description || '';
      if (pin.pinType === 'NRO' && !pinDesc) {
        const primaryLink = (site.connectivity as any)?.links?.find((l: any) => l.role === 'primary');
        if (primaryLink?.provider) pinDesc = `Fournisseur: ${primaryLink.provider}`;
      }
      if (pin.pinType === 'RACK' && pin.rack && !pinDesc) {
        pinDesc = `Baie: ${pin.rack.name} (${pin.rack.heightU}U)`;
      }

      pdf.setFontSize(7);
      pdf.text(PIN_TYPE_NAMES[pin.pinType as PinType] || pin.pinType, margin + 2, tY + 3.5);
      pdf.text(pin.label || '\u2014', margin + 30, tY + 3.5);
      pdf.text((pinDesc || '\u2014').substring(0, 60), margin + 80, tY + 3.5);
      tY += 5;
    });
  }

  // --- Racks section with mounted equipment ---
  const rackPins = pins.filter((p: any) => p.pinType === 'RACK' && p.rack);
  if (rackPins.length > 0) {
    if (tY + 20 > pageH - margin) {
      pdf.addPage();
      tY = margin + 6;
    } else {
      tY += 6;
    }

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Baies (${rackPins.length})`, margin, tY);
    tY += 5;

    rackPins.forEach((pin: any) => {
      const rack = pin.rack;
      // Use rack.assets from pin data, with fallback to matching from allAssets
      const rackAssets = (rack.assets && rack.assets.length > 0)
        ? rack.assets
        : allAssets.filter(a => a.rackId === rack.id);

      if (tY + 15 > pageH - margin) {
        pdf.addPage();
        tY = margin + 6;
      }

      // Rack header
      pdf.setFillColor(139, 92, 246);
      pdf.setTextColor(255, 255, 255);
      pdf.rect(margin, tY, availW, 6, 'F');
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${rack.name} \u2014 ${rack.heightU}U`, margin + 2, tY + 4);
      if (pin.label) {
        pdf.text(`(${pin.label})`, margin + 60, tY + 4);
      }
      tY += 6;

      if (rackAssets.length === 0) {
        pdf.setTextColor(120, 120, 120);
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(7);
        pdf.text('Aucun \u00e9quipement mont\u00e9', margin + 4, tY + 3.5);
        tY += 5;
      } else {
        // Equipment sub-header
        pdf.setFillColor(245, 243, 255);
        pdf.rect(margin, tY, availW, 5, 'F');
        pdf.setTextColor(80, 80, 80);
        pdf.setFontSize(6.5);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Position', margin + 2, tY + 3.5);
        pdf.text('\u00c9quipement', margin + 22, tY + 3.5);
        pdf.text('Type', margin + 80, tY + 3.5);
        pdf.text('S/N', margin + 110, tY + 3.5);
        tY += 5;

        // Sort assets by rack position
        const sortedAssets = [...rackAssets].sort((a: any, b: any) => {
          const posA = a.rackPositionU || a.rackPosition || 0;
          const posB = b.rackPositionU || b.rackPosition || 0;
          return posA - posB;
        });

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(6.5);

        sortedAssets.forEach((asset: any, idx: number) => {
          if (tY + 5 > pageH - margin) {
            pdf.addPage();
            tY = margin + 6;
          }

          if (idx % 2 === 0) {
            pdf.setFillColor(250, 250, 252);
            pdf.rect(margin, tY, availW, 5, 'F');
          }

          const pos = (asset.rackPositionU || asset.rackPosition) ? `U${asset.rackPositionU || asset.rackPosition}` : '\u2014';
          const assetName = asset.name || asset.model || '\u2014';
          const assetMfr = asset.manufacturer ? `${asset.manufacturer} ` : '';
          const assetLabel = `${assetMfr}${assetName}`.substring(0, 40);
          const assetType = asset.type || '\u2014';
          const assetSN = (asset.serialNumber || '\u2014').substring(0, 20);

          pdf.text(pos, margin + 2, tY + 3.5);
          pdf.text(assetLabel, margin + 22, tY + 3.5);
          pdf.text(assetType, margin + 80, tY + 3.5);
          pdf.text(assetSN, margin + 110, tY + 3.5);
          tY += 5;
        });
      }

      tY += 3; // spacing between racks
    });
  }

  // --- NRO / Connectivity info ---
  const nroPins = pins.filter((p: any) => p.pinType === 'NRO');
  if (nroPins.length > 0 && site.connectivity) {
    if (tY + 20 > pageH - margin) {
      pdf.addPage();
      tY = margin + 6;
    } else {
      tY += 4;
    }

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('Connectivit\u00e9 NRO', margin, tY);
    tY += 5;

    const conn = site.connectivity as any;

    const links: any[] = conn.links || [];

    if (links.length > 0) {
      links.forEach((link: any, idx: number) => {
        if (tY + 10 > pageH - margin) {
          pdf.addPage();
          tY = margin + 6;
        }

        if (idx > 0) tY += 2;

        const roleLabel = link.role === 'primary' ? 'Lien principal' : 'Lien backup';
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(168, 85, 247);
        pdf.text(roleLabel, margin + 2, tY + 3.5);
        tY += 5;

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(7);
        if (link.provider) {
          pdf.text(`Fournisseur: ${link.provider}`, margin + 4, tY + 3.5);
          tY += 4;
        }
        if (link.type) {
          pdf.text(`Type: ${link.type}`, margin + 4, tY + 3.5);
          tY += 4;
        }
        if (link.ref) {
          pdf.text(`R\u00e9f.: ${link.ref}`, margin + 4, tY + 3.5);
          tY += 4;
        }
        if (link.bandwidth) {
          pdf.text(`D\u00e9bit: ${link.bandwidth}`, margin + 4, tY + 3.5);
          tY += 4;
        }
      });
    }
  }

  // Footer on all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `XCH \u2014 ${planName} v${planVersion} | Page ${i}/${totalPages} | ${new Date().toLocaleDateString('fr-FR')}`,
      pageW / 2, pageH - 5, { align: 'center' },
    );
  }

  return pdf.output('arraybuffer');
}

// ==================== Main Export Function ====================

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
  onProgress?.({ step: 'Chargement des donn\u00e9es associ\u00e9es...', percent: 15 });
  const [allAssets, racks, allTasks, floorPlans, documents] = await Promise.all([
    assetsApi.getAll().catch(() => [] as Asset[]),
    racksApi.getAll(siteId).catch(() => [] as Rack[]),
    tasksApi.getAll().catch(() => [] as Task[]),
    floorPlansApi.getAll(siteId).catch(() => [] as FloorPlan[]),
    sitesApi.listAllDocuments(siteId).catch(() => []),
  ]);

  const assets = allAssets.filter((a: Asset) => a.siteId === siteId);
  const tasks = allTasks.filter((t: Task) => t.siteId === siteId);

  // Enrich racks with assets from separately-fetched assets (fallback)
  const enrichedRacks = racks.map(rack => ({
    ...rack,
    assets: (rack.assets && rack.assets.length > 0)
      ? rack.assets
      : assets.filter(a => a.rackId === rack.id),
  }));

  // Step 3: Create manifest
  onProgress?.({ step: 'G\u00e9n\u00e9ration du manifeste...', percent: 25 });
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
      racks: enrichedRacks.length,
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

  // Step 4: Generate site report PDF (with enriched racks)
  onProgress?.({ step: 'G\u00e9n\u00e9ration du rapport PDF...', percent: 35 });
  const reportPdf = generateSiteReportPdf(site, assets, enrichedRacks, tasks, floorPlans);
  zip.file(`rapport-${site.code}.pdf`, reportPdf);

  // Step 5: Generate assets Excel
  onProgress?.({ step: 'G\u00e9n\u00e9ration de l\'inventaire \u00e9quipements...', percent: 45 });
  if (assets.length > 0) {
    const assetsXlsx = generateAssetsExcel(assets, enrichedRacks);
    zip.file('equipements.xlsx', assetsXlsx);
  }

  // Step 6: Generate racks Excel (with enriched racks)
  onProgress?.({ step: 'G\u00e9n\u00e9ration de l\'inventaire baies...', percent: 55 });
  if (enrichedRacks.length > 0) {
    const racksXlsx = generateRacksExcel(enrichedRacks);
    zip.file('baies.xlsx', racksXlsx);
  }

  // Step 7: Generate tasks Excel
  onProgress?.({ step: 'G\u00e9n\u00e9ration de la liste des t\u00e2ches...', percent: 65 });
  if (tasks.length > 0) {
    const tasksXlsx = generateTasksExcel(tasks);
    zip.file('taches.xlsx', tasksXlsx);
  }

  // Step 8: Download documents
  onProgress?.({ step: 'T\u00e9l\u00e9chargement des documents attach\u00e9s...', percent: 75 });
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

  // Step 8b: Generate floor plan PDFs with pins (all versions)
  onProgress?.({ step: 'G\u00e9n\u00e9ration des plans PDF avec rep\u00e8res...', percent: 82 });
  if (floorPlans.length > 0) {
    const plansFolder = zip.folder('plans');
    if (plansFolder) {
      for (let i = 0; i < floorPlans.length; i++) {
        const plan = floorPlans[i];
        if (!plan.fileUrl) continue;
        try {
          onProgress?.({
            step: `G\u00e9n\u00e9ration plan PDF ${i + 1}/${floorPlans.length}...`,
            percent: 82 + Math.round((i / floorPlans.length) * 6),
          });
          const pdfBuffer = await generateFloorPlanPdf(plan, site, assets);
          const planName = [
            plan.title || 'plan',
            `v${plan.version || 1}`,
            plan.floor ? `etage-${plan.floor}` : '',
            plan.building ? `bat-${plan.building}` : '',
          ].filter(Boolean).join('_');
          const safeFilename = planName.replace(/[/\\:*?"<>|]/g, '_');
          plansFolder.file(`${safeFilename}.pdf`, pdfBuffer);
        } catch {
          // If PDF generation fails, fallback to raw image download
          try {
            const response = await fetch(plan.fileUrl, { credentials: 'include' });
            if (response.ok) {
              const blob = await response.blob();
              const ext = (plan as any).fileType || (plan as any).mimeType?.split('/')[1] || 'png';
              const planName = [
                plan.title || 'plan',
                `v${plan.version || 1}`,
                plan.floor ? `etage-${plan.floor}` : '',
                plan.building ? `bat-${plan.building}` : '',
              ].filter(Boolean).join('_');
              const safeFilename = planName.replace(/[/\\:*?"<>|]/g, '_');
              plansFolder.file(`${safeFilename}.${ext}`, blob);
            }
          } catch {
            // Skip this plan entirely
          }
        }
      }
    }
  }

  // Step 9: Add contacts and connectivity data
  onProgress?.({ step: 'Ajout des donn\u00e9es compl\u00e9mentaires...', percent: 90 });
  if (site.contacts && site.contacts.length > 0) {
    zip.file('contacts.json', JSON.stringify(site.contacts, null, 2));
  }
  if (site.connectivity) {
    zip.file('connectivite.json', JSON.stringify(site.connectivity, null, 2));
  }

  // Step 10: Generate ZIP and download
  onProgress?.({ step: 'G\u00e9n\u00e9ration du fichier ZIP...', percent: 95 });
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  onProgress?.({ step: 'T\u00e9l\u00e9chargement...', percent: 100 });
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

  // === Informations g\u00e9n\u00e9rales ===
  doc.setFontSize(14);
  doc.setTextColor(59, 130, 246);
  doc.text('Informations g\u00e9n\u00e9rales', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const info = [
    ['Statut', site.status],
    ['Sant\u00e9', site.healthStatus],
    ['Adresse', `${site.address || ''}, ${site.postalCode || ''} ${site.city || ''}`],
    ['\u00c9quipements', `${assets.length}`],
    ['Baies', `${racks.length}`],
    ['T\u00e2ches', `${tasks.length}`],
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
      head: [['Nom', 'R\u00f4le', 'T\u00e9l\u00e9phone', 'Email']],
      body: site.contacts.map((c: any) => [c.name, c.role || '-', c.phone || '-', c.email || '-']),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      margin: { left: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // === Connectivit\u00e9 ===
  if (site.connectivity && (site.connectivity as any).links?.length > 0) {
    if (y > pageH - 50) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text('Connectivit\u00e9', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const connLinks: any[] = (site.connectivity as any).links || [];
    connLinks.forEach((link: any) => {
      const roleLabel = link.role === 'primary' ? 'Principale:' : 'Secours:';
      doc.setFont('helvetica', 'bold');
      doc.text(roleLabel, margin, y); y += 5;
      doc.setFont('helvetica', 'normal');
      if (link.provider) { doc.text(`  Op\u00e9rateur: ${link.provider}`, margin, y); y += 5; }
      if (link.type) { doc.text(`  Type: ${link.type}`, margin, y); y += 5; }
      if (link.ref) { doc.text(`  R\u00e9f: ${link.ref}`, margin, y); y += 5; }
      y += 3;
    });
    y += 5;
  }

  // === \u00c9quipements ===
  if (assets.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text(`\u00c9quipements (${assets.length})`, margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Type', 'Nom', 'Fabricant', 'Mod\u00e8le', 'N\u00b0 S\u00e9rie', 'Statut']],
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
      head: [['Nom', 'Hauteur', 'Type', '\u00c9quipements', 'Emplacement', 'Statut']],
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
          head: [['Position', 'Hauteur', '\u00c9quipement', 'Type', 'Fabricant', 'N\u00b0 S\u00e9rie']],
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

  // === T\u00e2ches ===
  if (tasks.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text(`T\u00e2ches (${tasks.length})`, margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Titre', 'Statut', 'Priorit\u00e9', 'Assign\u00e9 \u00e0', '\u00c9ch\u00e9ance']],
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
    doc.text('Serveurs & Donn\u00e9es de production', margin, y);
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
    if (end < new Date()) return `Expir\u00e9e (${end.toLocaleDateString('fr-FR')})`;
    return `Valide \u2192 ${end.toLocaleDateString('fr-FR')}`;
  };

  const wsData: any[][] = [
    ['Inventaire \u00c9quipements', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [],
    ['Type', 'Nom', 'Fabricant', 'Mod\u00e8le', 'N\u00b0 S\u00e9rie', 'Statut', 'IP', 'Hostname', 'MAC', 'Tag inv.', 'Garantie', 'Date achat', 'Baie', 'Notes'],
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
  XLSX.utils.book_append_sheet(wb, ws, '\u00c9quipements');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

function generateRacksExcel(racks: Rack[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData: any[][] = [
    ['Inventaire Baies', '', '', '', '', ''],
    [],
    ['Nom', 'Hauteur', 'Type', 'Statut', 'Emplacement', '\u00c9quipements mont\u00e9s'],
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
  XLSX.utils.book_append_sheet(wb, summaryWs, 'R\u00e9sum\u00e9');

  // Detail sheet per rack
  for (const rack of racks) {
    if (rack.assets && rack.assets.length > 0) {
      const detailData: any[][] = [
        [`Baie: ${rack.name} (${rack.heightU}U)`, '', '', '', '', ''],
        [],
        ['Position', 'Hauteur', 'Type', 'Fabricant', 'Mod\u00e8le', 'N\u00b0 S\u00e9rie'],
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
    ['Liste des T\u00e2ches', '', '', '', '', '', ''],
    [],
    ['Titre', 'Statut', 'Priorit\u00e9', 'Assign\u00e9 \u00e0', '\u00c9ch\u00e9ance', 'Cr\u00e9\u00e9 le', 'Description'],
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
  XLSX.utils.book_append_sheet(wb, ws, 'T\u00e2ches');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}
