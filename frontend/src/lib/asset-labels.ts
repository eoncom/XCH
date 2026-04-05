import type { AssetType, AssetStatus } from '@/types';

/**
 * Centralized asset labels — single source of truth.
 * Import from here instead of redefining in each page.
 */

export const assetTypeLabels: Record<AssetType, string> = {
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

export const assetStatusLabels: Record<AssetStatus, string> = {
  IN_SERVICE: 'En service',
  OUT_OF_SERVICE: 'Hors service',
  IN_TRANSIT: 'En transit',
  STOCK: 'En stock',
  RETIRED: 'Retiré',
};

export const assetStatusColors = {
  IN_SERVICE: 'success',
  OUT_OF_SERVICE: 'secondary',
  IN_TRANSIT: 'warning',
  STOCK: 'secondary',
  RETIRED: 'error',
} as const satisfies Record<AssetStatus, string>;
