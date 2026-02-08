'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface BrandingConfig {
  logoUrl: string | null;
  primaryColor: string;
  orgName: string;
}

const BrandingContext = createContext<BrandingConfig>({
  logoUrl: null,
  primaryColor: '#0070f3',
  orgName: 'XCH',
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
  const [applied, setApplied] = useState(false);

  const { data: tenant } = useQuery<TenantResponse>({
    queryKey: ['tenant-branding'],
    queryFn: () => apiClient.get('/api/tenants/current'),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    enabled: isAuthenticated,
  });

  // Apply primary color as CSS custom property
  useEffect(() => {
    if (!tenant?.primaryColor) {
      setApplied(true);
      return;
    }

    const hsl = hexToHSL(tenant.primaryColor);
    if (hsl) {
      document.documentElement.style.setProperty('--primary', hsl);
      document.documentElement.style.setProperty('--primary-foreground', getForegroundHSL(tenant.primaryColor));
    }
    setApplied(true);

    return () => {
      // Cleanup: remove inline styles when component unmounts
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--primary-foreground');
    };
  }, [tenant?.primaryColor]);

  const branding: BrandingConfig = {
    logoUrl: tenant?.logoUrl || null,
    primaryColor: tenant?.primaryColor || '#0070f3',
    orgName: tenant?.name || 'XCH',
  };

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
