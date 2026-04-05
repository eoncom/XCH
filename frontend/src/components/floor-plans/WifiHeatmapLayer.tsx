'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { Image as KonvaImage } from 'react-konva';
import type { HeatmapConfig, HeatmapAccessPoint, WifiProfile } from '@/types';
import {
  findWifiProfile,
  getProfileForBand,
  calculateSignalAtDistance,
  SIGNAL_THRESHOLDS,
} from '@/lib/wifi-profiles';

interface WifiHeatmapLayerProps {
  accessPoints: HeatmapAccessPoint[];
  config: HeatmapConfig;
  scaleMetersPerPixel: number | null;
  imageWidth: number;
  imageHeight: number;
  /** Pin positions update trigger (incremented on drag) */
  updateTrigger?: number;
}

/**
 * Konva layer that renders Wi-Fi coverage heatmap circles for each WIFI_AP pin.
 * Uses offscreen canvas with radial gradients for smooth rendering.
 */
export default function WifiHeatmapLayer({
  accessPoints,
  config,
  scaleMetersPerPixel,
  imageWidth,
  imageHeight,
  updateTrigger = 0,
}: WifiHeatmapLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<any>(null);

  // Effective scale: if no calibration, use a reasonable default (1px normalized = 50m)
  const effectiveScale = scaleMetersPerPixel || 50;

  // Build heatmap image on offscreen canvas
  const heatmapImage = useMemo(() => {
    if (!config.enabled || accessPoints.length === 0 || imageWidth <= 0 || imageHeight <= 0) {
      return null;
    }

    // Create offscreen canvas at image dimensions
    const canvas = document.createElement('canvas');
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Use 'screen' composite for nice overlap blending
    ctx.globalCompositeOperation = 'screen';

    for (const ap of accessPoints) {
      // Get Wi-Fi profile for this AP
      const profiles = ap.asset?.wifiProfile
        ? { [ap.asset.wifiProfile.frequency]: ap.asset.wifiProfile }
        : findWifiProfile(ap.asset?.manufacturer, ap.asset?.model);

      // Get bands to render
      const bandsToRender: ('2.4' | '5' | '6')[] =
        config.frequency === 'all'
          ? (['2.4', '5', '6'] as const).filter(b => profiles[b])
          : [config.frequency as '2.4' | '5' | '6'];

      for (const band of bandsToRender) {
        const profile = getProfileForBand(profiles, band);
        if (!profile) continue;

        // Convert AP position (normalized 0-1) to pixel coords
        const cx = ap.x * imageWidth;
        const cy = ap.y * imageHeight;

        // Calculate coverage radius in pixels
        // estimatedRange is in meters, effectiveScale is meters per normalized unit
        // So radius in pixels = (estimatedRange / effectiveScale) * imageWidth
        const radiusPixels = (profile.estimatedRange / effectiveScale) * imageWidth;

        if (radiusPixels < 5) continue; // Too small to render

        drawCoverageCircle(ctx, cx, cy, radiusPixels, profile, config);
      }
    }

    // Store canvas ref for Konva Image
    canvasRef.current = canvas;
    return canvas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessPoints, config.enabled, config.frequency, config.minSignal, config.opacity,
      effectiveScale, imageWidth, imageHeight, updateTrigger]);

  // Force Konva redraw when heatmap changes
  useEffect(() => {
    if (imageRef.current && heatmapImage) {
      imageRef.current.image(heatmapImage);
      imageRef.current.getLayer()?.batchDraw();
    }
  }, [heatmapImage]);

  if (!config.enabled || !heatmapImage) return null;

  return (
    <KonvaImage
      ref={imageRef}
      image={heatmapImage}
      x={0}
      y={0}
      width={imageWidth}
      height={imageHeight}
      opacity={1} // Opacity is baked into gradient colors
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}

/**
 * Draw a single AP coverage circle with radial gradient.
 * Gradient maps signal strength to colors:
 *   Center (strong): green
 *   Mid (good): yellow
 *   Far (weak): red
 *   Edge: transparent
 */
function drawCoverageCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  profile: WifiProfile,
  config: HeatmapConfig,
) {
  const { opacity, minSignal } = config;

  // Calculate signal at key distances for gradient stops
  const totalRange = profile.estimatedRange;
  // Distance ratios for each threshold
  const stops: { ratio: number; color: string }[] = [];

  // Center: full power
  stops.push({ ratio: 0, color: `rgba(16, 185, 129, ${opacity * 0.8})` }); // green

  // Calculate distance at which signal drops to each threshold
  const freqMHz = parseFloat(profile.frequency) * 1000;
  const maxPower = profile.txPower + profile.antennaGain;

  // Excellent → Good boundary
  const distExcellent = distanceForSignal(maxPower, freqMHz, SIGNAL_THRESHOLDS.excellent);
  const ratioExcellent = Math.min(distExcellent / totalRange, 0.9);
  stops.push({ ratio: ratioExcellent * 0.5, color: `rgba(16, 185, 129, ${opacity * 0.6})` }); // green fade

  // Good → Fair boundary
  const distGood = distanceForSignal(maxPower, freqMHz, SIGNAL_THRESHOLDS.good);
  const ratioGood = Math.min(distGood / totalRange, 0.95);
  stops.push({ ratio: ratioGood * 0.6, color: `rgba(234, 179, 8, ${opacity * 0.5})` }); // yellow

  // Fair → Weak boundary
  const distFair = distanceForSignal(maxPower, freqMHz, SIGNAL_THRESHOLDS.fair);
  const ratioFair = Math.min(distFair / totalRange, 0.98);
  stops.push({ ratio: ratioFair * 0.75, color: `rgba(249, 115, 22, ${opacity * 0.35})` }); // orange

  // Weak → No coverage
  stops.push({ ratio: 0.9, color: `rgba(239, 68, 68, ${opacity * 0.2})` }); // red
  stops.push({ ratio: 1.0, color: 'rgba(0, 0, 0, 0)' }); // transparent

  // Create radial gradient
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);

  for (const stop of stops) {
    try {
      gradient.addColorStop(Math.max(0, Math.min(1, stop.ratio)), stop.color);
    } catch {
      // Ignore invalid stops
    }
  }

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Inverse Friis: calculate distance (meters) for a target signal level.
 * FSPL = txPower + antennaGain - targetSignal
 * d = 10^((FSPL - 20*log10(f) + 27.55) / 20)
 */
