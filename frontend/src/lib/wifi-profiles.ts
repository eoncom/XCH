/**
 * Wi-Fi AP Profile Presets
 * Predefined radio profiles per manufacturer/model for heatmap coverage estimation.
 * Auto-matched by manufacturer + model fields (from manual entry or NetBox sync).
 *
 * txPower: transmit power in dBm
 * frequency: band in GHz
 * estimatedRange: estimated indoor range in meters (free-space, no walls)
 * antennaGain: antenna gain in dBi
 */

import type { WifiProfile, WifiProfilePreset } from '@/types';

// ============================================================================
// PREDEFINED AP PROFILES
// ============================================================================

export const WIFI_PROFILE_PRESETS: WifiProfilePreset[] = [
  // ---- Ubiquiti ----
  {
    manufacturer: 'Ubiquiti',
    model: 'U6-Pro',
    profiles: {
      '2.4': { txPower: 22, frequency: '2.4', estimatedRange: 35, antennaGain: 4, label: 'U6-Pro 2.4GHz' },
      '5':   { txPower: 22, frequency: '5', estimatedRange: 25, antennaGain: 5.5, label: 'U6-Pro 5GHz' },
      '6':   { txPower: 22, frequency: '6', estimatedRange: 20, antennaGain: 5.5, label: 'U6-Pro 6GHz' },
    },
  },
  {
    manufacturer: 'Ubiquiti',
    model: 'U6-Lite',
    profiles: {
      '2.4': { txPower: 22, frequency: '2.4', estimatedRange: 30, antennaGain: 3, label: 'U6-Lite 2.4GHz' },
      '5':   { txPower: 22, frequency: '5', estimatedRange: 22, antennaGain: 4, label: 'U6-Lite 5GHz' },
    },
  },
  {
    manufacturer: 'Ubiquiti',
    model: 'U6-LR',
    profiles: {
      '2.4': { txPower: 25, frequency: '2.4', estimatedRange: 45, antennaGain: 4, label: 'U6-LR 2.4GHz' },
      '5':   { txPower: 25, frequency: '5', estimatedRange: 35, antennaGain: 5.5, label: 'U6-LR 5GHz' },
    },
  },
  {
    manufacturer: 'Ubiquiti',
    model: 'U6-Enterprise',
    profiles: {
      '2.4': { txPower: 25, frequency: '2.4', estimatedRange: 40, antennaGain: 4, label: 'U6-Enterprise 2.4GHz' },
      '5':   { txPower: 25, frequency: '5', estimatedRange: 30, antennaGain: 6, label: 'U6-Enterprise 5GHz' },
      '6':   { txPower: 25, frequency: '6', estimatedRange: 25, antennaGain: 6, label: 'U6-Enterprise 6GHz' },
    },
  },
  {
    manufacturer: 'Ubiquiti',
    model: 'UAP-AC-Pro',
    profiles: {
      '2.4': { txPower: 22, frequency: '2.4', estimatedRange: 35, antennaGain: 3, label: 'UAP-AC-Pro 2.4GHz' },
      '5':   { txPower: 22, frequency: '5', estimatedRange: 25, antennaGain: 3, label: 'UAP-AC-Pro 5GHz' },
    },
  },
  {
    manufacturer: 'Ubiquiti',
    model: 'UAP-AC-Lite',
    profiles: {
      '2.4': { txPower: 20, frequency: '2.4', estimatedRange: 30, antennaGain: 3, label: 'UAP-AC-Lite 2.4GHz' },
      '5':   { txPower: 20, frequency: '5', estimatedRange: 20, antennaGain: 3, label: 'UAP-AC-Lite 5GHz' },
    },
  },
  {
    manufacturer: 'Ubiquiti',
    model: 'U7-Pro',
    profiles: {
      '2.4': { txPower: 24, frequency: '2.4', estimatedRange: 40, antennaGain: 4.5, label: 'U7-Pro 2.4GHz' },
      '5':   { txPower: 24, frequency: '5', estimatedRange: 30, antennaGain: 5.5, label: 'U7-Pro 5GHz' },
      '6':   { txPower: 24, frequency: '6', estimatedRange: 25, antennaGain: 5.5, label: 'U7-Pro 6GHz' },
    },
  },
  // ---- Cisco Meraki ----
  {
    manufacturer: 'Cisco Meraki',
    model: 'MR36',
    profiles: {
      '2.4': { txPower: 19, frequency: '2.4', estimatedRange: 30, antennaGain: 3.5, label: 'MR36 2.4GHz' },
      '5':   { txPower: 19, frequency: '5', estimatedRange: 22, antennaGain: 5, label: 'MR36 5GHz' },
    },
  },
  {
    manufacturer: 'Cisco Meraki',
    model: 'MR46',
    profiles: {
      '2.4': { txPower: 21, frequency: '2.4', estimatedRange: 35, antennaGain: 4, label: 'MR46 2.4GHz' },
      '5':   { txPower: 21, frequency: '5', estimatedRange: 28, antennaGain: 5.5, label: 'MR46 5GHz' },
      '6':   { txPower: 21, frequency: '6', estimatedRange: 22, antennaGain: 5.5, label: 'MR46 6GHz' },
    },
  },
  {
    manufacturer: 'Cisco Meraki',
    model: 'MR56',
    profiles: {
      '2.4': { txPower: 23, frequency: '2.4', estimatedRange: 40, antennaGain: 5, label: 'MR56 2.4GHz' },
      '5':   { txPower: 23, frequency: '5', estimatedRange: 32, antennaGain: 6, label: 'MR56 5GHz' },
    },
  },
  {
    manufacturer: 'Cisco',
    model: 'C9120AXI',
    profiles: {
      '2.4': { txPower: 21, frequency: '2.4', estimatedRange: 35, antennaGain: 4, label: 'C9120AXI 2.4GHz' },
      '5':   { txPower: 21, frequency: '5', estimatedRange: 28, antennaGain: 5, label: 'C9120AXI 5GHz' },
    },
  },
  {
    manufacturer: 'Cisco',
    model: 'C9130AXI',
    profiles: {
      '2.4': { txPower: 23, frequency: '2.4', estimatedRange: 40, antennaGain: 5, label: 'C9130AXI 2.4GHz' },
      '5':   { txPower: 23, frequency: '5', estimatedRange: 30, antennaGain: 6, label: 'C9130AXI 5GHz' },
      '6':   { txPower: 23, frequency: '6', estimatedRange: 25, antennaGain: 6, label: 'C9130AXI 6GHz' },
    },
  },
  // ---- Aruba (HPE) ----
  {
    manufacturer: 'Aruba',
    model: 'AP-515',
    profiles: {
      '2.4': { txPower: 21, frequency: '2.4', estimatedRange: 35, antennaGain: 4.2, label: 'AP-515 2.4GHz' },
      '5':   { txPower: 21, frequency: '5', estimatedRange: 28, antennaGain: 5.5, label: 'AP-515 5GHz' },
    },
  },
  {
    manufacturer: 'Aruba',
    model: 'AP-535',
    profiles: {
      '2.4': { txPower: 21, frequency: '2.4', estimatedRange: 35, antennaGain: 4.8, label: 'AP-535 2.4GHz' },
      '5':   { txPower: 21, frequency: '5', estimatedRange: 30, antennaGain: 6.3, label: 'AP-535 5GHz' },
    },
  },
  {
    manufacturer: 'Aruba',
    model: 'AP-635',
    profiles: {
      '2.4': { txPower: 23, frequency: '2.4', estimatedRange: 40, antennaGain: 5, label: 'AP-635 2.4GHz' },
      '5':   { txPower: 23, frequency: '5', estimatedRange: 30, antennaGain: 6, label: 'AP-635 5GHz' },
      '6':   { txPower: 23, frequency: '6', estimatedRange: 25, antennaGain: 6, label: 'AP-635 6GHz' },
    },
  },
  {
    manufacturer: 'Aruba',
    model: 'AP-655',
    profiles: {
      '2.4': { txPower: 24, frequency: '2.4', estimatedRange: 42, antennaGain: 5.5, label: 'AP-655 2.4GHz' },
      '5':   { txPower: 24, frequency: '5', estimatedRange: 32, antennaGain: 6.5, label: 'AP-655 5GHz' },
      '6':   { txPower: 24, frequency: '6', estimatedRange: 27, antennaGain: 6.5, label: 'AP-655 6GHz' },
    },
  },
  // ---- Ruckus ----
  {
    manufacturer: 'Ruckus',
    model: 'R550',
    profiles: {
      '2.4': { txPower: 21, frequency: '2.4', estimatedRange: 35, antennaGain: 3.5, label: 'R550 2.4GHz' },
      '5':   { txPower: 21, frequency: '5', estimatedRange: 28, antennaGain: 5, label: 'R550 5GHz' },
    },
  },
  {
    manufacturer: 'Ruckus',
    model: 'R650',
    profiles: {
      '2.4': { txPower: 22, frequency: '2.4', estimatedRange: 38, antennaGain: 4, label: 'R650 2.4GHz' },
      '5':   { txPower: 22, frequency: '5', estimatedRange: 30, antennaGain: 5.5, label: 'R650 5GHz' },
    },
  },
  {
    manufacturer: 'Ruckus',
    model: 'R750',
    profiles: {
      '2.4': { txPower: 23, frequency: '2.4', estimatedRange: 40, antennaGain: 4.5, label: 'R750 2.4GHz' },
      '5':   { txPower: 23, frequency: '5', estimatedRange: 32, antennaGain: 6, label: 'R750 5GHz' },
    },
  },
  {
    manufacturer: 'Ruckus',
    model: 'R850',
    profiles: {
      '2.4': { txPower: 24, frequency: '2.4', estimatedRange: 42, antennaGain: 5, label: 'R850 2.4GHz' },
      '5':   { txPower: 24, frequency: '5', estimatedRange: 34, antennaGain: 6.5, label: 'R850 5GHz' },
      '6':   { txPower: 24, frequency: '6', estimatedRange: 28, antennaGain: 6.5, label: 'R850 6GHz' },
    },
  },
  // ---- TP-Link ----
  {
    manufacturer: 'TP-Link',
    model: 'EAP245',
    profiles: {
      '2.4': { txPower: 20, frequency: '2.4', estimatedRange: 30, antennaGain: 3, label: 'EAP245 2.4GHz' },
      '5':   { txPower: 20, frequency: '5', estimatedRange: 22, antennaGain: 4, label: 'EAP245 5GHz' },
    },
  },
  {
    manufacturer: 'TP-Link',
    model: 'EAP660 HD',
    profiles: {
      '2.4': { txPower: 22, frequency: '2.4', estimatedRange: 35, antennaGain: 4, label: 'EAP660 HD 2.4GHz' },
      '5':   { txPower: 22, frequency: '5', estimatedRange: 28, antennaGain: 5, label: 'EAP660 HD 5GHz' },
    },
  },
  {
    manufacturer: 'TP-Link',
    model: 'EAP670',
    profiles: {
      '2.4': { txPower: 23, frequency: '2.4', estimatedRange: 38, antennaGain: 4.5, label: 'EAP670 2.4GHz' },
      '5':   { txPower: 23, frequency: '5', estimatedRange: 30, antennaGain: 5.5, label: 'EAP670 5GHz' },
    },
  },
  // ---- Zyxel ----
  {
    manufacturer: 'Zyxel',
    model: 'NWA210AX',
    profiles: {
      '2.4': { txPower: 20, frequency: '2.4', estimatedRange: 30, antennaGain: 3.5, label: 'NWA210AX 2.4GHz' },
      '5':   { txPower: 20, frequency: '5', estimatedRange: 22, antennaGain: 4.5, label: 'NWA210AX 5GHz' },
    },
  },
  {
    manufacturer: 'Zyxel',
    model: 'WAX650S',
    profiles: {
      '2.4': { txPower: 22, frequency: '2.4', estimatedRange: 35, antennaGain: 4, label: 'WAX650S 2.4GHz' },
      '5':   { txPower: 22, frequency: '5', estimatedRange: 28, antennaGain: 5, label: 'WAX650S 5GHz' },
    },
  },
  // ---- Fortinet (FortiAP) ----
  {
    manufacturer: 'Fortinet',
    model: 'FAP-231F',
    profiles: {
      '2.4': { txPower: 20, frequency: '2.4', estimatedRange: 32, antennaGain: 4, label: 'FAP-231F 2.4GHz' },
      '5':   { txPower: 20, frequency: '5', estimatedRange: 25, antennaGain: 5, label: 'FAP-231F 5GHz' },
    },
  },
  {
    manufacturer: 'Fortinet',
    model: 'FAP-431F',
    profiles: {
      '2.4': { txPower: 22, frequency: '2.4', estimatedRange: 38, antennaGain: 5, label: 'FAP-431F 2.4GHz' },
      '5':   { txPower: 22, frequency: '5', estimatedRange: 30, antennaGain: 6, label: 'FAP-431F 5GHz' },
    },
  },
  // ---- EnGenius ----
  {
    manufacturer: 'EnGenius',
    model: 'ECW230',
    profiles: {
      '2.4': { txPower: 23, frequency: '2.4', estimatedRange: 35, antennaGain: 4, label: 'ECW230 2.4GHz' },
      '5':   { txPower: 23, frequency: '5', estimatedRange: 28, antennaGain: 5, label: 'ECW230 5GHz' },
    },
  },
  // ---- D-Link ----
  {
    manufacturer: 'D-Link',
    model: 'DBA-2820P',
    profiles: {
      '2.4': { txPower: 20, frequency: '2.4', estimatedRange: 28, antennaGain: 3, label: 'DBA-2820P 2.4GHz' },
      '5':   { txPower: 20, frequency: '5', estimatedRange: 22, antennaGain: 4, label: 'DBA-2820P 5GHz' },
    },
  },
  // ---- Huawei ----
  {
    manufacturer: 'Huawei',
    model: 'AP7060DN',
    profiles: {
      '2.4': { txPower: 22, frequency: '2.4', estimatedRange: 35, antennaGain: 4, label: 'AP7060DN 2.4GHz' },
      '5':   { txPower: 22, frequency: '5', estimatedRange: 28, antennaGain: 5.5, label: 'AP7060DN 5GHz' },
    },
  },
];

