'use client';

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group } from 'react-konva';
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
  editable?: boolean;
}

const PIN_COLORS: Record<PinType, string> = {
  ASSET: '#3b82f6',    // blue
  POI: '#10b981',      // green
  ISSUE: '#ef4444',    // red
  NETWORK: '#8b5cf6',  // purple
};

interface PinMarkerProps {
  pin: Pin;
  onClick?: () => void;
}

function PinMarker({ pin, onClick }: PinMarkerProps) {
  return (
    <Group x={pin.x} y={pin.y} onClick={onClick} onTap={onClick}>
      <Circle
        radius={12}
        fill={PIN_COLORS[pin.type]}
        stroke="#ffffff"
        strokeWidth={2}
        shadowBlur={4}
        shadowOpacity={0.3}
      />
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
  editable = false,
}: FloorPlanViewerProps) {
  const [image, imageStatus] = useImage(floorPlan.fileUrl || '');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const stageRef = useRef<any>(null);

  const maxWidth = 800;
  const maxHeight = 600;

  let stageWidth = maxWidth;
  let stageHeight = maxHeight;

  if (image) {
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
    stageWidth = image.width * ratio;
    stageHeight = image.height * ratio;
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
      if (onStageClick && editable) {
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
        const x = (pointerPosition.x - position.x) / scale;
        const y = (pointerPosition.y - position.y) / scale;
        onStageClick(x, y);
      }
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-gray-100">
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable={!editable}
        onWheel={handleWheel}
        onClick={handleStageClick}
      >
        <Layer>
          {image && <KonvaImage image={image} />}

          {pins.map((pin) => (
            <PinMarker
              key={pin.id}
              pin={pin}
              onClick={() => onPinClick?.(pin)}
            />
          ))}
        </Layer>
      </Stage>

      {/* Controls */}
      <div className="p-3 bg-white border-t flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIN_COLORS.ASSET }} />
            <span>Asset</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIN_COLORS.POI }} />
            <span>POI</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIN_COLORS.ISSUE }} />
            <span>Issue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIN_COLORS.NETWORK }} />
            <span>Network</span>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Zoom: {Math.round(scale * 100)}% | Pins: {pins.length}
        </div>
      </div>
    </div>
  );
}
