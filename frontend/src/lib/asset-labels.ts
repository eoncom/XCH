/**
 * Centralized asset labels — fallback defaults.
 * The primary source is now EnumLabel (via useEnumLabels hook).
 * These are kept as fallback for when enum labels haven't loaded yet.
 */

export const assetTypeLabels: Record<string, string> = {
  PRINTER: 'Imprimante',
  IPAD: 'iPad',
  TABLET: 'Tablette',
  SWITCH: 'Switch',
  FIREWALL: 'Firewall',
  ROUTER: 'Routeur',
  WIFI_AP: "Point d'accès WiFi",
  TEAMS_ROOM: 'Teams Room',
  WEBCAM: 'Webcam',
  DISPLAY: 'Écran',
  CAMERA: 'Caméra',
  SERVER: 'Serveur',
  CABLE: 'Câble',
  PATCH_PANEL: 'Panneau de brassage',
  PDU: 'PDU',
  BOX_5G: 'Box 5G',
  OTHER: 'Autre',
};

export const assetStatusLabels: Record<string, string> = {
  IN_SERVICE: 'En service',
  UNDER_MAINTENANCE: 'En maintenance',
  OUT_OF_SERVICE: 'Hors service',
  IN_TRANSIT: 'En transit',
  STOCK: 'En stock',
  RETIRED: 'Retiré',
};

export const assetStatusColors: Record<string, string> = {
  IN_SERVICE: 'success',
  UNDER_MAINTENANCE: 'warning',
  OUT_OF_SERVICE: 'secondary',
  IN_TRANSIT: 'warning',
  STOCK: 'secondary',
  RETIRED: 'error',
};
