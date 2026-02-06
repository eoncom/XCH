'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group, Rect, Line, RegularPolygon } from 'react-konva';
import type { FloorPlan, Pin, PinType } from '@/types';

// Custom hook to load image
function useImage(url: string): [HTMLImageElement | undefined, 'loading' | 'loaded' | 'failed'] {
  const [image, setImage] = useState<HTMLImageElement>();
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

  useEffect(() => {
    if (!url) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      setImage(img);
      setStatus('loaded');
    };

    img.onerror = () => {
      setStatus('failed');
    };

    img.src = url;

    return () => {
      img.onload = null;
      img.onerror = null;
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
}

const PIN_COLORS: Record<PinType, string> = {
  SWITCH: '#3b82f6',       // blue
  FIREWALL: '#ef4444',     // red
  ACCESS_POINT: '#10b981', // green
  PRINTER: '#6366f1',      // indigo
  RACK: '#8b5cf6',         // purple
  CAMERA: '#f59e0b',       // amber (orange)
  PATCH_PANEL: '#06b6d4',  // cyan
  RJ45: '#14b8a6',         // teal
  NRO: '#a855f7',          // purple-light
  OTHER: '#6b7280',        // gray
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
  OTHER: '?',
};

const PIN_TYPE_NAMES: Record<PinType, string> = {
  SWITCH: 'Switch',
  FIREWALL: 'Firewall',
  ACCESS_POINT: 'Point d\'accès',
  PRINTER: 'Imprimante',
  RACK: 'Baie',
  CAMERA: 'Caméra',
  PATCH_PANEL: 'Panneau brassage',
  RJ45: 'Prise RJ45',
  NRO: 'NRO',
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
    case 'ACCESS_POINT': // diamond
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
    case 'ACCESS_POINT':
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
}: FloorPlanViewerProps) {
  const [image, imageStatus] = useImage(floorPlan.fileUrl || '');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const stageRef = useRef<any>(null);

  // Get unique pin types used in this plan
  const usedPinTypes = Array.from(new Set(pins.map(p => p.pinType))) as PinType[];

  // Expose export function to parent (uses offscreen canvas to avoid UI freeze)
  useEffect(() => {
    if (onExportReady) {
      const exportFn = () => {
        if (!image) return;

        // Calculate legend dimensions
        const legendPinTypes = usedPinTypes.length > 0 ? usedPinTypes : Object.keys(PIN_COLORS) as PinType[];
        const cols = Math.min(legendPinTypes.length, 5);
        const rows = Math.ceil(legendPinTypes.length / cols);
        const itemWidth = 140;
        const itemHeight = 28;
        const padding = 14;
        const legendWidth = cols * itemWidth + padding * 2;
        const legendHeight = rows * itemHeight + padding * 2 + 24;

        // Build offscreen canvas with image + pins + legend
        const exportWidth = Math.max(image.width, legendWidth + 20);
        const exportHeight = image.height + legendHeight + 20;
        const canvas = document.createElement('canvas');
        canvas.width = exportWidth * 2; // 2x for retina
        canvas.height = exportHeight * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(2, 2);

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, exportWidth, exportHeight);

        // Draw image
        ctx.drawImage(image, 0, 0);

        // Draw pins
        pins.forEach(pin => {
          const px = pin.x * image.width;
          const py = pin.y * image.height;
          const color = PIN_COLORS[pin.pinType] || PIN_COLORS.OTHER;
          const sigle = PIN_LABELS[pin.pinType] || '?';

          ctx.save();
          ctx.translate(px, py);

          // Shadow
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(1, 1, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;

          // Draw shape
          drawPinShapeCanvas(ctx, pin.pinType, color);

          // Sigle
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sigle, 0, 0);

          // Label below
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

        // Draw legend
        const legendX = 10;
        const legendY = image.height + 10;

        // Legend background
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        roundRect(ctx, legendX, legendY, legendWidth, legendHeight, 6);
        ctx.fill();
        ctx.stroke();

        // Legend title
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Légende', legendX + padding, legendY + padding);

        // Legend items
        legendPinTypes.forEach((pinType, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const ix = legendX + padding + col * itemWidth;
          const iy = legendY + padding + 22 + row * itemHeight;

          // Mini shape
          ctx.save();
          ctx.translate(ix + 10, iy + 10);
          ctx.scale(0.65, 0.65);
          drawPinShapeCanvas(ctx, pinType, PIN_COLORS[pinType]);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(PIN_LABELS[pinType], 0, 0);
          ctx.restore();

          // Type name
          ctx.fillStyle = '#374151';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(PIN_TYPE_NAMES[pinType], ix + 24, iy + 4);
        });

        // Convert to blob and download (non-blocking)
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `${floorPlan.name || floorPlan.title || 'floor-plan'}-avec-pins.png`;
          link.href = url;
          link.click();
          // Cleanup after a delay
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }, 'image/png');
      };
      onExportReady(exportFn);
    }
  }, [onExportReady, floorPlan.name, floorPlan.title, image, pins, usedPinTypes]);

  // Use full container width
  let stageWidth = 1200;
  let stageHeight = 800;

  if (image) {
    const imageRatio = image.width / image.height;

    if (imageRatio > 1.5) {
      stageWidth = 1200;
      stageHeight = 1200 / imageRatio;
    } else {
      stageHeight = 800;
      stageWidth = 800 * imageRatio;
    }
  }

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

  // Manual panning state (avoids Konva draggable={true} which breaks Next.js navigation)
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const hasPannedRef = useRef(false);

  const handleMouseDown = useCallback((e: any) => {
    // Only start pan if clicking on stage background or image (not on pins)
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
    positionStartRef.current = { x: position.x, y: position.y };

    // Set cursor
    const container = stage.container();
    container.style.cursor = 'grabbing';
  }, [position.x, position.y]);

  const handleMouseMove = useCallback((e: any) => {
    if (!isPanningRef.current) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const dx = pointer.x - panStartRef.current.x;
    const dy = pointer.y - panStartRef.current.y;

    // If moved more than 3px, consider it a pan (not a click)
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasPannedRef.current = true;
    }

    setPosition({
      x: positionStartRef.current.x + dx,
      y: positionStartRef.current.y + dy,
    });
  }, []);

  const handleMouseUp = useCallback((e: any) => {
    if (isPanningRef.current) {
      const stage = e.target.getStage();
      if (stage) {
        const container = stage.container();
        container.style.cursor = 'grab';
      }
    }
    isPanningRef.current = false;
  }, []);

  const handleStageClick = (e: any) => {
    // Ignore click if we were panning
    if (hasPannedRef.current) return;

    if (e.target === e.target.getStage() || e.target.getClassName() === 'Image') {
      if (onStageClick && editable && image) {
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
        const x = (pointerPosition.x - position.x) / scale;
        const y = (pointerPosition.y - position.y) / scale;

        const normalizedX = x / image.width;
        const normalizedY = y / image.height;

        onStageClick(normalizedX, normalizedY);
      }
    }
  };

  // Set initial cursor style on stage container
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      const container = stage.container();
      container.style.cursor = 'grab';
    }
  }, [image]);

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <Layer>
          {image && <KonvaImage image={image} />}

          {image && pins.map((pin) => (
            <PinMarker
              key={pin.id}
              pin={pin}
              imageWidth={image.width}
              imageHeight={image.height}
              onClick={() => onPinClick?.(pin)}
              onDragEnd={(x, y) => onPinDragEnd?.(pin.id, x, y)}
              draggable={editable}
            />
          ))}
        </Layer>
      </Stage>

      {/* HTML Legend (visible in viewer) */}
      <div className="p-3 bg-white dark:bg-gray-900 border-t flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {/* Show legend items with shapes */}
          <LegendItem pinType="SWITCH" />
          <LegendItem pinType="FIREWALL" />
          <LegendItem pinType="ACCESS_POINT" />
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
    case 'ACCESS_POINT':
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
    case 'OTHER':
    default:
      return {
        className: 'w-5 h-5 rounded-full',
        style: base,
      };
  }
}