function distanceForSignal(
  maxPower: number,
  freqMHz: number,
  targetSignalDbm: number,
): number {
  const fspl = maxPower - targetSignalDbm;
  const exponent = (fspl - 20 * Math.log10(freqMHz) + 27.55) / 20;
  return Math.pow(10, exponent);
}

/**
 * Render heatmap to an existing canvas context (for PDF export).
 */
export function renderHeatmapToCanvas(
  ctx: CanvasRenderingContext2D,
  accessPoints: HeatmapAccessPoint[],
  config: HeatmapConfig,
  scaleMetersPerPixel: number | null,
  canvasWidth: number,
  canvasHeight: number,
) {
  const effectiveScale = scaleMetersPerPixel || 50;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (const ap of accessPoints) {
    const profiles = ap.asset?.wifiProfile
      ? { [ap.asset.wifiProfile.frequency]: ap.asset.wifiProfile }
      : findWifiProfile(ap.asset?.manufacturer, ap.asset?.model);

    const bandsToRender: ('2.4' | '5' | '6')[] =
      config.frequency === 'all'
        ? (['2.4', '5', '6'] as const).filter(b => profiles[b])
        : [config.frequency as '2.4' | '5' | '6'];

    for (const band of bandsToRender) {
      const profile = getProfileForBand(profiles, band);
      if (!profile) continue;

      const cx = ap.x * canvasWidth;
      const cy = ap.y * canvasHeight;
      const radiusPixels = (profile.estimatedRange / effectiveScale) * canvasWidth;

      if (radiusPixels < 5) continue;
      drawCoverageCircle(ctx, cx, cy, radiusPixels, profile, config);
    }
  }

  ctx.restore();
}
