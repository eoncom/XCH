// User & Auth types
export type UserRole = 'ADMIN' | 'MANAGER' | 'TECHNICIEN' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  avatar?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
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

// Provider types
export type ProviderType = 'TELECOM' | 'INTERNET' | 'CLOUD' | 'HOSTING' | 'SECURITY' | 'NETWORK' | 'MAINTENANCE' | 'ENERGY' | 'CUSTOM' | 'OTHER';

export interface Provider {
  id: number;
  name: string;
  type: ProviderType;
  customType?: string; // For CUSTOM type
  contact?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface SiteConnectivity {
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
  cutProcedure?: string;
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
  contacts?: SiteContact[];
  connectivity?: SiteConnectivity;
  accessNotes?: SiteAccessNotes;
  notes?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

// Asset types
export type AssetType =
  | 'PRINTER'
  | 'IPAD'
  | 'TABLET'
  | 'SWITCH'
  | 'FIREWALL'
  | 'ROUTER'
  | 'WIFI_AP'
  | 'ACCESS_POINT'
  | 'TEAMS_ROOM'
  | 'WEBCAM'
  | 'DISPLAY'
  | 'CAMERA'
  | 'SERVER'
  | 'CABLE'
  | 'PATCH_PANEL'
  | 'PDU'
  | 'BOX_5G'
  | 'OTHER';

export type AssetStatus = 'IN_SERVICE' | 'OUT_OF_SERVICE' | 'IN_TRANSIT' | 'STOCK' | 'RETIRED';

export interface Asset {
  id: string;
  tenantId: string;
  siteId?: string;
  type: AssetType;
  name?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  status: AssetStatus;
  purchaseDate?: string;
  warrantyEnd?: string;
  rackId?: string;
  rackPositionU?: number;
  rackHeightU?: number;
  qrCodeUrl?: string;
  qrCodeToken?: string;
  connectivity?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  site?: Site;
  rack?: Rack;
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
export type PinType = 'SWITCH' | 'FIREWALL' | 'ACCESS_POINT' | 'PRINTER' | 'RACK' | 'CAMERA' | 'PATCH_PANEL' | 'RJ45' | 'NRO' | 'OTHER';

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
  createdAt?: string;
  updatedAt?: string;
  site?: Site;
  pins?: Pin[];
  _count?: { pins: number };
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
  company?: string;
  role?: string;
  notes?: string;
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
  company?: string;
  role?: string;
  notes?: string;
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

// Site Access Control
export type SiteAccessLevel = 'READ' | 'WRITE';

export interface UserSiteAccess {
  id: string;
  tenantId: string;
  userId: string;
  siteId: string;
  accessLevel: SiteAccessLevel;
  grantedBy?: string;
  grantedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
  };
  site?: {
    id: string;
    name: string;
    code: string;
    status?: string;
  };
}

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
  status: AssetStatus;
  purchaseDate?: string;
  warrantyEnd?: string;
  connectivity?: any;
  metadata?: any;
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
  metadata?: any;
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {}