// ============================================================================
// DEFAULT PROFILE (when no match found)
// ============================================================================

export const DEFAULT_WIFI_PROFILE: Record<string, WifiProfile> = {
  '2.4': {
    txPower: 20,
    frequency: '2.4',
    estimatedRange: 30,
    antennaGain: 3,
    label: 'AP Générique 2.4GHz',
  },
  '5': {
    txPower: 20,
    frequency: '5',
    estimatedRange: 22,
    antennaGain: 4,
    label: 'AP Générique 5GHz',
  },
  '6': {
    txPower: 20,
    frequency: '6',
    estimatedRange: 18,
    antennaGain: 4,
    label: 'AP Générique 6GHz',
  },
};

// ============================================================================
// MATCHING FUNCTION
// ============================================================================

/**
 * Find best Wi-Fi profile match by manufacturer + model.
 * Uses fuzzy matching: case-insensitive, partial model name.
 * Returns profiles for all available bands, or default if no match.
 */
export function findWifiProfile(
  manufacturer?: string | null,
  model?: string | null,
): Record<string, WifiProfile> {
  if (!manufacturer && !model) return DEFAULT_WIFI_PROFILE;

  const mfr = (manufacturer || '').toLowerCase().trim();
  const mdl = (model || '').toLowerCase().trim();

  // Try exact manufacturer + model match first
  for (const preset of WIFI_PROFILE_PRESETS) {
    const presetMfr = preset.manufacturer.toLowerCase();
    const presetMdl = preset.model.toLowerCase();

    if (mfr.includes(presetMfr) || presetMfr.includes(mfr)) {
      if (mdl.includes(presetMdl) || presetMdl.includes(mdl)) {
        return preset.profiles as Record<string, WifiProfile>;
      }
    }
  }

  // Try model-only match (NetBox sometimes has model without clean manufacturer)
  for (const preset of WIFI_PROFILE_PRESETS) {
    const presetMdl = preset.model.toLowerCase();
    if (mdl.includes(presetMdl) || presetMdl.includes(mdl)) {
      return preset.profiles as Record<string, WifiProfile>;
    }
  }

  return DEFAULT_WIFI_PROFILE;
}

