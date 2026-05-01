'use client';

import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import type { Rack, Asset } from '@/types';
import { useThemeColors } from '@/hooks/useThemeColors';

export interface OccupyingAssetInfo {
  id: string;
  name?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  rackPositionU: number;
  rackHeightU: number;
}

interface RackVisualizationProps {
  rack: Rack;
  onUnitClick?: (unitNumber: number, occupyingAsset: OccupyingAssetInfo | null) => void;
  selectedUnit?: number;
}

// S6 PR5 — Unit height bumped 30 → 36 so each U slot tap area meets the
// touch target floor for tablet use. Total rack height grows ~20%; the
// scrollable card container absorbs it without layout overflow.
const UNIT_HEIGHT = 36;
const RACK_WIDTH = 400;
const PADDING = 20;

export default function RackVisualization({
  rack,
  onUnitClick,
  selectedUnit,
}: RackVisualizationProps) {
  const colors = useThemeColors();
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
              : colors.muted
          }
          stroke={isSelected ? '#2563eb' : colors.border}
          strokeWidth={isSelected ? 3 : 1}
          onClick={() => {
            const occupying = asset ? {
              id: asset.id,
              name: asset.name,
              manufacturer: asset.manufacturer,
              model: asset.model,
              serialNumber: asset.serialNumber,
              rackPositionU: asset.rackPositionU!,
              rackHeightU: asset.rackHeightU!,
            } : null;
            onUnitClick?.(u, occupying);
          }}
          onTap={() => {
            const occupying = asset ? {
              id: asset.id,
              name: asset.name,
              manufacturer: asset.manufacturer,
              model: asset.model,
              serialNumber: asset.serialNumber,
              rackPositionU: asset.rackPositionU!,
              rackHeightU: asset.rackHeightU!,
            } : null;
            onUnitClick?.(u, occupying);
          }}
          cornerRadius={2}
        />

        {/* Unit number label */}
        <Text
          x={PADDING + 5}
          y={y + UNIT_HEIGHT / 2 - 8}
          text={`U${u}`}
          fontSize={14}
          fontFamily="monospace"
          fill={isOccupied || isSelected ? '#ffffff' : colors.mutedForeground}
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
    <div className="border rounded-lg overflow-hidden bg-card">
      <Stage key={colors.theme} width={RACK_WIDTH + PADDING * 2} height={totalHeight}>
        <Layer>
          {/* Rack frame */}
          <Rect
            x={0}
            y={0}
            width={RACK_WIDTH + PADDING * 2}
            height={totalHeight}
            fill={colors.card}
            stroke={colors.border}
            strokeWidth={2}
          />

          {/* Rack name */}
          <Text
            x={PADDING}
            y={5}
            text={rack.name}
            fontSize={16}
            fontStyle="bold"
            fill={colors.foreground}
          />

          {units}
        </Layer>
      </Stage>

      {/* Legend */}
      <div className="p-4 border-t bg-muted/20">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-muted border border-border rounded" />
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
