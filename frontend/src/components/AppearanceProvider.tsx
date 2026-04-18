'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/auth-store';
import { appearanceApi, type EffectiveAppearance } from '@/lib/api/appearance';

interface AppearanceContextValue {
  appearance: EffectiveAppearance | null;
  loading: boolean;
  reload: () => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  appearance: null,
  loading: false,
  reload: async () => {},
});

/**
 * Convert "#rrggbb" → "r g b" (space-separated channels) so it can feed a
 * Tailwind `bg-[hsl(var(--primary))]` style token. We store the rgb directly
 * in --primary-rgb and let existing UI tokens fall back to their defaults.
 */
function hexToRgbTriplet(hex: string): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

function applyAppearance(ap: EffectiveAppearance) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Density controls compact spacing
  root.setAttribute('data-density', ap.density);

  // Primary color — publish as CSS vars so Tailwind tokens and inline styles can consume it.
  const rgb = hexToRgbTriplet(ap.primaryColor);
  if (rgb) {
    root.style.setProperty('--primary-rgb', rgb);
    root.style.setProperty('--xch-primary-color', ap.primaryColor);
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { setTheme } = useTheme();
  const [appearance, setAppearance] = useState<EffectiveAppearance | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setAppearance(null);
      return;
    }
    setLoading(true);
    try {
      const res = await appearanceApi.getEffective();
      setAppearance(res);
      applyAppearance(res);
      setTheme(res.theme); // bridge into next-themes
    } catch {
      // Fail silent — keep whatever defaults are already applied.
    } finally {
      setLoading(false);
    }
  }, [user, setTheme]);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo<AppearanceContextValue>(
    () => ({ appearance, loading, reload }),
    [appearance, loading, reload],
  );

  return (
    <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