/**
 * Get Wi-Fi profile for a specific frequency band.
 * Falls back to closest available band.
 */
export function getProfileForBand(
  profiles: Record<string, WifiProfile>,
  band: '2.4' | '5' | '6',
): WifiProfile {
  if (profiles[band]) return profiles[band];
  // Fallback: 5GHz → 2.4GHz → 6GHz → default
  if (profiles['5']) return profiles['5'];
  if (profiles['2.4']) return profiles['2.4'];
  if (profiles['6']) return profiles['6'];
  return DEFAULT_WIFI_PROFILE['5'];
}

// ============================================================================
// SIGNAL CALCULATION (Simplified Friis)
// ============================================================================

/**
 * Calculate signal strength at distance d from AP.
 * Uses simplified free-space path loss (Friis formula).
 *
 * Signal(d) = txPower + antennaGain - FSPL(d, f)
 * FSPL(d, f) = 20*log10(d) + 20*log10(f) - 27.55
 *
 * Where: d = meters, f = MHz
 */
export function calculateSignalAtDistance(
  profile: WifiProfile,
  distanceMeters: number,
): number {
  if (distanceMeters <= 0) return profile.txPower + profile.antennaGain;

  const freqMHz = parseFloat(profile.frequency) * 1000; // GHz → MHz
  const fspl = 20 * Math.log10(distanceMeters) + 20 * Math.log10(freqMHz) - 27.55;
  return profile.txPower + profile.antennaGain - fspl;
}

