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

// Site types
export type SiteStatus = 'PREPARATION' | 'ACTIVE' | 'CLOSED';
export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export interface SiteContact {
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  isPrimary?: boolean;
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
  | 'TEAMS_ROOM'
  | 'SERVER'
  | 'CABLE'
  | 'OTHER';

export type AssetStatus = 'IN_SERVICE' | 'OUT_OF_SERVICE' | 'IN_TRANSIT' | 'STOCK' | 'RETIRED';

export interface Asset {
  id: string;
  tenantId: string;
  siteId?: string;
  type: AssetType;
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
}

// FloorPlan types
export type PinType = 'ASSET' | 'POI' | 'ISSUE' | 'NETWORK';

export interface Pin {
  id: string;
  tenantId: string;
  floorPlanId: string;
  type: PinType;
  x: number;
  y: number;
  assetId?: string;
  label?: string;
  description?: string;
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  asset?: Asset;
}

export interface FloorPlan {
  id: string;
  tenantId: string;
  siteId: string;
  title: string;              // Changed from 'name' to match backend
  floor?: string;
  building?: string;
  version: number;
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
  brand?: string;
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
