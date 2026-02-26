/**
 * Tenant Theme Presets
 *
 * Each preset defines CSS variable overrides for both light and dark modes.
 * Variables not overridden use the defaults from globals.css (blue theme).
 * All values are in HSL format: "h s% l%" (matching Tailwind/shadcn convention).
 */

export type ThemePresetId = 'blue' | 'purple' | 'green' | 'orange' | 'rose' | 'teal' | 'slate';

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  description: string;
  previewColor: string; // Hex for UI swatches
  light: Record<string, string>;
  dark: Record<string, string>;
}

export const DEFAULT_THEME: ThemePresetId = 'blue';

export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  // ── Blue (default) ─────────────────────────────────────────────────────
  // Empty maps = use globals.css defaults (zero override)
  blue: {
    id: 'blue',
    label: 'Bleu',
    description: 'Par défaut, professionnel',
    previewColor: '#3b82f6',
    light: {},
    dark: {},
  },

  // ── Purple / Violet ────────────────────────────────────────────────────
  purple: {
    id: 'purple',
    label: 'Violet',
    description: 'Moderne et créatif',
    previewColor: '#8b5cf6',
    light: {
      '--primary': '262 83% 58%',
      '--primary-foreground': '0 0% 100%',
      '--ring': '262 83% 58%',
      '--secondary': '270 20% 96%',
      '--secondary-foreground': '265 47% 11%',
      '--accent': '270 20% 96%',
      '--accent-foreground': '265 47% 11%',
      '--muted': '270 20% 96%',
      '--muted-foreground': '265 16% 47%',
      '--border': '270 25% 91%',
      '--input': '270 25% 91%',
      '--chart-1': '262 83% 58%',
      '--chart-5': '222 84% 56%',
    },
    dark: {
      '--background': '265 47% 8%',
      '--foreground': '270 40% 98%',
      '--card': '265 40% 12%',
      '--card-foreground': '270 40% 98%',
      '--popover': '265 40% 12%',
      '--popover-foreground': '270 40% 98%',
      '--primary': '263 85% 65%',
      '--primary-foreground': '265 47% 11%',
      '--ring': '263 76% 48%',
      '--secondary': '265 33% 17%',
      '--secondary-foreground': '270 40% 98%',
      '--accent': '265 33% 17%',
      '--accent-foreground': '270 40% 98%',
      '--muted': '265 33% 17%',
      '--muted-foreground': '265 20% 65%',
      '--border': '265 33% 20%',
      '--input': '265 33% 20%',
      '--chart-1': '263 85% 65%',
      '--chart-5': '217 91% 65%',
    },
  },

  // ── Green / Emerald ────────────────────────────────────────────────────
  green: {
    id: 'green',
    label: 'Émeraude',
    description: 'Nature et équilibre',
    previewColor: '#10b981',
    light: {
      '--primary': '160 84% 39%',
      '--primary-foreground': '0 0% 100%',
      '--ring': '160 84% 39%',
      '--secondary': '155 20% 96%',
      '--secondary-foreground': '160 47% 11%',
      '--accent': '155 20% 96%',
      '--accent-foreground': '160 47% 11%',
      '--muted': '155 20% 96%',
      '--muted-foreground': '158 16% 43%',
      '--border': '155 25% 90%',
      '--input': '155 25% 90%',
      '--chart-1': '160 84% 39%',
      '--chart-5': '222 84% 56%',
    },
    dark: {
      '--background': '160 47% 7%',
      '--foreground': '155 40% 98%',
      '--card': '160 40% 11%',
      '--card-foreground': '155 40% 98%',
      '--popover': '160 40% 11%',
      '--popover-foreground': '155 40% 98%',
      '--primary': '160 80% 46%',
      '--primary-foreground': '160 47% 8%',
      '--ring': '160 76% 38%',
      '--secondary': '158 33% 16%',
      '--secondary-foreground': '155 40% 98%',
      '--accent': '158 33% 16%',
      '--accent-foreground': '155 40% 98%',
      '--muted': '158 33% 16%',
      '--muted-foreground': '158 20% 60%',
      '--border': '158 33% 19%',
      '--input': '158 33% 19%',
      '--chart-1': '160 80% 50%',
      '--chart-5': '217 91% 65%',
    },
  },

  // ── Orange / Amber ─────────────────────────────────────────────────────
  // Note: --warning redefined to red to avoid clash with orange primary
  orange: {
    id: 'orange',
    label: 'Ambre',
    description: 'Énergie et dynamisme',
    previewColor: '#f59e0b',
    light: {
      '--primary': '38 92% 50%',
      '--primary-foreground': '0 0% 0%',
      '--ring': '38 92% 50%',
      '--secondary': '35 20% 96%',
      '--secondary-foreground': '35 47% 11%',
      '--accent': '35 20% 96%',
      '--accent-foreground': '35 47% 11%',
      '--muted': '35 20% 96%',
      '--muted-foreground': '35 16% 43%',
      '--border': '35 25% 90%',
      '--input': '35 25% 90%',
      '--warning': '0 84% 60%',
      '--chart-1': '38 92% 50%',
      '--chart-5': '222 84% 56%',
    },
    dark: {
      '--background': '30 40% 7%',
      '--foreground': '35 40% 98%',
      '--card': '30 35% 11%',
      '--card-foreground': '35 40% 98%',
      '--popover': '30 35% 11%',
      '--popover-foreground': '35 40% 98%',
      '--primary': '38 95% 55%',
      '--primary-foreground': '30 47% 8%',
      '--ring': '38 80% 45%',
      '--secondary': '33 33% 16%',
      '--secondary-foreground': '35 40% 98%',
      '--accent': '33 33% 16%',
      '--accent-foreground': '35 40% 98%',
      '--muted': '33 33% 16%',
      '--muted-foreground': '33 20% 60%',
      '--border': '33 33% 19%',
      '--input': '33 33% 19%',
      '--warning': '0 62% 54%',
      '--chart-1': '38 95% 60%',
      '--chart-5': '217 91% 65%',
    },
  },

  // ── Rose / Red ─────────────────────────────────────────────────────────
  // Note: --destructive redefined to orange to avoid clash with rose primary
  rose: {
    id: 'rose',
    label: 'Rose',
    description: 'Élégant et audacieux',
    previewColor: '#f43f5e',
    light: {
      '--primary': '347 77% 50%',
      '--primary-foreground': '0 0% 100%',
      '--ring': '347 77% 50%',
      '--secondary': '345 20% 96%',
      '--secondary-foreground': '345 47% 11%',
      '--accent': '345 20% 96%',
      '--accent-foreground': '345 47% 11%',
      '--muted': '345 20% 96%',
      '--muted-foreground': '345 16% 47%',
      '--border': '345 25% 91%',
      '--input': '345 25% 91%',
      '--destructive': '25 95% 53%',
      '--chart-1': '347 77% 50%',
      '--chart-4': '25 95% 53%',
      '--chart-5': '222 84% 56%',
    },
    dark: {
      '--background': '345 47% 7%',
      '--foreground': '345 40% 98%',
      '--card': '345 40% 11%',
      '--card-foreground': '345 40% 98%',
      '--popover': '345 40% 11%',
      '--popover-foreground': '345 40% 98%',
      '--primary': '347 80% 58%',
      '--primary-foreground': '345 47% 8%',
      '--ring': '347 70% 45%',
      '--secondary': '343 33% 16%',
      '--secondary-foreground': '345 40% 98%',
      '--accent': '343 33% 16%',
      '--accent-foreground': '345 40% 98%',
      '--muted': '343 33% 16%',
      '--muted-foreground': '343 20% 60%',
      '--border': '343 33% 19%',
      '--input': '343 33% 19%',
      '--destructive': '25 90% 58%',
      '--chart-1': '347 80% 58%',
      '--chart-4': '25 90% 58%',
      '--chart-5': '217 91% 65%',
    },
  },

  // ── Teal / Cyan ────────────────────────────────────────────────────────
  teal: {
    id: 'teal',
    label: 'Sarcelle',
    description: 'Calme et technologique',
    previewColor: '#14b8a6',
    light: {
      '--primary': '173 80% 40%',
      '--primary-foreground': '0 0% 100%',
      '--ring': '173 80% 40%',
      '--secondary': '170 20% 96%',
      '--secondary-foreground': '173 47% 11%',
      '--accent': '170 20% 96%',
      '--accent-foreground': '173 47% 11%',
      '--muted': '170 20% 96%',
      '--muted-foreground': '172 16% 43%',
      '--border': '170 25% 90%',
      '--input': '170 25% 90%',
      '--chart-1': '173 80% 40%',
      '--chart-5': '222 84% 56%',
    },
    dark: {
      '--background': '173 47% 7%',
      '--foreground': '170 40% 98%',
      '--card': '173 40% 11%',
      '--card-foreground': '170 40% 98%',
      '--popover': '173 40% 11%',
      '--popover-foreground': '170 40% 98%',
      '--primary': '173 75% 48%',
      '--primary-foreground': '173 47% 8%',
      '--ring': '173 70% 38%',
      '--secondary': '172 33% 16%',
      '--secondary-foreground': '170 40% 98%',
      '--accent': '172 33% 16%',
      '--accent-foreground': '170 40% 98%',
      '--muted': '172 33% 16%',
      '--muted-foreground': '172 20% 60%',
      '--border': '172 33% 19%',
      '--input': '172 33% 19%',
      '--chart-1': '173 75% 52%',
      '--chart-5': '217 91% 65%',
    },
  },

  // ── Slate (neutral/professional) ───────────────────────────────────────
  slate: {
    id: 'slate',
    label: 'Ardoise',
    description: 'Sobre et corporate',
    previewColor: '#64748b',
    light: {
      '--primary': '215 16% 47%',
      '--primary-foreground': '0 0% 100%',
      '--ring': '215 16% 47%',
      '--secondary': '210 15% 96%',
      '--secondary-foreground': '215 25% 15%',
      '--accent': '210 15% 96%',
      '--accent-foreground': '215 25% 15%',
      '--muted': '210 15% 96%',
      '--muted-foreground': '215 12% 55%',
      '--border': '214 20% 90%',
      '--input': '214 20% 90%',
      '--chart-1': '215 16% 47%',
      '--chart-5': '262 83% 58%',
    },
    dark: {
      '--background': '220 20% 8%',
      '--foreground': '215 15% 92%',
      '--card': '220 18% 12%',
      '--card-foreground': '215 15% 92%',
      '--popover': '220 18% 12%',
      '--popover-foreground': '215 15% 92%',
      '--primary': '215 20% 60%',
      '--primary-foreground': '220 20% 8%',
      '--ring': '215 18% 45%',
      '--secondary': '218 20% 17%',
      '--secondary-foreground': '215 15% 92%',
      '--accent': '218 20% 17%',
      '--accent-foreground': '215 15% 92%',
      '--muted': '218 20% 17%',
      '--muted-foreground': '215 15% 62%',
      '--border': '218 20% 20%',
      '--input': '218 20% 20%',
      '--chart-1': '215 20% 65%',
      '--chart-5': '262 83% 65%',
    },
  },
};

/** Ordered list of all presets for UI rendering */
export const THEME_PRESET_LIST: ThemePreset[] = Object.values(THEME_PRESETS);

/** Get a theme preset by ID, falling back to the default (blue) theme */
export function getThemePreset(id: string | undefined | null): ThemePreset {
  if (id && id in THEME_PRESETS) {
    return THEME_PRESETS[id as ThemePresetId];
  }
  return THEME_PRESETS[DEFAULT_THEME];
}
