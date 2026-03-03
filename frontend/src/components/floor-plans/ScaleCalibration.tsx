'use client';

import React, { useState, useCallback } from 'react';
import { Ruler, Check, X, MousePointerClick } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ScaleCalibrationProps {
  open: boolean;
  onClose: () => void;
  onSave: (scaleMetersPerPixel: number, scaleRefLine?: {
    x1: number; y1: number; x2: number; y2: number; meters: number;
  }) => void;
  /** Current scale value (if already calibrated) */
  currentScale?: number | null;
  currentRefLine?: { x1: number; y1: number; x2: number; y2: number; meters: number } | null;
  /** Callback to enter "pick points on plan" mode */
  onStartPickingPoints?: () => void;
  /** Points picked by user on the plan (normalized 0-1) */
  pickedPoints?: { x: number; y: number }[];
}

export default function ScaleCalibration({
  open,
  onClose,
  onSave,
  currentScale,
  currentRefLine,
  onStartPickingPoints,
  pickedPoints,
}: ScaleCalibrationProps) {
  const [mode, setMode] = useState<'points' | 'dimensions'>('dimensions');
  const [meters, setMeters] = useState<string>(currentRefLine?.meters?.toString() || '');
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');

  const hasValidPoints = pickedPoints && pickedPoints.length >= 2;

  // Calculate distance between picked points (in normalized units)
  const pointsDistance = hasValidPoints
    ? Math.sqrt(
        Math.pow(pickedPoints[1].x - pickedPoints[0].x, 2) +
        Math.pow(pickedPoints[1].y - pickedPoints[0].y, 2),
      )
    : 0;

  const handleSaveFromPoints = useCallback(() => {
    if (!hasValidPoints || !meters || parseFloat(meters) <= 0) return;

    const realMeters = parseFloat(meters);
    // scaleMetersPerPixel = real meters / normalized distance
    // This means: 1 normalized unit = scaleMetersPerPixel meters
    const scale = realMeters / pointsDistance;

    onSave(scale, {
      x1: pickedPoints![0].x,
      y1: pickedPoints![0].y,
      x2: pickedPoints![1].x,
      y2: pickedPoints![1].y,
      meters: realMeters,
    });
    onClose();
  }, [hasValidPoints, meters, pointsDistance, pickedPoints, onSave, onClose]);

  const handleSaveFromDimensions = useCallback(() => {
    if (!width || parseFloat(width) <= 0) return;

    const realWidth = parseFloat(width);
    // Assume image width = 1.0 normalized
    // scaleMetersPerPixel = real width / 1.0 = real width
    const scale = realWidth;

    onSave(scale);
    onClose();
  }, [width, onSave, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Calibration de l&apos;échelle
          </DialogTitle>
          <DialogDescription>
            Définissez l&apos;échelle du plan pour que les rayons de couverture Wi-Fi soient en mètres réels.
          </DialogDescription>
        </DialogHeader>

        {currentScale && (
          <div className="text-xs bg-muted/50 p-2 rounded">
            Échelle actuelle : ~{currentScale.toFixed(1)} m par unité normalisée
            {currentRefLine && ` (ligne de référence : ${currentRefLine.meters}m)`}
          </div>
        )}

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'points' | 'dimensions')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dimensions">Dimensions pièce</TabsTrigger>
            <TabsTrigger value="points">2 points sur le plan</TabsTrigger>
          </TabsList>

          <TabsContent value="dimensions" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Entrez la largeur réelle (en mètres) de la zone couverte par le plan.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="cal-width" className="text-xs">Largeur totale du plan (mètres)</Label>
                <Input
                  id="cal-width"
                  type="number"
                  step="0.1"
                  min="1"
                  placeholder="Ex: 25"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cal-height" className="text-xs text-muted-foreground">
                  Hauteur (optionnel, pour info)
                </Label>
                <Input
                  id="cal-height"
                  type="number"
                  step="0.1"
                  min="1"
                  placeholder="Ex: 15"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button
                onClick={handleSaveFromDimensions}
                disabled={!width || parseFloat(width) <= 0}
              >
                <Check className="h-4 w-4 mr-1" />
                Enregistrer
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="points" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Cliquez sur 2 points dont vous connaissez la distance réelle (ex: un mur, un couloir).
            </p>

            {/* Step 1: Pick points */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  hasValidPoints ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  1
                </div>
                <span className="text-sm">
                  {hasValidPoints
                    ? `2 points sélectionnés`
                    : 'Cliquez 2 points sur le plan'}
                </span>
              </div>

              {!hasValidPoints && onStartPickingPoints && (
                <Button size="sm" variant="outline" onClick={() => {
                  onStartPickingPoints();
                  onClose(); // Close dialog so user can click on plan
                }} className="w-full">
                  <MousePointerClick className="h-3 w-3 mr-1" />
                  Sélectionner 2 points sur le plan
                </Button>
              )}

              {hasValidPoints && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  Point A: ({(pickedPoints![0].x * 100).toFixed(1)}%, {(pickedPoints![0].y * 100).toFixed(1)}%)
                  <br />
                  Point B: ({(pickedPoints![1].x * 100).toFixed(1)}%, {(pickedPoints![1].y * 100).toFixed(1)}%)
                </div>
              )}
            </div>

            {/* Step 2: Enter real distance */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  meters && parseFloat(meters) > 0 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  2
                </div>
                <span className="text-sm">Distance réelle entre les 2 points</span>
              </div>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                placeholder="Distance en mètres"
                value={meters}
                onChange={(e) => setMeters(e.target.value)}
                disabled={!hasValidPoints}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button
                onClick={handleSaveFromPoints}
                disabled={!hasValidPoints || !meters || parseFloat(meters) <= 0}
              >
                <Check className="h-4 w-4 mr-1" />
                Enregistrer
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