/**
 * Signal strength thresholds for heatmap coloring.
 */
export const SIGNAL_THRESHOLDS = {
  excellent: -50,   // > -50 dBm = Green
  good: -67,        // -50 to -67 = Yellow
  fair: -75,        // -67 to -75 = Orange
  weak: -85,        // -75 to -85 = Red
  // < -85 = No coverage (transparent)
} as const;

/**
 * Get color for a signal strength value.
 * Returns RGBA string for canvas rendering.
 */
export function getSignalColor(signalDbm: number, opacity: number = 0.5): string {
  if (signalDbm >= SIGNAL_THRESHOLDS.excellent) {
    return `rgba(16, 185, 129, ${opacity})`;    // green-500
  } else if (signalDbm >= SIGNAL_THRESHOLDS.good) {
    return `rgba(234, 179, 8, ${opacity * 0.85})`;   // yellow-500
  } else if (signalDbm >= SIGNAL_THRESHOLDS.fair) {
    return `rgba(249, 115, 22, ${opacity * 0.7})`;   // orange-500
  } else if (signalDbm >= SIGNAL_THRESHOLDS.weak) {
    return `rgba(239, 68, 68, ${opacity * 0.5})`;    // red-500
  }
  return 'rgba(0, 0, 0, 0)'; // transparent
}
