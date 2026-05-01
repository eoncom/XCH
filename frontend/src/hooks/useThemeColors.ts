'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';

const FALLBACK_LIGHT: ThemeColors = {
  background: '#ffffff',
  foreground: '#0f172a',
  card: '#ffffff',
  popover: '#ffffff',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  border: '#e2e8f0',
  primary: '#2563eb',
  primaryForeground: '#f8fafc',
  destructive: '#ef4444',
  success: '#16a34a',
  warning: '#f59e0b',
  theme: 'light',
};

const FALLBACK_DARK: ThemeColors = {
  background: '#0b1020',
  foreground: '#f8fafc',
  card: '#111a2e',
  popover: '#111a2e',
  muted: '#1e293b',
  mutedForeground: '#94a3b8',
  border: '#1f2a44',
  primary: '#3b82f6',
  primaryForeground: '#0f172a',
  destructive: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  theme: 'dark',
};

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  popover: string;
  muted: string;
  mutedForeground: string;
  border: string;
  primary: string;
  primaryForeground: string;
  destructive: string;
  success: string;
  warning: string;
  /** Resolved theme: 'light' | 'dark'. Use as `key={colors.theme}` to force
   *  Konva re-render on switch — Konva does not react to CSS variable changes. */
  theme: 'light' | 'dark';
}

/**
 * Reads the active theme + resolves the shadcn HSL CSS variables defined in
 * globals.css into hex values usable by canvas libraries (Konva, Leaflet
 * markers, etc.) that cannot consume CSS variables directly.
 *
 * SSR-safe: returns light fallbacks before hydration. Recomputes when
 * next-themes flips the theme class on <html>.
 */
export function useThemeColors(): ThemeColors {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [tick, setTick] = useState(0);

  // Re-read CSS vars on theme change. The HTML class flip happens before this
  // effect runs; an extra tick ensures getComputedStyle sees the new values.
  useEffect(() => {
    setTick((t) => t + 1);
  }, [resolvedTheme]);

  return useMemo<ThemeColors>(() => {
    if (typeof window === 'undefined') return isDark ? FALLBACK_DARK : FALLBACK_LIGHT;

    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const read = (name: string): string => styles.getPropertyValue(name).trim();

    const fallback = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
    const get = (cssVar: string, fb: string) => {
      const triplet = read(cssVar);
      if (!triplet) return fb;
      const hex = hslTripletToHex(triplet);
      return hex ?? fb;
    };

    return {
      background: get('--background', fallback.background),
      foreground: get('--foreground', fallback.foreground),
      card: get('--card', fallback.card),
      popover: get('--popover', fallback.popover),
      muted: get('--muted', fallback.muted),
      mutedForeground: get('--muted-foreground', fallback.mutedForeground),
      border: get('--border', fallback.border),
      primary: get('--primary', fallback.primary),
      primaryForeground: get('--primary-foreground', fallback.primaryForeground),
      destructive: get('--destructive', fallback.destructive),
      success: get('--success', fallback.success),
      warning: get('--warning', fallback.warning),
      theme: isDark ? 'dark' : 'light',
    };
    // tick forces re-eval after class switch even though resolvedTheme alone
    // would already invalidate. Leaving both deps in for safety.
  }, [isDark, tick]);
}

/**
 * Convert a shadcn HSL triplet ("222 40% 12%") to "#rrggbb".
 * Returns null if the input doesn't parse — caller falls back.
 */
function hslTripletToHex(triplet: string): string | null {
  const match = triplet.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!match) return null;
  const h = parseFloat(match[1]);
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else if (hp < 6) [r1, g1, b1] = [c, 0, x];

  const m = l - c / 2;
  const to255 = (v: number) => Math.round((v + m) * 255);
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(to255(r1))}${toHex(to255(g1))}${toHex(to255(b1))}`;
}
