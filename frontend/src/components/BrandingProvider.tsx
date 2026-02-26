'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { getThemePreset } from '@/lib/themes';

interface BrandingConfig {
  logoUrl: string | null;
  primaryColor: string;
  orgName: string;
  themeId: string | null;
}

const BrandingContext = createContext<BrandingConfig>({
  logoUrl: null,
  primaryColor: '#0070f3',
  orgName: 'XCH',
  themeId: null,
});

export function useBranding() {
  return useContext(BrandingContext);
}

/**
 * Convert hex color to HSL values for CSS custom properties.
 * Returns "h s% l%" format matching Tailwind/shadcn convention.
 */
function hexToHSL(hex: string): string | null {
  // Remove #
  hex = hex.replace(/^#/, '');
  if (hex.length !== 6) return null;

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Get a contrasting foreground color (white or dark) for the given hex color.
 */
function getForegroundHSL(hex: string): string {
  hex = hex.replace(/^#/, '');
  if (hex.length !== 6) return '0 0% 100%'; // default white

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Relative luminance
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // If bright, use dark foreground; if dark, use light foreground
  return luminance > 0.5 ? '222 47% 11%' : '210 40% 98%';
}

interface TenantResponse {
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  config?: any;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const appliedVarsRef = useRef<string[]>([]);

  const { data: tenant } = useQuery<TenantResponse>({
    queryKey: ['tenant-branding'],
    queryFn: () => apiClient.get('/api/tenants/current'),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    enabled: isAuthenticated,
  });

  const themeId = tenant?.config?.theme || null;

  // Apply theme preset or legacy primaryColor as CSS custom properties
  useEffect(() => {
    // Cleanup previous overrides
    appliedVarsRef.current.forEach((v) =>
      document.documentElement.style.removeProperty(v),
    );
    appliedVarsRef.current = [];

    const newVars: string[] = [];

    if (themeId) {
      // ── New: Full theme preset ──────────────────────────────────────
      const preset = getThemePreset(themeId);
      const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
      const vars = preset[mode];

      Object.entries(vars).forEach(([prop, value]) => {
        document.documentElement.style.setProperty(prop, value);
        newVars.push(prop);
      });
    } else if (tenant?.primaryColor && tenant.primaryColor !== '#0070f3') {
      // ── Legacy: primary-color-only (backward compat) ────────────────
      const hsl = hexToHSL(tenant.primaryColor);
      if (hsl) {
        document.documentElement.style.setProperty('--primary', hsl);
        document.documentElement.style.setProperty(
          '--primary-foreground',
          getForegroundHSL(tenant.primaryColor),
        );
        newVars.push('--primary', '--primary-foreground');
      }
    }

    appliedVarsRef.current = newVars;

    return () => {
      newVars.forEach((v) =>
        document.documentElement.style.removeProperty(v),
      );
    };
  }, [themeId, tenant?.primaryColor, resolvedTheme]);

  const branding: BrandingConfig = {
    logoUrl: tenant?.logoUrl || null,
    primaryColor: tenant?.primaryColor || '#0070f3',
    orgName: tenant?.name || 'XCH',
    themeId,
  };

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
