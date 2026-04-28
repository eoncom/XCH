// User & Auth types
// UserRole enum (ADMIN/MANAGER/TECHNICIEN/VIEWER) was removed in v1.2 —
// authorization is now carried by UserDelegation.right (DelegationRight below)
// + User.isSuperAdmin + AccessOverride. Phase 6 cleanup removed the deprecated
// alias (0 consumers across frontend/src).

/** Authorization right on a delegation: MANAGE > WRITE > READ */
export type DelegationRight = 'MANAGE' | 'WRITE' | 'READ';

export interface User {
  id: string;
  email: string;
  name: string;
  isSuperAdmin?: boolean;
  tenantId: string;
  avatarUrl?: string;
  phone?: string;
  active?: boolean;
  totpEnabled?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shape returned by `GET /api/users` — includes the embedded userDelegations
 * so the users list can render badges per delegation without a second roundtrip.
 * The `GET /api/users/:id` endpoint returns a plain `User` (use
 * `GET /api/user-delegations/user/:id` to fetch delegations on the detail page).
 */
export interface UserWithDelegations extends User {
  userDelegations?: Array<{
    id: string;
    right: DelegationRight;
    delegation: {
      id: string;
      name: string;
      groupLabel?: string;
    };
  }>;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Legacy Provider type + ProviderType enum (pre-v1.1) — renamed to Contact in
// v1.1, the `providers-legacy` backend controller was retired in phase 5, and
// the `providers` API client was dropped in phase 6 (grep across frontend/src
// shows zero consumers). Use Contact types directly.

// Site types
export type SiteStatus = 'PREPARATION' | 'ACTIVE' | 'CLOSED';
export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export interface SiteContact {
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  company?: string;
  isPrimary?: boolean;
  category?: 'INTERNAL' | 'PROVIDER' | 'PARTNER' | 'TECHNICAL' | 'EMERGENCY';
}

// V2 connectivity link
export interface ConnectivityLink {
  id: string;
  role: 'primary' | 'backup';
  type?: string;
  provider?: string;
  ref?: string;
  bandwidth?: string;
  assetId?: string;
  monitorName?: string;
  status?: 'up' | 'down' | 'unknown';
}

// V2 SD-WAN configuration
export interface SdwanConfig {
  enabled: boolean;
  provider?: string;
  firewallIds: string[];
  monitorName?: string;
  status?: 'up' | 'down' | 'unknown';
  notes?: string;
}

// Health breakdown component
export interface HealthComponent {
  type: 'link' | 'sdwan' | 'asset';
  id: string;
  name: string;
  status: 'up' | 'down' | 'unknown';
  role?: string;
  impact: 'critical' | 'warning' | 'none';
  monitorName?: string;
}

export interface HealthBreakdown {
  overall: HealthStatus;
  timestamp: string;
  components: HealthComponent[];
}

// V2 site connectivity (links array + SD-WAN)
export interface SiteConnectivity {
  // V2 fields
  links?: ConnectivityLink[];
  sdwan?: SdwanConfig;
  cutProcedure?: string;

