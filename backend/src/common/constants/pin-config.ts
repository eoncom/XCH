/**
 * Single source of truth for pin type configuration (colors, labels, abbreviations).
 * Used by admin.service.ts (DEFAULT_LABELS) and backup.service.ts (PDF export).
 */

export interface PinTypeConfig {
  label: string;
  color: string;
  abbreviation: string;
}

/**
 * v1.4.x — Types shared with AssetType (SWITCH/FIREWALL/WIFI_AP/PRINTER/CAMERA/
 * PATCH_PANEL/ROUTER/TEAMS_ROOM/WEBCAM/DISPLAY/SERVER/PDU/BOX_5G/OTHER) are kept
 * label-identical and color-identical to admin.service.ts::DEFAULT_LABELS.AssetType
 * so the equipment catalog and the floor-plan pin catalog never diverge on shared
 * concepts. Pin-only types (RACK, RJ45, NRO) keep their own label & color.
 */
export const PIN_TYPE_CONFIG: Record<string, PinTypeConfig> = {
  // --- Types partagés avec AssetType (doivent rester synchronisés) ---
  SWITCH:       { label: 'Switch',                 color: '#3b82f6', abbreviation: 'SW' },
  FIREWALL:     { label: 'Pare-feu',               color: '#ef4444', abbreviation: 'FW' },
  WIFI_AP:      { label: "Point d'accès WiFi",     color: '#10b981', abbreviation: 'AP' },
  PRINTER:      { label: 'Imprimante',             color: '#a855f7', abbreviation: 'PR' },
  CAMERA:       { label: 'Caméra',                 color: '#64748b', abbreviation: 'CA' },
  PATCH_PANEL:  { label: 'Panneau de brassage',    color: '#06b6d4', abbreviation: 'PP' },
  ROUTER:       { label: 'Routeur',                color: '#6366f1', abbreviation: 'RT' },
  TEAMS_ROOM:   { label: 'Teams Room',             color: '#7c3aed', abbreviation: 'TR' },
  WEBCAM:       { label: 'Webcam',                 color: '#14b8a6', abbreviation: 'WC' },
  DISPLAY:      { label: 'Écran',                  color: '#6b7280', abbreviation: 'EC' },
  SERVER:       { label: 'Serveur',                color: '#8b5cf6', abbreviation: 'SV' },
  PDU:          { label: 'PDU',                    color: '#f97316', abbreviation: 'PD' },
  BOX_5G:       { label: 'Box 5G',                 color: '#84cc16', abbreviation: '5G' },
  OTHER:        { label: 'Autre',                  color: '#9ca3af', abbreviation: '??' },
  // --- Types uniquement dans les plans (pas d'équivalent Asset) ---
  RACK:         { label: 'Baie',                   color: '#0f766e', abbreviation: 'RK' },
  RJ45:         { label: 'Prise RJ45',             color: '#0ea5e9', abbreviation: 'RJ' },
  NRO:          { label: 'Arrivée Fibre NRO',      color: '#dc2626', abbreviation: 'NR' },
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
