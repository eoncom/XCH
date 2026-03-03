'use client';

import React from 'react';
import { Wifi, WifiOff, Eye, EyeOff, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { HeatmapConfig } from '@/types';
import { SIGNAL_THRESHOLDS } from '@/lib/wifi-profiles';

interface HeatmapControlsProps {
  config: HeatmapConfig;
  onChange: (config: HeatmapConfig) => void;
  apCount: number;
  hasScale: boolean;
  onCalibrateScale: () => void;
}

const FREQUENCY_OPTIONS = [
  { value: '2.4' as const, label: '2.4 GHz', color: 'bg-blue-500' },
  { value: '5' as const, label: '5 GHz', color: 'bg-green-500' },
  { value: '6' as const, label: '6 GHz', color: 'bg-purple-500' },
  { value: 'all' as const, label: 'Toutes', color: 'bg-gray-500' },
];

export default function HeatmapControls({
  config,
  onChange,
  apCount,
  hasScale,
  onCalibrateScale,
}: HeatmapControlsProps) {
  const updateConfig = (partial: Partial<HeatmapConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="font-medium text-sm">Couverture Wi-Fi</span>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => updateConfig({ enabled })}
        />
      </div>

      {/* AP count info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">
          {apCount} AP{apCount > 1 ? 's' : ''} sur le plan
        </Badge>
        {!hasScale && config.enabled && (
          <Badge variant="destructive" className="text-xs">
            Calibration requise
          </Badge>
        )}
      </div>

      {!config.enabled && (
        <p className="text-xs text-muted-foreground">
          Activez pour visualiser la couverture Wi-Fi estimée des points d&apos;accès positionnés.
        </p>
      )}

      {config.enabled && (
        <>
          <Separator />

          {/* Scale calibration */}
          {!hasScale && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                Calibrez l&apos;échelle du plan pour des rayons de couverture précis.
              </p>
              <Button size="sm" variant="outline" onClick={onCalibrateScale} className="w-full">
                <Ruler className="h-3 w-3 mr-1" />
                Calibrer l&apos;échelle
              </Button>
            </div>
          )}

          {hasScale && (
            <Button size="sm" variant="ghost" onClick={onCalibrateScale} className="w-full text-xs">
              <Ruler className="h-3 w-3 mr-1" />
              Recalibrer l&apos;échelle
            </Button>
          )}

          {/* Frequency band selector */}
          <div className="space-y-2">
            <Label className="text-xs">Bande de fréquence</Label>
            <div className="grid grid-cols-4 gap-1">
              {FREQUENCY_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={config.frequency === opt.value ? 'default' : 'outline'}
                  className="text-xs px-2 py-1 h-7"
                  onClick={() => updateConfig({ frequency: opt.value })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Opacity slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Opacité</Label>
              <span className="text-xs text-muted-foreground">{Math.round(config.opacity * 100)}%</span>
            </div>
            <Slider
              value={[config.opacity]}
              min={0.1}
              max={0.9}
              step={0.05}
              onValueChange={([v]) => updateConfig({ opacity: v })}
            />
          </div>

          {/* Signal threshold slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Seuil signal min</Label>
              <span className="text-xs text-muted-foreground">{config.minSignal} dBm</span>
            </div>
            <Slider
              value={[config.minSignal]}
              min={-95}
              max={-55}
              step={1}
              onValueChange={([v]) => updateConfig({ minSignal: v })}
            />
          </div>

          {/* Hide other pins toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {config.hideOtherPins ? (
                <EyeOff className="h-3 w-3 text-muted-foreground" />
              ) : (
                <Eye className="h-3 w-3 text-muted-foreground" />
              )}
              <Label className="text-xs">Masquer autres repères</Label>
            </div>
            <Switch
              checked={config.hideOtherPins}
              onCheckedChange={(hideOtherPins) => updateConfig({ hideOtherPins })}
            />
          </div>

          <Separator />

          {/* Legend */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Légende signal</Label>
            <div className="space-y-1">
              <LegendItem color="rgb(16, 185, 129)" label="Excellent" range={`> ${SIGNAL_THRESHOLDS.excellent} dBm`} />
              <LegendItem color="rgb(234, 179, 8)" label="Bon" range={`${SIGNAL_THRESHOLDS.excellent} à ${SIGNAL_THRESHOLDS.good} dBm`} />
              <LegendItem color="rgb(249, 115, 22)" label="Acceptable" range={`${SIGNAL_THRESHOLDS.good} à ${SIGNAL_THRESHOLDS.fair} dBm`} />
              <LegendItem color="rgb(239, 68, 68)" label="Faible" range={`${SIGNAL_THRESHOLDS.fair} à ${SIGNAL_THRESHOLDS.weak} dBm`} />
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-foreground italic">
            Estimation indicative en espace libre. Ne tient pas compte des murs et obstacles.
          </p>
        </>
      )}
    </div>
  );
}

function LegendItem({ color, label, range }: { color: string; label: string; range: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color, opacity: 0.7 }} />
      <span className="font-medium w-16">{label}</span>
      <span className="text-muted-foreground">{range}</span>
    </div>
  );
}