  // V1 legacy fields (backward compat, read-only)
  primary?: {
    type?: string;
    provider?: string;
    ref?: string;
  };
  backup?: {
    type?: string;
    provider?: string;
    ref?: string;
  };
  monitoring?: {
    source?: string;
    monitor?: string;
    lastCheck?: string;
    uptime?: number;
    responseTime?: number;
  };
}

// Admin link for equipment
export interface AdminLink {
  label: string;
  url: string;
}

// ADR-018 — Asset admin links became a typed 1:N relation. AdminLink stays
// for compatibility with form input shapes; AssetAdminLink is the persisted row.
export interface AssetAdminLink {
  id: string;
  label: string;
  url: string;
  order: number;
  createdAt: string;
}

export interface SiteAccessNotes {
  schedules?: string;
  badges?: string;
  procedures?: string;
  safety?: string;
}

export interface Site {
  id: string;
  tenantId: string;
  delegationId?: string;
  code: string;
  name: string;
  status: SiteStatus;
  healthStatus: HealthStatus;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  // ADR-018 cible D — accessNotes JSON split into 4 free-form Text columns.
  accessSchedules?: string | null;
  accessBadges?: string | null;
  accessProcedures?: string | null;
  accessSafety?: string | null;
  // ADR-018 cible D — metadata.serverInfo split into 4 scalar columns.
  smbPath?: string | null;
  sharepointUrl?: string | null;
  gedUrl?: string | null;
  accessRightsUrl?: string | null;
  notes?: string | null;
  // ADR-018 — typed relations replace former JSON columns.
  contactsOnSite?: SiteContact[];
  connectivity?: SiteConnectivity;
  emplacements?: Array<{ id: string; type: 'SMB' | 'SHAREPOINT'; url: string; description?: string | null; order: number }>;
  healthSnapshot?: { siteId: string; overall: HealthStatus; componentsJson: any[]; computedAt: string } | null;
  monitoringEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  // Organization info (populated by backend)
  delegation?: { id: string; name: string; code: string; groupLabel?: string; groupColor?: string };
}

// Asset types — now dynamic strings (managed via EnumLabel)
export type AssetType = string;
export type AssetStatus = string;

export interface ExternalRef {
  id: string;
  entityType: string;
  entityId: string;
  provider: string;
  externalId: string;
  externalUrl?: string;
  metadata?: any;
  lastSync?: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  tenantId: string;
  siteId?: string;
  type: AssetType;
  name?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  inventoryTag?: string;
  status: AssetStatus;
  locationText?: string;
  // ADR-018 — split from former networkInfo JSON. ip/mac/hostname/vlan/port
  // are scalar columns; adminLinks is a 1:N relation to AssetAdminLink.
  ip?: string;
  mac?: string;
  hostname?: string;
  vlan?: string;
  port?: string;
  adminLinks?: AssetAdminLink[];
  purchaseDate?: string;
  warrantyEnd?: string;
  weight?: number;
  powerConsumption?: number;
  notes?: string;
  rackId?: string;
  rackPositionU?: number;
  rackHeightU?: number;
  rackNotes?: string;
  qrCodeUrl?: string;
  qrCodeToken?: string;
  connectivity?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  site?: Site;
  rack?: Rack;
  externalRefs?: ExternalRef[];
  // Pricing (v1.3)
  assetModelId?: string | null;
  acquisitionPrice?: number | null;
  monthlyPrice?: number | null;
  priceCurrency?: string;
  // Consumption estimation
  dutyCyclePercent?: number;
  // WiFi AP coverage (v1.3)
  wifiCoverageRadius?: number | null;
  wifiFrequency?: string | null;
  wifiAntennaType?: string | null;
  wifiTxPowerDbm?: number | null;
}

// Rack types
export type RackStatus = 'IN_SERVICE' | 'OUT_OF_SERVICE' | 'PREPARATION';

export interface Rack {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  heightU: number;
  rackType?: 'WALL_MOUNTED' | 'FLOOR_STANDING' | 'ENCLOSED_CABINET';
  status: RackStatus;
  location?: string;
  specs?: any;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  site?: Site;
  assets?: Asset[];
}

// Task types
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  order: number;
}

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  siteId?: string;
  assetId?: string;
  assignedTo?: string;
  createdBy: string;
  dueDate?: string;
  completedAt?: string;
  checklist?: ChecklistItem[];
  ticketUrl?: string;
  ticketRef?: string;
  ticketStatus?: string;
  // Cost fields (v1.3)
  estimatedCost?: number | null;
  actualCost?: number | null;
  costCurrency?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  site?: Site;
  asset?: Asset;
  assignedUser?: User;
  creator?: User;
  comments?: TaskComment[];
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  text: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

// FloorPlan types
// PinType — now dynamic string (managed via EnumLabel)
export type PinType = string;

export interface Pin {
  id: string;
  tenantId: string;
  floorPlanId: string;
  pinType: PinType;  // ✅ Corrigé: pinType (backend) au lieu de type
  x: number;
  y: number;
  assetId?: string;
  rackId?: string;
  label?: string;
  description?: string;
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  asset?: Asset;
  rack?: Rack;
}

export interface FloorPlan {
  id: string;
  tenantId: string;
  siteId: string;
  title: string;              // Changed from 'name' to match backend
  floor?: string;
  building?: string;
  version: number;
  planGroupId?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  notes?: string;
  // Scale calibration (for heatmap / measurements)
  scaleMetersPerPixel?: number;
  scaleRefLine?: { x1: number; y1: number; x2: number; y2: number; meters: number };
  createdAt?: string;
  updatedAt?: string;
  site?: Site;
  pins?: Pin[];
  _count?: { pins: number };
}

// Wi-Fi Heatmap types
export interface WifiProfile {
  txPower: number;            // dBm (ex: 20)
  frequency: '2.4' | '5' | '6';  // GHz
  estimatedRange: number;     // meters
  antennaGain: number;        // dBi
  label?: string;             // "Ubiquiti U6-Pro 5GHz"
}

export interface WifiProfilePreset {
  manufacturer: string;
  model: string;
  profiles: {
    '2.4'?: WifiProfile;
    '5'?: WifiProfile;
    '6'?: WifiProfile;
  };
}

export interface HeatmapConfig {
  enabled: boolean;
  frequency: '2.4' | '5' | '6' | 'all';
  minSignal: number;          // dBm threshold (ex: -80)
  opacity: number;            // 0.0-1.0
  hideOtherPins: boolean;
}

export interface HeatmapAccessPoint {
  pinId: string;
  x: number;
  y: number;
  label?: string;
  asset?: {
    id: string;
    name?: string;
    manufacturer?: string;
    model?: string;
    type: string;
    status: string;
    wifiProfile?: WifiProfile;
    // ADR-018 — scalar columns (formerly Asset.networkInfo JSON).
    ip?: string | null;
    mac?: string | null;
    hostname?: string | null;
    // Asset-level WiFi overrides (v1.3)
    wifiCoverageRadius?: number | null;
    wifiFrequency?: string | null;
    wifiAntennaType?: string | null;
    wifiTxPowerDbm?: number | null;
  } | null;
}

export interface HeatmapData {
  floorPlanId: string;
  scaleMetersPerPixel: number | null;
  scaleRefLine: any;
  accessPoints: HeatmapAccessPoint[];
}

// Contact types
export type ContactCategory = 'PROVIDER' | 'INTERNAL' | 'PARTNER' | 'TECHNICAL' | 'EMERGENCY';

export interface ContactType {
  id: string;
  name: string;
  slug: string;
  category: ContactCategory;
  color?: string;
  icon?: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  typeId: string;
  type: ContactType;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  company?: string;
  role?: string;
  notes?: string;
  delegationId?: string | null;
  siteId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactDto {
  name: string;
  typeId: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  company?: string;
  role?: string;
  notes?: string;
  delegationId?: string | null;
  siteId?: string | null;
}

export interface UpdateContactDto extends Partial<CreateContactDto> {
  isActive?: boolean;
}

export interface CreateContactTypeDto {
  name: string;
  category: ContactCategory;
  color?: string;
  icon?: string;
}

export interface UpdateContactTypeDto extends Partial<CreateContactTypeDto> {
  isActive?: boolean;
}

// Asset Movement types
export type AssetMovementType =
  | 'SITE_CHANGE'
  | 'RACK_MOUNT'
  | 'RACK_UNMOUNT'
  | 'RACK_MOVE'
  | 'RACK_CHANGE'
  | 'STATUS_CHANGE'
  | 'CREATED';

export interface AssetMovement {
  id: string;
  tenantId: string;
  assetId: string;
  userId?: string;
  type: AssetMovementType;
  fromSiteId?: string;
  toSiteId?: string;
  fromRackId?: string;
  toRackId?: string;
  fromRackPositionU?: number;
  toRackPositionU?: number;
  fromStatus?: string;
  toStatus?: string;
  notes?: string;
  timestamp: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  fromSite?: {
    id: string;
    code: string;
    name: string;
  };
  toSite?: {
    id: string;
    code: string;
    name: string;
  };
  fromRack?: {
    id: string;
    name: string;
  };
  toRack?: {
    id: string;
    name: string;
  };
}

// Integration types
export interface IntegrationMapping {
  id: string;
  tenantId: string;
  provider: string;
  entityType: string;
  externalId: string;
  externalLabel: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
}

export interface IntegrationTestResult {
  success: boolean;
  message: string;
  details?: {
    version?: string;
    djangoVersion?: string;
    pythonVersion?: string;
  };
}

export interface SyncResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface NetboxPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface NetboxContact {
  id: number;
  url: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  address?: string;
  comments?: string;
  group?: { id: number; name: string; slug: string };
  tags?: { id: number; name: string; slug: string }[];
}

export interface NetboxContactGroup {
  id: number;
  url: string;
  name: string;
  slug: string;
  parent?: { id: number; name: string; slug: string };
  description?: string;
  contact_count?: number;
}

export interface NetboxSiteRemote {
  id: number;
  name: string;
  slug: string;
  status: { value: string; label: string };
  region?: { id: number; name: string };
  physical_address?: string;
}

export interface NetboxDeviceRemote {
  id: number;
  name: string;
  device_type: { model: string; manufacturer: { name: string } };
  role: { id: number; name: string; slug: string };
  site: { id: number; name: string };
  serial?: string;
  status: { value: string; label: string };
}

export interface NetboxRackRemote {
  id: number;
  name: string;
  site: { id: number; name: string };
  u_height: number;
  status: { value: string; label: string };
  role?: { id: number; name: string; slug: string };
}

// Site Access Control (legacy type kept for backward compat)
export type SiteAccessLevel = 'READ' | 'WRITE';

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// API Response
export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
}

// DTOs (Data Transfer Objects)
export interface CreateAssetDto {
  siteId?: string;
  type: AssetType;
  name?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  inventoryTag?: string;
  status: AssetStatus;
  locationText?: string;
  // ADR-018 — flat scalars + adminLinks 1:N.
  ip?: string;
  mac?: string;
  hostname?: string;
  vlan?: string;
  port?: string;
  adminLinks?: Array<{ label: string; url: string }>;
  purchaseDate?: string;
  warrantyEnd?: string;
  weight?: number;
  powerConsumption?: number;
  notes?: string;
  connectivity?: any;
  metadata?: any;
  // Pricing (v1.3)
  assetModelId?: string;
  acquisitionPrice?: number;
  monthlyPrice?: number;
  priceCurrency?: string;
}

export interface UpdateAssetDto extends Partial<CreateAssetDto> {}

export interface CreateTaskDto {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  siteId?: string;
  assetId?: string;
  assignedTo?: string;
  dueDate?: string;
  checklist?: Omit<ChecklistItem, 'id'>[];
  ticketUrl?: string;
  ticketRef?: string;
  ticketStatus?: string;
  // Cost fields (v1.3)
  estimatedCost?: number;
  actualCost?: number;
  costCurrency?: string;
  metadata?: any;
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {}
