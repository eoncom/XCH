'use client';

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group } from 'react-konva';
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

function PinMarker({ pin, onClick, onDragEnd, draggable = false, imageWidth, imageHeight }: PinMarkerInternalProps) {
  // Denormalize coordinates (0-1 range to actual pixels)
  const pixelX = pin.x * imageWidth;
  const pixelY = pin.y * imageHeight;

  const handleDragEnd = (e: any) => {
    if (onDragEnd) {
      const newX = e.target.x();
      const newY = e.target.y();
      // Normalize coordinates back to 0-1 range
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
      onDragMove={() => {}} // Suppress Konva warning
      onDragEnd={handleDragEnd}
    >
      {/* Outer circle (dark border for visibility on white backgrounds) */}
      <Circle
        radius={14}
        fill="#000000"
        opacity={0.3}
      />
      {/* Inner colored circle */}
      <Circle
        radius={12}
        fill={PIN_COLORS[pin.pinType] || PIN_COLORS.OTHER}
        stroke="#000000"
        strokeWidth={2}
        shadowBlur={6}
        shadowOpacity={0.4}
      />
      {/* Label */}
      {pin.label && (
        <Text
          text={pin.label}
          x={-50}
          y={-30}
          width={100}
          align="center"
          fontSize={12}
          fill="#000000"
          fontStyle="bold"
          shadowColor="#ffffff"
          shadowBlur={3}
          shadowOpacity={0.8}
        />
      )}
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
}: FloorPlanViewerProps) {
  const [image, imageStatus] = useImage(floorPlan.fileUrl || '');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const stageRef = useRef<any>(null);

  // Use full container width - let CSS handle the sizing
  let stageWidth = 1200;
  let stageHeight = 800;

  if (image) {
    // Calculate dimensions to fit image while maintaining aspect ratio
    const imageRatio = image.width / image.height;

    if (imageRatio > 1.5) {
      // Wide image - use full width
      stageWidth = 1200;
      stageHeight = 1200 / imageRatio;
    } else {
      // Tall or square image - use full height
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

    // Limit scale
    const limitedScale = Math.max(0.5, Math.min(5, newScale));

    setScale(limitedScale);
    setPosition({
      x: pointer.x - mousePointTo.x * limitedScale,
      y: pointer.y - mousePointTo.y * limitedScale,
    });
  };

  const handleStageClick = (e: any) => {
    // Check if click was on the background, not on a pin
    if (e.target === e.target.getStage() || e.target.getClassName() === 'Image') {
      if (onStageClick && editable && image) {
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
        const x = (pointerPosition.x - position.x) / scale;
        const y = (pointerPosition.y - position.y) / scale;

        // Normalize coordinates (0.0 to 1.0) based on image dimensions
        const normalizedX = x / image.width;
        const normalizedY = y / image.height;

        onStageClick(normalizedX, normalizedY);
      }
    }
  };

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
        </Layer>
      </Stage>

      {/* Controls */}
      <div className="p-3 bg-white dark:bg-gray-900 border-t flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIN_COLORS.SWITCH }} />
            <span className="text-gray-900 dark:text-gray-100">Switch</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIN_COLORS.FIREWALL }} />
            <span className="text-gray-900 dark:text-gray-100">Firewall</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIN_COLORS.ACCESS_POINT }} />
            <span className="text-gray-900 dark:text-gray-100">AP</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIN_COLORS.RACK }} />
            <span className="text-gray-900 dark:text-gray-100">Rack</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIN_COLORS.CAMERA }} />
            <span className="text-gray-900 dark:text-gray-100">Camera</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIN_COLORS.RJ45 }} />
            <span className="text-gray-900 dark:text-gray-100">RJ45</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIN_COLORS.NRO }} />
            <span className="text-gray-900 dark:text-gray-100">NRO</span>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Zoom: {Math.round(scale * 100)}% | Pins: {pins.length}
        </div>
      </div>
    </div>
  );
}
