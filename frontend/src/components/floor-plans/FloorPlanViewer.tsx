'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group, Rect, Line, RegularPolygon } from 'react-konva';
import { jsPDF } from 'jspdf';
import type { FloorPlan, Pin, PinType, Rack, HeatmapConfig, HeatmapAccessPoint } from '@/types';
import WifiHeatmapLayer, { renderHeatmapToCanvas } from './WifiHeatmapLayer';

// Custom hook to load image
// Tries with crossOrigin='anonymous' first (needed for canvas export / PDF generation).
// If CORS headers are missing the browser blocks the load, so we retry without crossOrigin.
function useImage(url: string): [HTMLImageElement | undefined, 'loading' | 'loaded' | 'failed'] {
  const [image, setImage] = useState<HTMLImageElement>();
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

  useEffect(() => {
    if (!url) {
      setStatus('failed');
      return;
    }

    let cancelled = false;

    const tryLoad = (useCors: boolean) => {
      const img = new window.Image();
      if (useCors) img.crossOrigin = 'anonymous';

      img.onload = () => {
        if (cancelled) return;
        setImage(img);
        setStatus('loaded');
      };

      img.onerror = () => {
        if (cancelled) return;
        if (useCors) {
          // CORS blocked — retry without crossOrigin (canvas export will be limited)
          tryLoad(false);
        } else {
          setStatus('failed');
        }
      };

      img.src = url;
    };

    tryLoad(true);

    return () => {
      cancelled = true;
    };
  }, [url]);

  return [image, status];
}

interface FloorPlanViewerProps {
  floorPlan: FloorPlan;
  pins: Pin[];
  onPinClick?: (pin: Pin) => void;
  onStageClick?: (x: number, y: number) => void;
  onPinDragEnd?: (pinId: string, x: number, y: number) => void;
  editable?: boolean;
  onExportReady?: (exportFn: () => void) => void;
  /** Wi-Fi heatmap configuration */
  heatmapConfig?: HeatmapConfig;
  /** Access point data for heatmap rendering */
  heatmapAccessPoints?: HeatmapAccessPoint[];
  /** Scale calibration (meters per normalized unit) */
  scaleMetersPerPixel?: number | null;
  /** Callback when an AP pin is dragged (for live heatmap update) */
  onApPinDragMove?: (pinId: string, x: number, y: number) => void;
  /** Calibration mode: user is picking points on the plan */
  calibrationMode?: boolean;
  /** Points picked during calibration (normalized 0-1) */
  calibrationPoints?: { x: number; y: number }[];
  /** Saved reference line from previous calibration */
  scaleRefLine?: { x1: number; y1: number; x2: number; y2: number; meters: number } | null;
  /** Show metric grid overlay */
  showCalibrationGrid?: boolean;
}

const PIN_COLORS: Record<PinType, string> = {
  SWITCH: '#3b82f6',       // blue
  FIREWALL: '#ef4444',     // red
  WIFI_AP: '#10b981', // green
  PRINTER: '#6366f1',      // indigo
  RACK: '#8b5cf6',         // purple
  CAMERA: '#f59e0b',       // amber (orange)
  PATCH_PANEL: '#06b6d4',  // cyan
  RJ45: '#14b8a6',         // teal
  NRO: '#a855f7',          // purple-light
  ROUTER: '#f97316',       // orange
  TEAMS_ROOM: '#0ea5e9',   // sky blue
  WEBCAM: '#ec4899',       // pink
  DISPLAY: '#84cc16',      // lime
  SERVER: '#475569',       // slate
  PDU: '#d97706',          // amber-dark
  BOX_5G: '#e11d48',       // rose
  OTHER: '#6b7280',        // gray
};

const PIN_LABELS: Record<PinType, string> = {
  SWITCH: 'SW',
  FIREWALL: 'FW',
  WIFI_AP: 'AP',
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
  WIFI_AP: 'AP WiFi',
  PRINTER: 'Imprimante',
  RACK: 'Baie',
  CAMERA: 'Caméra',
  PATCH_PANEL: 'Panneau brassage',
  RJ45: 'Prise RJ-45',
  NRO: 'Arrivée Fibre NRO',
  ROUTER: 'Routeur',
  TEAMS_ROOM: 'Teams Room',
  WEBCAM: 'Webcam',
  DISPLAY: 'Écran',
  SERVER: 'Serveur',
  PDU: 'PDU',
  BOX_5G: 'Box 5G',
  OTHER: 'Autre',
};

/**
 * Draw a rounded rectangle on a Canvas 2D context
 */
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

/**
 * Draw pin shape on a native Canvas 2D context (for offscreen export)
 */
