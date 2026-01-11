'use client';

import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import type { Rack, Asset } from '@/types';

interface RackVisualizationProps {
  rack: Rack;
  onUnitClick?: (unitNumber: number) => void;
  selectedUnit?: number;
}

const UNIT_HEIGHT = 30;
const RACK_WIDTH = 400;
const PADDING = 20;

export default function RackVisualization({
  rack,
  onUnitClick,
  selectedUnit,
}: RackVisualizationProps) {
  const totalHeight = rack.heightU * UNIT_HEIGHT + PADDING * 2;

  // Create a map of occupied units
  const occupiedUnits = new Map<number, Asset>();
  rack.assets?.forEach((asset) => {
    if (asset.rackPositionU && asset.rackHeightU) {
      for (let i = 0; i < asset.rackHeightU; i++) {
        occupiedUnits.set(asset.rackPositionU + i, asset);
      }
    }
  });

  // Render rack units from top to bottom (highest U number first)
  const units = [];
  for (let u = rack.heightU; u >= 1; u--) {
    const y = PADDING + (rack.heightU - u) * UNIT_HEIGHT;
    const asset = occupiedUnits.get(u);
    const isOccupied = !!asset;
    const isSelected = selectedUnit === u;
    const isFirstUnitOfAsset =
      asset && asset.rackPositionU === u;

    units.push(
      <Group key={u}>
        {/* Unit background */}
        <Rect
          x={PADDING}
          y={y}
          width={RACK_WIDTH}
          height={UNIT_HEIGHT}
          fill={
            isSelected
              ? '#3b82f6'
              : isOccupied
              ? '#10b981'
              : '#f3f4f6'
          }
          stroke={isSelected ? '#2563eb' : '#d1d5db'}
          strokeWidth={isSelected ? 3 : 1}
          onClick={() => onUnitClick?.(u)}
          onTap={() => onUnitClick?.(u)}
          cornerRadius={2}
        />

        {/* Unit number label */}
        <Text
          x={PADDING + 5}
          y={y + UNIT_HEIGHT / 2 - 8}
          text={`U${u}`}
          fontSize={14}
          fontFamily="monospace"
          fill={isOccupied || isSelected ? '#ffffff' : '#6b7280'}
        />

        {/* Asset label (only on first unit of asset) */}
        {isFirstUnitOfAsset && asset && (
          <Text
            x={PADDING + 60}
            y={y + (asset.rackHeightU! * UNIT_HEIGHT) / 2 - 8}
            text={`${asset.manufacturer} ${asset.model} (${asset.rackHeightU}U)`}
            fontSize={12}
            fontFamily="sans-serif"
            fill="#ffffff"
            width={RACK_WIDTH - 70}
            ellipsis={true}
          />
        )}
      </Group>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <Stage width={RACK_WIDTH + PADDING * 2} height={totalHeight}>
        <Layer>
          {/* Rack frame */}
          <Rect
            x={0}
            y={0}
            width={RACK_WIDTH + PADDING * 2}
            height={totalHeight}
            fill="#ffffff"
            stroke="#9ca3af"
            strokeWidth={2}
          />

          {/* Rack name */}
          <Text
            x={PADDING}
            y={5}
            text={rack.name}
            fontSize={16}
            fontStyle="bold"
            fill="#111827"
          />

          {units}
        </Layer>
      </Stage>

      {/* Legend */}
      <div className="p-4 border-t bg-muted/20">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded" />
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span>Occupé</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 border-2 border-blue-600 rounded" />
            <span>Sélectionné</span>
          </div>
        </div>
      </div>
    </div>
  );
}
