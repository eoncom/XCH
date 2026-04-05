/**
 * Single source of truth for pin type configuration (colors, labels, abbreviations).
 * Used by admin.service.ts (DEFAULT_LABELS) and backup.service.ts (PDF export).
 */

export interface PinTypeConfig {
  label: string;
  color: string;
  abbreviation: string;
}

export const PIN_TYPE_CONFIG: Record<string, PinTypeConfig> = {
  SWITCH:       { label: 'Switch',               color: '#3b82f6', abbreviation: 'SW' },
  FIREWALL:     { label: 'Pare-feu',             color: '#ef4444', abbreviation: 'FW' },
  WIFI_AP:      { label: 'AP WiFi',              color: '#10b981', abbreviation: 'AP' },
  PRINTER:      { label: 'Imprimante',           color: '#a855f7', abbreviation: 'PR' },
  RACK:         { label: 'Baie',                 color: '#6366f1', abbreviation: 'RK' },
  CAMERA:       { label: 'Cam\u00e9ra',          color: '#64748b', abbreviation: 'CA' },
  PATCH_PANEL:  { label: 'Panneau de brassage',  color: '#06b6d4', abbreviation: 'PP' },
  RJ45:         { label: 'Prise RJ45',           color: '#0ea5e9', abbreviation: 'RJ' },
  NRO:          { label: 'Arriv\u00e9e Fibre NRO', color: '#dc2626', abbreviation: 'NR' },
  ROUTER:       { label: 'Routeur',              color: '#7c3aed', abbreviation: 'RT' },
  TEAMS_ROOM:   { label: 'Teams Room',           color: '#7c3aed', abbreviation: 'TR' },
  WEBCAM:       { label: 'Webcam',               color: '#14b8a6', abbreviation: 'WC' },
  DISPLAY:      { label: '\u00c9cran',           color: '#6b7280', abbreviation: 'EC' },
  SERVER:       { label: 'Serveur',              color: '#8b5cf6', abbreviation: 'SV' },
  PDU:          { label: 'PDU',                  color: '#f97316', abbreviation: 'PD' },
  BOX_5G:       { label: 'Box 5G',               color: '#84cc16', abbreviation: '5G' },
  OTHER:        { label: 'Autre',                color: '#9ca3af', abbreviation: '??' },
};

/** Flat color map for PDF rendering (backup export) */
export const PIN_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(PIN_TYPE_CONFIG).map(([k, v]) => [k, v.color]),
);

/** Short abbreviations for PDF pin labels */
export const PIN_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(PIN_TYPE_CONFIG).map(([k, v]) => [k, v.abbreviation]),
);

/** Structured label+color for admin enum labels API */
export const PIN_TYPE_DEFAULTS: Record<string, { label: string; color: string }> = Object.fromEntries(
  Object.entries(PIN_TYPE_CONFIG).map(([k, v]) => [k, { label: v.label, color: v.color }]),
);