function drawPinShapeCanvas(ctx: CanvasRenderingContext2D, pinType: PinType, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;

  switch (pinType) {
    case 'SWITCH': // rounded rectangle
      roundRect(ctx, -13, -11, 26, 22, 4);
      ctx.fill(); ctx.stroke();
      break;
    case 'FIREWALL': // hexagon
      drawRegularPolygon(ctx, 6, 14);
      ctx.fill(); ctx.stroke();
      break;
    case 'WIFI_AP': // diamond
      drawRegularPolygon(ctx, 4, 14);
      ctx.fill(); ctx.stroke();
      break;
    case 'PRINTER': // square
      ctx.fillRect(-12, -12, 24, 24);
      ctx.strokeRect(-12, -12, 24, 24);
      break;
    case 'RACK': // tall rectangle
      roundRect(ctx, -10, -14, 20, 28, 3);
      ctx.fill(); ctx.stroke();
      break;
    case 'CAMERA': // triangle
      drawRegularPolygon(ctx, 3, 14);
      ctx.fill(); ctx.stroke();
      break;
    case 'PATCH_PANEL': // wide rectangle with lines
      roundRect(ctx, -15, -9, 30, 18, 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      [-8, 0, 8].forEach(x => {
        ctx.beginPath(); ctx.moveTo(x, -3); ctx.lineTo(x, 3); ctx.stroke();
      });
      break;
    case 'RJ45': // square with clip
      roundRect(ctx, -11, -11, 22, 22, 3);
      ctx.fill(); ctx.stroke();
      ctx.fillRect(-5, -13, 10, 4);
      break;
    case 'NRO': // pentagon
      drawRegularPolygon(ctx, 5, 14);
      ctx.fill(); ctx.stroke();
      break;
    case 'ROUTER': // rounded rectangle with antenna
      roundRect(ctx, -13, -10, 26, 20, 5);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(-4, -15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, -10); ctx.lineTo(4, -15); ctx.stroke();
      break;
    case 'TEAMS_ROOM': // rounded square (screen shape)
      roundRect(ctx, -13, -11, 26, 22, 5);
      ctx.fill(); ctx.stroke();
      break;
    case 'WEBCAM': // circle with lens
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'DISPLAY': // wide rectangle (screen)
      roundRect(ctx, -15, -10, 30, 20, 3);
      ctx.fill(); ctx.stroke();
      break;
    case 'SERVER': // tall rectangle with lines
      roundRect(ctx, -10, -14, 20, 28, 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      [-7, 0, 7].forEach(y => {
        ctx.beginPath(); ctx.moveTo(-6, y); ctx.lineTo(6, y); ctx.stroke();
      });
      break;
    case 'PDU': // vertical rectangle
      roundRect(ctx, -8, -14, 16, 28, 2);
      ctx.fill(); ctx.stroke();
      break;
    case 'BOX_5G': // rounded rectangle with signal
      roundRect(ctx, -13, -10, 26, 20, 5);
      ctx.fill(); ctx.stroke();
      break;
    case 'OTHER':
    default: // circle
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
  }
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

interface PinMarkerProps {
  pin: Pin;
  onClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  draggable?: boolean;
}

interface PinMarkerInternalProps extends PinMarkerProps {
  imageWidth: number;
  imageHeight: number;
}

/**
 * Renders a pin marker with a distinctive shape per equipment type.
 * Uses sigles (SW, FW, AP...) inside colored shapes.
 */
function PinMarker({ pin, onClick, onDragEnd, draggable = false, imageWidth, imageHeight }: PinMarkerInternalProps) {
  const pixelX = pin.x * imageWidth;
  const pixelY = pin.y * imageHeight;
  const color = PIN_COLORS[pin.pinType] || PIN_COLORS.OTHER;
  const sigle = PIN_LABELS[pin.pinType] || '?';

  const handleDragEnd = (e: any) => {
    if (onDragEnd) {
      const newX = e.target.x();
      const newY = e.target.y();
      const normalizedX = newX / imageWidth;
      const normalizedY = newY / imageHeight;
      onDragEnd(normalizedX, normalizedY);
    }
  };

  return (
    <Group
      x={pixelX}
      y={pixelY}
      onClick={onClick}
      onTap={onClick}
      draggable={draggable}
      onDragMove={() => {}}
      onDragEnd={handleDragEnd}
    >
      {/* S6 PR5 — Invisible 44x44 hit area centered on the pin so taps
          on tablet/iPad land cleanly on a finger-sized target without
          changing the visual size of the pin shape. */}
      <Rect
        x={-22}
        y={-22}
        width={44}
        height={44}
        fill="transparent"
        listening={true}
      />

      {/* Shadow */}
      <Circle
        radius={15}
        fill="#000000"
        opacity={0.2}
        offsetX={-1}
        offsetY={-1}
      />

      {/* Shape per type */}
      <PinShape pinType={pin.pinType} color={color} />

      {/* Sigle text inside shape */}
      <Text
        text={sigle}
        x={-12}
        y={-7}
        width={24}
        align="center"
        fontSize={10}
        fill="#ffffff"
        fontStyle="bold"
        fontFamily="monospace"
      />

      {/* Label below */}
      {pin.label && (
        <Text
          text={pin.label}
          x={-50}
          y={16}
          width={100}
          align="center"
          fontSize={11}
          fill="#000000"
          fontStyle="bold"
          shadowColor="#ffffff"
          shadowBlur={3}
          shadowOpacity={0.9}
        />
      )}
    </Group>
  );
}

/**
 * Renders a distinctive shape per pin type
 */
function PinShape({ pinType, color }: { pinType: PinType; color: string }) {
  switch (pinType) {
    // Switch: rounded rectangle (network switch shape)
    case 'SWITCH':
      return (
        <Rect
          x={-13}
          y={-11}
          width={26}
          height={22}
          fill={color}
          stroke="#1e3a5f"
          strokeWidth={2}
          cornerRadius={4}
        />
      );

    // Firewall: shield shape (hexagon)
    case 'FIREWALL':
      return (
        <RegularPolygon
          sides={6}
          radius={14}
          fill={color}
          stroke="#7f1d1d"
          strokeWidth={2}
        />
      );

    // Access Point: WiFi symbol - diamond with radio waves
    case 'WIFI_AP':
      return (
        <>
          {/* Diamond base */}
          <RegularPolygon
            sides={4}
            radius={14}
            fill={color}
            stroke="#064e3b"
            strokeWidth={2}
          />
        </>
      );

    // Printer: rectangle (paper shape)
    case 'PRINTER':
      return (
        <Rect
          x={-12}
          y={-12}
          width={24}
          height={24}
          fill={color}
          stroke="#312e81"
          strokeWidth={2}
          cornerRadius={2}
        />
      );

    // Rack: tall rectangle
    case 'RACK':
      return (
        <Rect
          x={-10}
          y={-14}
          width={20}
          height={28}
          fill={color}
          stroke="#4c1d95"
          strokeWidth={2}
          cornerRadius={3}
        />
      );

    // Camera: triangle (lens shape)
    case 'CAMERA':
      return (
        <RegularPolygon
          sides={3}
          radius={14}
          fill={color}
          stroke="#78350f"
          strokeWidth={2}
        />
      );

    // Patch Panel: wide rectangle with lines
    case 'PATCH_PANEL':
      return (
        <>
          <Rect
            x={-15}
            y={-9}
            width={30}
            height={18}
            fill={color}
            stroke="#164e63"
            strokeWidth={2}
            cornerRadius={2}
          />
          {/* Port indicators */}
          <Line
            points={[-8, -3, -8, 3]}
            stroke="#ffffff"
            strokeWidth={1}
            opacity={0.6}
          />
          <Line
            points={[0, -3, 0, 3]}
            stroke="#ffffff"
            strokeWidth={1}
            opacity={0.6}
          />
          <Line
            points={[8, -3, 8, 3]}
            stroke="#ffffff"
            strokeWidth={1}
            opacity={0.6}
          />
        </>
      );

    // RJ45: small square (plug shape)
    case 'RJ45':
      return (
        <>
          <Rect
            x={-11}
            y={-11}
            width={22}
            height={22}
            fill={color}
            stroke="#134e4a"
            strokeWidth={2}
            cornerRadius={3}
          />
          {/* RJ45 clip indicator */}
          <Rect
            x={-5}
            y={-13}
            width={10}
            height={4}
            fill={color}
            stroke="#134e4a"
            strokeWidth={1}
            cornerRadius={1}
          />
        </>
      );

    // NRO: pentagon (fiber node)
    case 'NRO':
      return (
        <RegularPolygon
          sides={5}
          radius={14}
          fill={color}
          stroke="#581c87"
          strokeWidth={2}
        />
      );

    // Router: rounded rectangle
    case 'ROUTER':
      return (
        <Rect
          x={-13}
          y={-10}
          width={26}
          height={20}
          fill={color}
          stroke="#9a3412"
          strokeWidth={2}
          cornerRadius={5}
        />
      );

    // Teams Room: rounded square
    case 'TEAMS_ROOM':
      return (
        <Rect
          x={-13}
          y={-11}
          width={26}
          height={22}
          fill={color}
          stroke="#0369a1"
          strokeWidth={2}
          cornerRadius={5}
        />
      );

    // Webcam: circle with lens
    case 'WEBCAM':
      return (
        <>
          <Circle
            radius={13}
            fill={color}
            stroke="#9d174d"
            strokeWidth={2}
          />
          <Circle
            radius={6}
            stroke="#ffffff"
            strokeWidth={1.5}
            opacity={0.6}
          />
        </>
      );

    // Display: wide rectangle (screen)
    case 'DISPLAY':
      return (
        <Rect
          x={-15}
          y={-10}
          width={30}
          height={20}
          fill={color}
          stroke="#3f6212"
          strokeWidth={2}
          cornerRadius={3}
        />
      );

    // Server: tall rectangle with lines
    case 'SERVER':
      return (
        <>
          <Rect
            x={-10}
            y={-14}
            width={20}
            height={28}
            fill={color}
            stroke="#1e293b"
            strokeWidth={2}
            cornerRadius={2}
          />
          <Line points={[-6, -7, 6, -7]} stroke="#ffffff" strokeWidth={1} opacity={0.5} />
          <Line points={[-6, 0, 6, 0]} stroke="#ffffff" strokeWidth={1} opacity={0.5} />
          <Line points={[-6, 7, 6, 7]} stroke="#ffffff" strokeWidth={1} opacity={0.5} />
        </>
      );

    // PDU: vertical rectangle
    case 'PDU':
      return (
        <Rect
          x={-8}
          y={-14}
          width={16}
          height={28}
          fill={color}
          stroke="#92400e"
          strokeWidth={2}
          cornerRadius={2}
        />
      );

    // Box 5G: rounded rectangle
    case 'BOX_5G':
      return (
        <Rect
          x={-13}
          y={-10}
          width={26}
          height={20}
          fill={color}
          stroke="#9f1239"
          strokeWidth={2}
          cornerRadius={5}
        />
      );

    // Other: circle (default)
    case 'OTHER':
    default:
      return (
        <Circle
          radius={13}
          fill={color}
          stroke="#374151"
          strokeWidth={2}
        />
      );
  }
}

export default function FloorPlanViewer({
  floorPlan,
  pins,
  onPinClick,
  onStageClick,
  onPinDragEnd,
  editable = false,
  onExportReady,
  heatmapConfig,
  heatmapAccessPoints,
  scaleMetersPerPixel,
  onApPinDragMove,
  calibrationMode,
  calibrationPoints,
  scaleRefLine,
  showCalibrationGrid,
}: FloorPlanViewerProps) {
  const [image, imageStatus] = useImage(floorPlan.fileUrl || '');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Heatmap drag update trigger (incremented to force re-render)
  const [heatmapTrigger, setHeatmapTrigger] = useState(0);
  const heatmapAPRef = useRef(heatmapAccessPoints);
  heatmapAPRef.current = heatmapAccessPoints;
  const heatmapConfigRef = useRef(heatmapConfig);
  heatmapConfigRef.current = heatmapConfig;
  const scaleRef = useRef(scaleMetersPerPixel);
  scaleRef.current = scaleMetersPerPixel;

  // Filter pins: hide non-AP when heatmap active and hideOtherPins is true
  const visiblePins = useMemo(() => {
    if (heatmapConfig?.enabled && heatmapConfig.hideOtherPins) {
      return pins.filter(p => p.pinType === 'WIFI_AP');
    }
    return pins;
  }, [pins, heatmapConfig?.enabled, heatmapConfig?.hideOtherPins]);

  // Refs to hold latest data for export (avoids re-render loops)
  const pinsRef = useRef(pins);
  const imageRef = useRef(image);
  const floorPlanRef = useRef(floorPlan);
  pinsRef.current = pins;
  imageRef.current = image;
  floorPlanRef.current = floorPlan;

  // Expose PDF export function to parent ONCE (stable reference, reads data from refs)
  useEffect(() => {
    if (!onExportReady) return;

    const exportFn = () => {
      const currentImage = imageRef.current;
      const currentPins = pinsRef.current;
      const currentFloorPlan = floorPlanRef.current;
      if (!currentImage) return;

      // --- Step 1: Draw plan + pins on offscreen canvas ---
      const currentHeatmapConfig = heatmapConfigRef.current;
      const currentHeatmapAPs = heatmapAPRef.current;
      const currentScale = scaleRef.current;

      // WiFi page is included when APs exist AND (toggle enabled OR plan is calibrated)
      const hasAPs = !!(currentHeatmapAPs && currentHeatmapAPs.length > 0);
      const hasCalibration = currentScale != null && currentScale > 0;
      const heatmapActive = hasAPs && (currentHeatmapConfig?.enabled || hasCalibration);
      // Default config when toggle is off but plan qualifies for WiFi page
      const effectiveHeatmapConfig = currentHeatmapConfig?.enabled
        ? currentHeatmapConfig
        : { enabled: true, frequency: 'all' as const, minSignal: -80, opacity: 0.5, hideOtherPins: false };

      // Helper: draw pins on a canvas context
      const drawPinsOnCanvas = (ctx: CanvasRenderingContext2D, pinsToRender: typeof currentPins) => {
        pinsToRender.forEach(pin => {
          const px = pin.x * currentImage.width;
          const py = pin.y * currentImage.height;
          const color = PIN_COLORS[pin.pinType] || PIN_COLORS.OTHER;
          const sigle = PIN_LABELS[pin.pinType] || '?';

          ctx.save();
          ctx.translate(px, py);
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(1, 1, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          drawPinShapeCanvas(ctx, pin.pinType, color);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sigle, 0, 0);
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
      };

      // Render Page 1: Complete plan (without heatmap, all pins)
      const canvas = document.createElement('canvas');
      canvas.width = currentImage.width * 2;
      canvas.height = currentImage.height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(2, 2);
      ctx.drawImage(currentImage, 0, 0);
      drawPinsOnCanvas(ctx, currentPins);
      const planDataUrl = canvas.toDataURL('image/png');

      // Render WiFi heatmaps: 4 quadrants (2.4 GHz, 5 GHz, 6 GHz, All)
      const wifiBands: { freq: '2.4' | '5' | '6' | 'all'; label: string }[] = [
        { freq: '2.4', label: '2.4 GHz' },
        { freq: '5', label: '5 GHz' },
        { freq: '6', label: '6 GHz' },
        { freq: 'all', label: 'Toutes bandes' },
      ];
      const heatmapQuadrants: { label: string; dataUrl: string }[] = [];
      if (heatmapActive) {
        const apPins = currentPins.filter(p => p.pinType === 'WIFI_AP');
        for (const band of wifiBands) {
          const hCanvas = document.createElement('canvas');
          hCanvas.width = currentImage.width * 2;
          hCanvas.height = currentImage.height * 2;
          const hCtx = hCanvas.getContext('2d');
          if (!hCtx) continue;
          hCtx.scale(2, 2);
          hCtx.drawImage(currentImage, 0, 0);

          // Render heatmap on separate transparent canvas (screen composite
          // only blends AP circles with each other, not the floor plan image)
          const heatOverlay = document.createElement('canvas');
          heatOverlay.width = currentImage.width * 2;
          heatOverlay.height = currentImage.height * 2;
          const hoCtx = heatOverlay.getContext('2d');
          if (hoCtx) {
            hoCtx.scale(2, 2);
            const bandConfig = { ...effectiveHeatmapConfig, frequency: band.freq };
            renderHeatmapToCanvas(
              hoCtx,
              currentHeatmapAPs!,
              bandConfig,
              currentScale || null,
              currentImage.width,
              currentImage.height,
            );
            // Reset transform before overlay draw — both canvases are 2x pixels,
            // drawing without transform maps them 1:1 (avoids double-scaling 4x bug)
            hCtx.save();
            hCtx.setTransform(1, 0, 0, 1, 0, 0);
            hCtx.drawImage(heatOverlay, 0, 0);
            hCtx.restore();
          }

          drawPinsOnCanvas(hCtx, apPins);
          heatmapQuadrants.push({ label: band.label, dataUrl: hCanvas.toDataURL('image/png') });
        }
      }

      // --- Step 2: Build PDF ---
      const planName = currentFloorPlan.title || 'Plan';
      const isLandscape = currentImage.width > currentImage.height;
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;

      // Title
      const planVersion = currentFloorPlan.version || 1;
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${planName} — v${planVersion}`, margin, margin + 6);

      // Subtitle: site + floor info
      let subtitle = '';
      if ((currentFloorPlan as any).site?.name) subtitle += (currentFloorPlan as any).site.name;
      if (currentFloorPlan.building) subtitle += (subtitle ? ' — ' : '') + 'Bât. ' + currentFloorPlan.building;
      if (currentFloorPlan.floor) subtitle += (subtitle ? ' — ' : '') + 'Étage ' + currentFloorPlan.floor;
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
      pdf.text('Exporté le ' + new Date().toLocaleDateString('fr-FR') + ' — XCH', pageW - margin, margin + 6, { align: 'right' });
      pdf.setTextColor(0, 0, 0);

      // Plan image — fit to page with margins
      const imgTop = margin + 18;
      const availW = pageW - margin * 2;
      const availH = pageH - imgTop - margin - 30; // reserve 30mm for legend
      const imgRatio = currentImage.width / currentImage.height;
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

      // --- Step 3: Legend ---
      const usedPinTypes = Array.from(new Set(currentPins.map(p => p.pinType))) as PinType[];
      const legendPinTypes = usedPinTypes.length > 0 ? usedPinTypes : Object.keys(PIN_COLORS) as PinType[];

      const legendTop = imgTop + imgH + 5;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Légende', margin, legendTop + 4);

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

      // --- Step 4: Pin list table ---
      let tY = legendStartY + Math.ceil(legendPinTypes.length / maxCols) * legendRowHeight + 4;
      if (currentPins.length > 0) {
        // Check if we need a new page
        if (tY + 10 > pageH - margin) {
          pdf.addPage();
          tY = margin + 6;
        }

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Liste des repères (${currentPins.length})`, margin, tY);
        tY += 4;

        // Table header
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, tY, availW, 5, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(60, 60, 60);
        pdf.text('Type', margin + 2, tY + 3.5);
        pdf.text('Libellé', margin + 30, tY + 3.5);
        pdf.text('Description', margin + 80, tY + 3.5);
        tY += 5;

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(30, 30, 30);

        currentPins.forEach((pin, index) => {
          if (tY + 5 > pageH - margin) {
            pdf.addPage();
            tY = margin + 6;
          }

          // Alternating row color
          if (index % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(margin, tY, availW, 5, 'F');
          }

          // Build description — enrich NRO pins with provider info
          let pinDesc = pin.description || '';
          if (pin.pinType === 'NRO' && !pinDesc) {
            const site = (currentFloorPlan as any).site;
            const provider = site?.connectivity?.primary?.provider;
            if (provider) pinDesc = `Fournisseur: ${provider}`;
          }
          // For RACK pins, show associated rack name
          if (pin.pinType === 'RACK' && pin.rack && !pinDesc) {
            pinDesc = `Baie: ${pin.rack.name} (${pin.rack.heightU}U)`;
          }

          pdf.setFontSize(7);
          pdf.text(PIN_TYPE_NAMES[pin.pinType] || pin.pinType, margin + 2, tY + 3.5);
          pdf.text(pin.label || '—', margin + 30, tY + 3.5);
          pdf.text((pinDesc || '—').substring(0, 60), margin + 80, tY + 3.5);
          tY += 5;
        });
      }

      // --- Step 5: Racks section with mounted equipment ---
      const rackPins = currentPins.filter(p => p.pinType === 'RACK' && p.rack);
      if (rackPins.length > 0) {
        // Check if we need a new page
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

        rackPins.forEach((pin) => {
          const rack = pin.rack!;
          const assets = (rack as any).assets || [];

          // Check if we need a new page (rack header + at least a few lines)
          if (tY + 15 > pageH - margin) {
            pdf.addPage();
            tY = margin + 6;
          }

          // Rack header
          pdf.setFillColor(139, 92, 246); // purple
          pdf.setTextColor(255, 255, 255);
          pdf.rect(margin, tY, availW, 6, 'F');
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${rack.name} — ${rack.heightU}U`, margin + 2, tY + 4);
          if (pin.label) {
            pdf.text(`(${pin.label})`, margin + 60, tY + 4);
          }
          tY += 6;

          if (assets.length === 0) {
            pdf.setTextColor(120, 120, 120);
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(7);
            pdf.text('Aucun équipement monté', margin + 4, tY + 3.5);
            tY += 5;
          } else {
            // Equipment sub-header
            pdf.setFillColor(245, 243, 255);
            pdf.rect(margin, tY, availW, 5, 'F');
            pdf.setTextColor(80, 80, 80);
            pdf.setFontSize(6.5);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Position', margin + 2, tY + 3.5);
            pdf.text('Équipement', margin + 22, tY + 3.5);
            pdf.text('Type', margin + 80, tY + 3.5);
            pdf.text('S/N', margin + 110, tY + 3.5);
            tY += 5;

            // Sort assets by rackPosition
            const sortedAssets = [...assets].sort((a: any, b: any) => {
              const posA = a.rackPosition || 0;
              const posB = b.rackPosition || 0;
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

              const pos = asset.rackPosition ? `U${asset.rackPosition}` : '—';
              const assetName = asset.name || asset.model || '—';
              const assetMfr = asset.manufacturer ? `${asset.manufacturer} ` : '';
              const assetLabel = `${assetMfr}${assetName}`.substring(0, 40);
              const assetType = asset.type || '—';
              const assetSN = (asset.serialNumber || '—').substring(0, 20);

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

      // --- Step 6: NRO / Connectivity info ---
      const nroPins = currentPins.filter(p => p.pinType === 'NRO');
      const site = (currentFloorPlan as any).site;
      if (nroPins.length > 0 && site?.connectivity) {
        if (tY + 20 > pageH - margin) {
          pdf.addPage();
          tY = margin + 6;
        } else {
          tY += 4;
        }

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('Connectivité NRO', margin, tY);
        tY += 5;

        const conn = site.connectivity;

        // Primary provider
        if (conn.primary) {
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(168, 85, 247); // purple
          pdf.text('Fournisseur principal', margin + 2, tY + 3.5);
          tY += 5;

          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(30, 30, 30);
          pdf.setFontSize(7);
          if (conn.primary.provider) {
            pdf.text(`Fournisseur: ${conn.primary.provider}`, margin + 4, tY + 3.5);
            tY += 4;
          }
          if (conn.primary.type) {
            pdf.text(`Type: ${conn.primary.type}`, margin + 4, tY + 3.5);
            tY += 4;
          }
          if (conn.primary.refClient) {
            pdf.text(`Réf. client: ${conn.primary.refClient}`, margin + 4, tY + 3.5);
            tY += 4;
          }
          if (conn.primary.bandwidth) {
            pdf.text(`Débit: ${conn.primary.bandwidth}`, margin + 4, tY + 3.5);
            tY += 4;
          }
        }

        // Backup provider
        if (conn.backup?.provider) {
          tY += 2;
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(168, 85, 247);
          pdf.text('Fournisseur backup', margin + 2, tY + 3.5);
          tY += 5;

          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(30, 30, 30);
          pdf.setFontSize(7);
          if (conn.backup.provider) {
            pdf.text(`Fournisseur: ${conn.backup.provider}`, margin + 4, tY + 3.5);
            tY += 4;
          }
          if (conn.backup.type) {
            pdf.text(`Type: ${conn.backup.type}`, margin + 4, tY + 3.5);
            tY += 4;
          }
        }
      }

      // --- WiFi Heatmap page: 4 quadrants (2.4 GHz, 5 GHz, 6 GHz, All) ---
      if (heatmapQuadrants.length > 0) {
        pdf.addPage(isLandscape ? 'landscape' : 'portrait');
        const p2Y = margin;

        // Title
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('Couverture Wi-Fi — Comparatif par bande', margin, p2Y + 6);

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(150, 150, 150);
        pdf.text(`${planName} — Estimation indicative en espace libre`, margin, p2Y + 11);
        pdf.setTextColor(0, 0, 0);

        // 4 quadrants: 2x2 grid
        const gridTop = p2Y + 15;
        const gridGap = 3;
        const labelH = 5; // height for band label above each quadrant
        const cellW = (availW - gridGap) / 2;
        const gridAvailH = pageH - gridTop - margin - 16; // reserve 16mm for legend
        const cellH = (gridAvailH - gridGap - labelH * 2) / 2;

        const positions = [
          { col: 0, row: 0 }, // top-left: 2.4 GHz
          { col: 1, row: 0 }, // top-right: 5 GHz
          { col: 0, row: 1 }, // bottom-left: 6 GHz
          { col: 1, row: 1 }, // bottom-right: All
        ];

        heatmapQuadrants.forEach((quad, i) => {
          if (i >= 4) return;
          const pos = positions[i];
          const qx = margin + pos.col * (cellW + gridGap);
          const qy = gridTop + pos.row * (cellH + gridGap + labelH);

          // Band label
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(50, 50, 50);
          pdf.text(quad.label, qx + cellW / 2, qy + 3.5, { align: 'center' });

          // Image within quadrant (fit proportionally)
          const imgAreaY = qy + labelH;
          const qImgRatio = currentImage.width / currentImage.height;
          let qImgW = cellW;
          let qImgH = qImgW / qImgRatio;
          if (qImgH > cellH) {
            qImgH = cellH;
            qImgW = qImgH * qImgRatio;
          }
          const qImgX = qx + (cellW - qImgW) / 2;
          const qImgY = imgAreaY + (cellH - qImgH) / 2;

          pdf.addImage(quad.dataUrl, 'PNG', qImgX, qImgY, qImgW, qImgH);
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.2);
          pdf.rect(qImgX, qImgY, qImgW, qImgH);
        });

        // Signal legend at bottom
        const sigLegY = gridTop + 2 * (cellH + gridGap + labelH) + 2;
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('Légende signal', margin, sigLegY + 3);

        const sigItems = [
          { color: [16, 185, 129], label: 'Excellent', range: '> -50 dBm' },
          { color: [234, 179, 8], label: 'Bon', range: '-50 à -65 dBm' },
          { color: [249, 115, 22], label: 'Acceptable', range: '-65 à -80 dBm' },
          { color: [239, 68, 68], label: 'Faible', range: '< -80 dBm' },
        ];
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        sigItems.forEach((item, i) => {
          const sx = margin + i * 45;
          const sy = sigLegY + 6;
          pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
          pdf.circle(sx + 2, sy + 1.5, 1.5, 'F');
          pdf.setTextColor(50, 50, 50);
          pdf.text(`${item.label} (${item.range})`, sx + 5, sy + 2.5);
        });
      }

      // Save PDF
      pdf.save(`${planName}-v${planVersion}-plan.pdf`);
    };

    onExportReady(exportFn);
   
  }, [onExportReady]); // Only re-run when callback identity changes - data is read from refs

  // Responsive stage sizing via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const width = container.clientWidth;
      if (width > 0) setContainerWidth(width);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Calculate responsive stage dimensions
  const { stageWidth, stageHeight } = useMemo(() => {
    const maxWidth = containerWidth || 1200;

    if (!image) {
      return { stageWidth: maxWidth, stageHeight: Math.min(maxWidth * 0.67, 800) };
    }

    const imageRatio = image.width / image.height;
    const w = maxWidth;
    const h = w / imageRatio;

    return { stageWidth: w, stageHeight: h };
  }, [containerWidth, image]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const limitedScale = Math.max(0.5, Math.min(5, newScale));

    setScale(limitedScale);
    setPosition({
      x: pointer.x - mousePointTo.x * limitedScale,
      y: pointer.y - mousePointTo.y * limitedScale,
    });
  };

  // Zoom helper functions for buttons
  const handleZoomIn = useCallback(() => {
    const oldScale = scale;
    const newScale = Math.min(5, oldScale * 1.3);
    const centerX = stageWidth / 2;
    const centerY = stageHeight / 2;
    const mousePointTo = { x: (centerX - position.x) / oldScale, y: (centerY - position.y) / oldScale };
    setScale(newScale);
    setPosition({ x: centerX - mousePointTo.x * newScale, y: centerY - mousePointTo.y * newScale });
  }, [scale, position, stageWidth, stageHeight]);

  const handleZoomOut = useCallback(() => {
    const oldScale = scale;
    const newScale = Math.max(0.3, oldScale / 1.3);
    const centerX = stageWidth / 2;
    const centerY = stageHeight / 2;
    const mousePointTo = { x: (centerX - position.x) / oldScale, y: (centerY - position.y) / oldScale };
    setScale(newScale);
    setPosition({ x: centerX - mousePointTo.x * newScale, y: centerY - mousePointTo.y * newScale });
  }, [scale, position, stageWidth, stageHeight]);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Manual panning via refs to avoid re-render loops (React error #185)
  // We update the Konva stage position directly during drag, only sync to React state on dragEnd
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const hasPannedRef = useRef(false);

  const handleMouseDown = useCallback((e: any) => {
    const target = e.target;
    const isStage = target === target.getStage();
    const isImage = target.getClassName() === 'Image';
    if (!isStage && !isImage) return;

    const stage = target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    isPanningRef.current = true;
    hasPannedRef.current = false;
    panStartRef.current = { x: pointer.x, y: pointer.y };
    positionStartRef.current = { x: stage.x(), y: stage.y() };

    const container = stage.container();
    container.style.cursor = 'grabbing';
  }, []);

  const handleMouseMove = useCallback((e: any) => {
    if (!isPanningRef.current) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const dx = pointer.x - panStartRef.current.x;
    const dy = pointer.y - panStartRef.current.y;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      hasPannedRef.current = true;
    }

    // Update Konva stage directly (no React state update = no re-render loop)
    stage.x(positionStartRef.current.x + dx);
    stage.y(positionStartRef.current.y + dy);
    stage.batchDraw();
  }, []);

  const handleMouseUp = useCallback((e: any) => {
    if (isPanningRef.current) {
      const stage = e.target.getStage();
      if (stage) {
        const container = stage.container();
        container.style.cursor = 'grab';
        // Sync final position to React state (single update, no loop)
        setPosition({ x: stage.x(), y: stage.y() });
      }
    }
    isPanningRef.current = false;
  }, []);

  // Pinch-to-zoom support
  const lastTouchDistRef = useRef(0);
  const lastTouchCenterRef = useRef({ x: 0, y: 0 });
  const isPinchingRef = useRef(false);

  const getDistance = useCallback((p1: Touch, p2: Touch) => {
    return Math.sqrt(Math.pow(p2.clientX - p1.clientX, 2) + Math.pow(p2.clientY - p1.clientY, 2));
  }, []);

  const getCenter = useCallback((p1: Touch, p2: Touch) => {
    return { x: (p1.clientX + p2.clientX) / 2, y: (p1.clientY + p2.clientY) / 2 };
  }, []);

  const handleTouchStart = useCallback((e: any) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      e.evt.preventDefault();
      isPinchingRef.current = true;
      isPanningRef.current = false;
      lastTouchDistRef.current = getDistance(touches[0], touches[1]);
      lastTouchCenterRef.current = getCenter(touches[0], touches[1]);
      return;
    }
    isPinchingRef.current = false;
    handleMouseDown(e);
  }, [handleMouseDown, getDistance, getCenter]);

  const handleTouchMove = useCallback((e: any) => {
    const touches = e.evt.touches;
    if (touches.length === 2 && isPinchingRef.current) {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const newDist = getDistance(touches[0], touches[1]);
      const newCenter = getCenter(touches[0], touches[1]);

      if (lastTouchDistRef.current === 0) {
        lastTouchDistRef.current = newDist;
        lastTouchCenterRef.current = newCenter;
        return;
      }

      const ratio = newDist / lastTouchDistRef.current;
      const oldScale = stage.scaleX();
      const newScale = Math.max(0.3, Math.min(5, oldScale * ratio));

      const rect = stage.container().getBoundingClientRect();
      const centerX = newCenter.x - rect.left;
      const centerY = newCenter.y - rect.top;

      const mousePointTo = {
        x: (centerX - stage.x()) / oldScale,
        y: (centerY - stage.y()) / oldScale,
      };

      stage.scaleX(newScale);
      stage.scaleY(newScale);
      stage.x(centerX - mousePointTo.x * newScale);
      stage.y(centerY - mousePointTo.y * newScale);
      stage.batchDraw();

      lastTouchDistRef.current = newDist;
      lastTouchCenterRef.current = newCenter;
      return;
    }
    if (!isPinchingRef.current) {
      handleMouseMove(e);
    }
  }, [handleMouseMove, getDistance, getCenter]);

  const handleTouchEnd = useCallback((e: any) => {
    if (isPinchingRef.current) {
      const stage = stageRef.current;
      if (stage) {
        setScale(stage.scaleX());
        setPosition({ x: stage.x(), y: stage.y() });
      }
      isPinchingRef.current = false;
      lastTouchDistRef.current = 0;
      return;
    }
    handleMouseUp(e);
  }, [handleMouseUp]);

  const handleStageClick = (e: any) => {
    // Ignore click if we were panning
    if (hasPannedRef.current) return;

    if (e.target === e.target.getStage() || e.target.getClassName() === 'Image') {
      if (onStageClick && editable && image) {
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
        // Read position from stage directly (may differ from React state during panning)
        const stageX = stage.x();
        const stageY = stage.y();
        const currentScale = stage.scaleX();
        const x = (pointerPosition.x - stageX) / currentScale;
        const y = (pointerPosition.y - stageY) / currentScale;

        const normalizedX = x / image.width;
        const normalizedY = y / image.height;

        onStageClick(normalizedX, normalizedY);
      }
    }
  };

  // Set initial cursor and touch-action style on stage container
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      const container = stage.container();
      container.style.cursor = editable ? 'crosshair' : 'grab';
      container.style.touchAction = 'none'; // Prevent browser default touch (scroll/zoom)
    }
  }, [image, editable]);

  return (
    <div ref={containerRef} className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 relative">
      {/* Zoom Controls — floating buttons */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 rounded-lg bg-white/90 dark:bg-gray-800/90 border shadow-sm hover:bg-white dark:hover:bg-gray-700 flex items-center justify-center text-lg font-bold transition-colors"
          title="Zoom avant"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 rounded-lg bg-white/90 dark:bg-gray-800/90 border shadow-sm hover:bg-white dark:hover:bg-gray-700 flex items-center justify-center text-lg font-bold transition-colors"
          title="Zoom arrière"
        >
          −
        </button>
        <button
          onClick={handleResetZoom}
          className="w-10 h-10 rounded-lg bg-white/90 dark:bg-gray-800/90 border shadow-sm hover:bg-white dark:hover:bg-gray-700 flex items-center justify-center text-xs font-medium transition-colors"
          title="Réinitialiser le zoom"
        >
          1:1
        </button>
      </div>

      {/* Zoom percentage indicator */}
      {scale !== 1 && (
        <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded bg-black/60 text-white text-xs font-mono">
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* Edit mode indicator */}
      {editable && (
        <div className="absolute bottom-16 left-3 z-10 px-2 py-1 rounded bg-blue-600/90 text-white text-xs font-medium">
          Mode édition — Cliquez pour ajouter un repère
        </div>
      )}

      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background layer */}
        <Layer>
          {image && <KonvaImage image={image} />}
        </Layer>

        {/* Heatmap layer (between background and pins) */}
        {image && heatmapConfig?.enabled && heatmapAccessPoints && heatmapAccessPoints.length > 0 && (
          <Layer listening={false}>
            <WifiHeatmapLayer
              accessPoints={heatmapAccessPoints}
              config={heatmapConfig}
              scaleMetersPerPixel={scaleMetersPerPixel || null}
              imageWidth={image.width}
              imageHeight={image.height}
              updateTrigger={heatmapTrigger}
            />
          </Layer>
        )}

        {/* Calibration layer (reference line, picked points, metric grid) */}
        {image && (calibrationMode || scaleRefLine || showCalibrationGrid) && (
          <Layer listening={false}>
            {/* Metric grid */}
            {showCalibrationGrid && scaleMetersPerPixel && scaleMetersPerPixel > 0 && (() => {
              const gridSpacingMeters = scaleMetersPerPixel > 50 ? 10 : scaleMetersPerPixel > 20 ? 5 : 2;
              const gridSpacingPx = (gridSpacingMeters / scaleMetersPerPixel) * image.width;
              const gridLines: React.ReactElement[] = [];
              for (let x = gridSpacingPx; x < image.width; x += gridSpacingPx) {
                gridLines.push(
                  <Line key={`gv-${x}`} points={[x, 0, x, image.height]} stroke="rgba(150,150,150,0.3)" strokeWidth={1} dash={[4, 4]} />,
                  <Text key={`gvt-${x}`} x={x + 2} y={4} text={`${Math.round(x / gridSpacingPx * gridSpacingMeters)}m`} fontSize={10} fill="rgba(150,150,150,0.6)" />
                );
              }
              for (let y = gridSpacingPx; y < image.height; y += gridSpacingPx) {
                gridLines.push(
                  <Line key={`gh-${y}`} points={[0, y, image.width, y]} stroke="rgba(150,150,150,0.3)" strokeWidth={1} dash={[4, 4]} />,
                  <Text key={`ght-${y}`} x={4} y={y + 2} text={`${Math.round(y / gridSpacingPx * gridSpacingMeters)}m`} fontSize={10} fill="rgba(150,150,150,0.6)" />
                );
              }
              return gridLines;
            })()}

            {/* Calibration picked points (red circles) */}
            {calibrationMode && calibrationPoints && calibrationPoints.map((pt, i) => (
              <React.Fragment key={`cal-pt-${i}`}>
                <Circle x={pt.x * image.width} y={pt.y * image.height} radius={8} fill="rgba(239,68,68,0.8)" stroke="#fff" strokeWidth={2} />
                <Text x={pt.x * image.width + 12} y={pt.y * image.height - 8} text={i === 0 ? 'A' : 'B'} fontSize={14} fontStyle="bold" fill="#ef4444" />
              </React.Fragment>
            ))}

            {/* Calibration line between picked points */}
            {calibrationMode && calibrationPoints && calibrationPoints.length === 2 && (
              <Line
                points={[
                  calibrationPoints[0].x * image.width, calibrationPoints[0].y * image.height,
                  calibrationPoints[1].x * image.width, calibrationPoints[1].y * image.height,
                ]}
                stroke="#ef4444" strokeWidth={2} dash={[8, 4]}
              />
            )}

            {/* Saved reference line (subtle gray) */}
            {!calibrationMode && scaleRefLine && (
              <>
                <Line
                  points={[
                    scaleRefLine.x1 * image.width, scaleRefLine.y1 * image.height,
                    scaleRefLine.x2 * image.width, scaleRefLine.y2 * image.height,
                  ]}
                  stroke="rgba(150,150,150,0.5)" strokeWidth={1.5} dash={[6, 3]}
                />
                <Text
                  x={(scaleRefLine.x1 + scaleRefLine.x2) / 2 * image.width + 5}
                  y={(scaleRefLine.y1 + scaleRefLine.y2) / 2 * image.height - 12}
                  text={`${scaleRefLine.meters}m`}
                  fontSize={11} fill="rgba(120,120,120,0.7)" fontStyle="italic"
                />
              </>
            )}
          </Layer>
        )}

        {/* Pins layer */}
        <Layer>
          {image && visiblePins.map((pin) => (
            <PinMarker
              key={pin.id}
              pin={pin}
              imageWidth={image.width}
              imageHeight={image.height}
              onClick={() => onPinClick?.(pin)}
              onDragEnd={(x, y) => {
                onPinDragEnd?.(pin.id, x, y);
                // Trigger heatmap re-render after AP drag
                if (pin.pinType === 'WIFI_AP') {
                  setHeatmapTrigger(t => t + 1);
                }
              }}
              draggable={editable}
            />
          ))}
        </Layer>
      </Stage>

      {/* HTML Legend (visible in viewer) */}
      <div className="p-3 bg-white dark:bg-gray-900 border-t flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <LegendItem pinType="SWITCH" />
          <LegendItem pinType="FIREWALL" />
          <LegendItem pinType="WIFI_AP" />
          <LegendItem pinType="RACK" />
          <LegendItem pinType="CAMERA" />
          <LegendItem pinType="PATCH_PANEL" />
          <LegendItem pinType="RJ45" />
          <LegendItem pinType="NRO" />
          <LegendItem pinType="PRINTER" />
          <LegendItem pinType="OTHER" />
        </div>
        <div className="text-sm text-muted-foreground whitespace-nowrap ml-2">
          Zoom: {Math.round(scale * 100)}% | Pins: {pins.length}
        </div>
      </div>
    </div>
  );
}

/**
 * HTML Legend item with shape indicator and sigle
 */
function LegendItem({ pinType }: { pinType: PinType }) {
  const color = PIN_COLORS[pinType];
  const sigle = PIN_LABELS[pinType];
  const name = PIN_TYPE_NAMES[pinType];

  // Shape CSS classes
  const shapeStyle = getLegendShapeStyle(pinType, color);

  return (
    <div className="flex items-center gap-1">
      <div
        className={shapeStyle.className}
        style={shapeStyle.style}
        title={name}
      >
        <span className="text-[7px] font-bold text-white font-mono leading-none">
          {sigle}
        </span>
      </div>
      <span className="text-gray-900 dark:text-gray-100">{name}</span>
    </div>
  );
}

function getLegendShapeStyle(pinType: PinType, color: string): { className: string; style: React.CSSProperties } {
  const base: React.CSSProperties = {
    backgroundColor: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(0,0,0,0.2)',
  };

  switch (pinType) {
    case 'SWITCH':
      return {
        className: 'w-5 h-4 rounded-sm',
        style: base,
      };
    case 'FIREWALL':
      return {
        className: 'w-5 h-5',
        style: { ...base, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' },
      };
    case 'WIFI_AP':
      return {
        className: 'w-5 h-5',
        style: { ...base, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
      };
    case 'PRINTER':
      return {
        className: 'w-5 h-5 rounded-[2px]',
        style: base,
      };
    case 'RACK':
      return {
        className: 'w-4 h-5 rounded-[2px]',
        style: base,
      };
    case 'CAMERA':
      return {
        className: 'w-5 h-5',
        style: { ...base, clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' },
      };
    case 'PATCH_PANEL':
      return {
        className: 'w-6 h-4 rounded-[2px]',
        style: base,
      };
    case 'RJ45':
      return {
        className: 'w-5 h-5 rounded-[3px]',
        style: base,
      };
    case 'NRO':
      return {
        className: 'w-5 h-5',
        style: { ...base, clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' },
      };
    case 'ROUTER':
      return {
        className: 'w-5 h-4 rounded-[5px]',
        style: base,
      };
    case 'TEAMS_ROOM':
      return {
        className: 'w-5 h-4 rounded-[5px]',
        style: base,
      };
    case 'WEBCAM':
      return {
        className: 'w-5 h-5 rounded-full',
        style: base,
      };
    case 'DISPLAY':
      return {
        className: 'w-6 h-4 rounded-[3px]',
        style: base,
      };
    case 'SERVER':
      return {
        className: 'w-4 h-5 rounded-[2px]',
        style: base,
      };
    case 'PDU':
      return {
        className: 'w-3 h-5 rounded-[2px]',
        style: base,
      };
    case 'BOX_5G':
      return {
        className: 'w-5 h-4 rounded-[5px]',
        style: base,
      };
    case 'OTHER':
    default:
      return {
        className: 'w-5 h-5 rounded-full',
        style: base,
      };
  }
}
