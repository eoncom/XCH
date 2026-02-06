'use client';

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group, Rect, Line, RegularPolygon, Shape } from 'react-konva';
import type Konva from 'konva';
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

/**
 * Renders the legend inside Konva canvas (for export to PNG)
 */
function KonvaLegend({ x, y, pinTypes }: { x: number; y: number; pinTypes: PinType[] }) {
  const itemWidth = 120;
  const itemHeight = 28;
  const padding = 12;
  const cols = Math.min(pinTypes.length, 5);
  const rows = Math.ceil(pinTypes.length / cols);
  const legendWidth = cols * itemWidth + padding * 2;
  const legendHeight = rows * itemHeight + padding * 2 + 24; // +24 for title

  return (
    <Group x={x} y={y}>
      {/* Background */}
      <Rect
        width={legendWidth}
        height={legendHeight}
        fill="#ffffff"
        stroke="#e5e7eb"
        strokeWidth={1}
        cornerRadius={6}
        shadowBlur={4}
        shadowOpacity={0.1}
        shadowColor="#000000"
      />

      {/* Title */}
      <Text
        text="Legende"
        x={padding}
        y={padding}
        fontSize={13}
        fill="#374151"
        fontStyle="bold"
      />

      {/* Legend items */}
      {pinTypes.map((pinType, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const ix = padding + col * itemWidth;
        const iy = padding + 22 + row * itemHeight;

        return (
          <Group key={pinType} x={ix} y={iy}>
            {/* Mini shape */}
            <Group x={10} y={10} scaleX={0.7} scaleY={0.7}>
              <PinShape pinType={pinType} color={PIN_COLORS[pinType]} />
              <Text
                text={PIN_LABELS[pinType]}
                x={-10}
                y={-6}
                width={20}
                align="center"
                fontSize={8}
                fill="#ffffff"
                fontStyle="bold"
                fontFamily="monospace"
              />
            </Group>

            {/* Type name */}
            <Text
              text={PIN_TYPE_NAMES[pinType]}
              x={24}
              y={4}
              fontSize={11}
              fill="#374151"
            />
          </Group>
        );
      })}
    </Group>
  );
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
  const [showLegendForExport, setShowLegendForExport] = useState(false);

  // Get unique pin types used in this plan
  const usedPinTypes = Array.from(new Set(pins.map(p => p.pinType))) as PinType[];

  // Expose export function to parent
  useEffect(() => {
    if (onExportReady && stageRef.current) {
      const exportFn = () => {
        const stage = stageRef.current;
        if (!stage || !image) return;

        // Reset view for export (no zoom/pan)
        const oldScale = stage.scaleX();
        const oldX = stage.x();
        const oldY = stage.y();

        // Calculate legend dimensions
        const legendPinTypes = usedPinTypes.length > 0 ? usedPinTypes : Object.keys(PIN_COLORS) as PinType[];
        const cols = Math.min(legendPinTypes.length, 5);
        const rows = Math.ceil(legendPinTypes.length / cols);
        const legendHeight = rows * 28 + 12 * 2 + 24 + 20; // padding + title + margin

        // Set stage to full image size + legend
        const exportWidth = image.width;
        const exportHeight = image.height + legendHeight;

        stage.scaleX(1);
        stage.scaleY(1);
        stage.x(0);
        stage.y(0);
        stage.width(exportWidth);
        stage.height(exportHeight);

        // Show legend
        setShowLegendForExport(true);

        // Wait for render then export
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const dataURL = stage.toDataURL({
              pixelRatio: 2,
              width: exportWidth,
              height: exportHeight,
            });

            // Download
            const link = document.createElement('a');
            link.download = `${floorPlan.name || 'floor-plan'}-avec-pins.png`;
            link.href = dataURL;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Restore view
            setShowLegendForExport(false);
            stage.scaleX(oldScale);
            stage.scaleY(oldScale);
            stage.x(oldX);
            stage.y(oldY);
            stage.width(stageWidth);
            stage.height(stageHeight);
          });
        });
      };
      onExportReady(exportFn);
    }
  }, [onExportReady, floorPlan.name, image, usedPinTypes]);

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

  const handleStageClick = (e: any) => {
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

  // Legend for export: calculate position
  const legendY = image ? image.height + 10 : stageHeight + 10;
  const legendPinTypes = usedPinTypes.length > 0 ? usedPinTypes : Object.keys(PIN_COLORS) as PinType[];

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
        draggable={true}
        onWheel={handleWheel}
        onClick={handleStageClick}
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

          {/* Legend rendered inside Konva for export */}
          {showLegendForExport && (
            <KonvaLegend
              x={10}
              y={legendY}
              pinTypes={legendPinTypes}
            />
          )}
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
