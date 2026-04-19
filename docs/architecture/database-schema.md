# Schema Base de Donnees XCH

Date : 2026-04-08
Version : 1.3 (Delegation-First — ADR-009)

## Vue d'ensemble

Base de donnees PostgreSQL 15+ avec extension PostGIS pour geospatialisation.

**Architecture** : Multi-tenant avec isolation via `tenantId`

**ORM** : Prisma

**Modele** : Delegation-First (delegations autonomes, couche globale legere)

---

## Entites principales

### Hierarchie

```
Tenant (= instance XCH)
  +-- Config globale (SSO, SMTP, monitoring engine)
  +-- Super Admin (isSuperAdmin sur User)
  +-- Delegations (autonomes, isolees)
        +-- groupLabel? / groupColor? (tag UI)
        +-- Sites
        |     +-- Assets, Racks, FloorPlans (+Pins)
        |     +-- Tasks
        +-- Contacts (delegationId nullable = global)
        +-- BillingEntities (delegationId nullable + siteId optionnel)
        +-- Expenses (delegationId obligatoire + siteId optionnel)
        +-- NotificationConfig (delegationId nullable = global)
        +-- UserDelegation (userId + role local)
              +-- AccessGrant (additif, temporaire)

ExternalRefs → polymorphique (Sites, Assets)
Photos → polymorphique (Sites, Assets, Tasks)
AuditLogs (audit trail)
```

### Rattachement par entite

| Entite | delegationId | siteId | Global possible |
|--------|:---:|:---:|:---:|
| Site | FK obligatoire | -- | NON |
| Asset/Rack/Task/FloorPlan | via site | FK obligatoire | NON |
| Expense | FK obligatoire | FK optionnel | NON |
| BillingEntity | FK nullable | FK optionnel | OUI (super admin) |
| Contact | FK nullable | FK optionnel | OUI (super admin) |
| NotificationConfig | FK nullable | -- | OUI (super admin) |

---

## Schéma Prisma complet

### Tenant & Auth

```prisma
model Tenant {
  id          String   @id @default(cuid())
  name        String   // Nom délégation
  subdomain   String   @unique // xch-ile-de-france
  status      TenantStatus @default(ACTIVE)

  // Branding
  logoUrl     String?
  primaryColor String? @default("#0070f3")

  // Configuration
  config      Json?    // Feature flags, quotas, etc.

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  users         User[]
  authProviders AuthProvider[]
  sites         Site[]
  assets        Asset[]
  racks         Rack[]
  tasks         Task[]
  providers     Provider[]
  auditLogs     AuditLog[]

  @@index([status])
}

enum TenantStatus {
  ACTIVE
  SUSPENDED
  TRIAL
}

model User {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // Identité
  email         String
  passwordHash  String?  // NULL si auth externe uniquement

  // Profil
  name          String
  phone         String?
  avatarUrl     String?

  // Permissions
  role          UserRole @default(VIEWER)
  active        Boolean  @default(true)

  // Auth externe
  externalId    String?  // OIDC 'sub' ou SAML nameID
  authProvider  String   @default("local") // local, oidc, saml

  // Metadata
  lastLoginAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  assignedTasks Task[]   @relation("AssignedTo")
  createdTasks  Task[]   @relation("CreatedBy")
  auditLogs     AuditLog[]

  @@unique([tenantId, email])
  @@index([tenantId])
  @@index([tenantId, externalId])
  @@index([tenantId, role])
}

enum UserRole {
  ADMIN
  MANAGER
  TECHNICIEN
  VIEWER
}

model AuthProvider {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  type          AuthProviderType
  name          String   // "Microsoft Entra ID", "Keycloak"
  enabled       Boolean  @default(false)

  // OIDC config
  issuer        String?
  clientId      String?
  clientSecret  String?  // Encrypted at-rest
  scopes        String[] @default(["openid", "profile", "email"])

  // SAML config (future)
  samlConfig    Json?

  // Attribute mapping
  attributeMap  Json?    // Claims → user fields, groups → roles

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([tenantId, type, name])
  @@index([tenantId, enabled])
}

enum AuthProviderType {
  OIDC
  SAML
}
```

### Sites (Chantiers)

```prisma
model Site {
  id          String     @id @default(cuid())
  tenantId    String
  tenant      Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // Identification
  code        String     // Unique par tenant
  name        String
  status      SiteStatus @default(ACTIVE)

  // Localisation
  address     String
  city        String
  postalCode  String?
  country     String     @default("France")
  coordinates Unsupported("geometry(Point,4326)")? // PostGIS POINT (lat, lon)

  // Contacts (JSON array)
  contacts    Json?      // [{name, phone, email, role, isPrimary}]

  // Accès
  accessNotes Json?      // {schedules, badges, procedures, safety}

  // Connectivité
  connectivity Json?     // {primary: {type, provider, ref}, backup: {...}, cutProcedure: {...}}

  // Santé (calculée ou manuelle)
  healthStatus HealthStatus @default(UNKNOWN)
  lastHealthCheck DateTime?

  // Metadata
  notes       String?    @db.Text
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  // Relations
  assets      Asset[]
  racks       Rack[]
  floorPlans  FloorPlan[]
  tasks       Task[]
  externalRefs ExternalRef[]
  photos      Photo[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([tenantId, status])
  @@index([tenantId, healthStatus])
  @@index([coordinates], type: Gist) // PostGIS spatial index
}

enum SiteStatus {
  PREPARATION
  ACTIVE
  CLOSED
}

enum HealthStatus {
  OK
  WARNING
  CRITICAL
  UNKNOWN
}

// Table contacts séparée (alternative au JSON si relations complexes)
model Contact {
  id          String   @id @default(cuid())
  siteId      String
  site        Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)

  name        String
  phone       String?
  email       String?
  role        String?  // Chef chantier, Conducteur travaux...
  isPrimary   Boolean  @default(false)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([siteId])
  @@index([siteId, isPrimary])
}
```

### Assets (Équipements)

```prisma
model Asset {
  id            String      @id @default(cuid())
  tenantId      String
  tenant        Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  siteId        String
  site          Site        @relation(fields: [siteId], references: [id], onDelete: Cascade)

  // Identification
  type          AssetType
  model         String?
  manufacturer  String?
  serialNumber  String?    // Obligatoire pour certains types
  inventoryTag  String?    // Tag interne optionnel

  // Statut
  status        AssetStatus @default(IN_SERVICE)

  // Localisation
  locationText  String?    // "Local technique - Rack A - U12"

  // Réseau
  networkInfo   Json?      // {ip, mac, hostname, vlan, port}

  // Montage en baie (optionnel)
  rackId        String?
  rack          Rack?       @relation(fields: [rackId], references: [id], onDelete: SetNull)
  rackPositionU Int?       // Position départ en U
  rackHeightU   Int?       // Hauteur équipement en U

  // Metadata
  purchaseDate  DateTime?
  warrantyEnd   DateTime?
  weight        Float?     // kg
  powerConsumption Float?  // Watts
  notes         String?    @db.Text

  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  // Relations
  pins          Pin[]
  tasks         Task[]
  externalRefs  ExternalRef[]
  photos        Photo[]

  @@unique([tenantId, serialNumber])
  @@index([tenantId])
  @@index([tenantId, siteId])
  @@index([tenantId, type])
  @@index([tenantId, status])
  @@index([rackId])
}

enum AssetType {
  PRINTER
  IPAD
  TABLET
  SWITCH
  FIREWALL
  ACCESS_POINT
  TEAMS_ROOM
  WEBCAM
  DISPLAY
  CAMERA
  SERVER
  PATCH_PANEL
  PDU
  OTHER
}

enum AssetStatus {
  IN_SERVICE
  OUT_OF_SERVICE
  IN_TRANSIT
  STOCK
  RETIRED
}
```

### Racks (Baies)

```prisma
model Rack {
  id          String     @id @default(cuid())
  tenantId    String
  tenant      Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  siteId      String
  site        Site       @relation(fields: [siteId], references: [id], onDelete: Cascade)

  // Identification
  name        String     // "Baie A", "Rack Local Technique 1"
  serialNumber String?
  model       String?
  manufacturer String?

  // Caractéristiques
  heightU     Int        // 4, 6, 12, 18, 24, 42
  rackType    RackType   @default(FLOOR_STANDING)
  status      RackStatus @default(IN_SERVICE)

  // Localisation
  location    String?    // Description textuelle

  // Spécifications
  specs       Json?      // {dimensions, depth, maxLoad, cooling, security, power: {pduCount, maxWatts}}

  // Metadata
  notes       String?    @db.Text
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  // Relations
  assets      Asset[]    // Équipements montés
  pins        Pin[]      // Pin sur plan si applicable

  @@unique([tenantId, siteId, name])
  @@index([tenantId])
  @@index([tenantId, siteId])
}

enum RackType {
  WALL_MOUNTED
  FLOOR_STANDING
  ENCLOSED_CABINET
}

enum RackStatus {
  IN_SERVICE
  OUT_OF_SERVICE
  PREPARATION
}
```

### Plans & Pins

```prisma
model FloorPlan {
  id          String   @id @default(cuid())
  siteId      String
  site        Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)

  // Identification
  title       String   // "RDC", "Étage 1"
  version     Int      @default(1)

  // Fichier
  fileUrl     String   // S3/MinIO URL
  fileSize    Int?     // bytes
  mimeType    String?  // application/pdf, image/png

  // Metadata
  notes       String?  @db.Text
  uploadedBy  String
  uploadedAt  DateTime @default(now())

  // Relations
  pins        Pin[]

  @@index([siteId])
  @@index([siteId, version])
}

model Pin {
  id            String     @id @default(cuid())
  floorPlanId   String
  floorPlan     FloorPlan  @relation(fields: [floorPlanId], references: [id], onDelete: Cascade)

  // Coordonnées normalisées (0.0 à 1.0)
  x             Float      // Position X relative
  y             Float      // Position Y relative

  // Type & association
  pinType       PinType
  assetId       String?
  asset         Asset?     @relation(fields: [assetId], references: [id], onDelete: Cascade)
  rackId        String?
  rack          Rack?      @relation(fields: [rackId], references: [id], onDelete: Cascade)

  // Label
  label         String?    // Texte affiché sur le plan

  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@index([floorPlanId])
  @@index([assetId])
  @@index([rackId])
}

enum PinType {
  SWITCH
  FIREWALL
  ACCESS_POINT
  PRINTER
  RACK
  CAMERA
  PATCH_PANEL
  OTHER
}
```

### Tasks (Tâches)

```prisma
model Task {
  id          String       @id @default(cuid())
  tenantId    String
  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  siteId      String
  site        Site         @relation(fields: [siteId], references: [id], onDelete: Cascade)
  assetId     String?
  asset       Asset?       @relation(fields: [assetId], references: [id], onDelete: SetNull)

  // Identification
  title       String
  description String?      @db.Text

  // Statut & priorité
  status      TaskStatus   @default(TODO)
  priority    TaskPriority @default(MEDIUM)

  // Assignation
  assignedTo  String?
  assignedUser User?       @relation("AssignedTo", fields: [assignedTo], references: [id], onDelete: SetNull)
  createdBy   String
  creator     User         @relation("CreatedBy", fields: [createdBy], references: [id])

  // Planning
  dueDate     DateTime?

  // Checklist
  checklist   Json?        // [{id, text, checked, order}]

  // TicketLink (référence ticket externe)
  ticketRef   String?      // "INC-12345"
  ticketUrl   String?
  ticketStatus String?     // Statut manuel externe

  // Metadata
  completedAt DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  // Relations
  photos      Photo[]

  @@index([tenantId])
  @@index([tenantId, siteId])
  @@index([tenantId, status])
  @@index([tenantId, assignedTo])
  @@index([tenantId, dueDate])
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  BLOCKED
  DONE
  CANCELLED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

### Providers (Prestataires)

```prisma
model Provider {
  id          String       @id @default(cuid())
  tenantId    String
  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // Identification
  name        String
  type        ProviderType

  // Contacts
  contacts    Json?        // [{name, phone, email, role}]

  // Disponibilité
  availability Json?       // {schedules, sla, interventionDelay}

  // Metadata
  notes       String?      @db.Text
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([tenantId])
  @@index([tenantId, type])
}

enum ProviderType {
  CABLING
  OPERATOR
  INTEGRATOR
  MAINTENANCE
  OTHER
}
```

### Photos (Pièces jointes)

```prisma
model Photo {
  id          String     @id @default(cuid())

  // Polymorphique (attachable à plusieurs types)
  entityType  EntityType
  entityId    String
  site        Site?      @relation(fields: [entityId], references: [id], onDelete: Cascade)
  asset       Asset?     @relation(fields: [entityId], references: [id], onDelete: Cascade)
  task        Task?      @relation(fields: [entityId], references: [id], onDelete: Cascade)

  // Fichier
  fileUrl     String     // S3/MinIO URL
  fileName    String
  fileSize    Int?       // bytes
  mimeType    String     // image/jpeg, application/pdf

  // Metadata
  caption     String?
  uploadedBy  String
  uploadedAt  DateTime   @default(now())

  @@index([entityType, entityId])
  @@index([uploadedAt])
}

enum EntityType {
  SITE
  ASSET
  TASK
  RACK
}
```

### ExternalRefs (Intégrations)

```prisma
model ExternalRef {
  id          String     @id @default(cuid())

  // Polymorphique
  entityType  EntityType
  entityId    String
  site        Site?      @relation(fields: [entityId], references: [id], onDelete: Cascade)
  asset       Asset?     @relation(fields: [entityId], references: [id], onDelete: Cascade)

  // Provider externe
  provider    String     // netbox, uptime_kuma, fortimanager
  externalId  String     // ID objet dans système externe
  externalUrl String?    // Lien direct

  // Metadata
  metadata    Json?      // Données additionnelles provider-specific
  lastSync    DateTime?
  createdAt   DateTime   @default(now())

  @@unique([entityType, entityId, provider])
  @@index([entityType, entityId])
  @@index([provider])
}
```

### AuditLogs

```prisma
model AuditLog {
  id          String     @id @default(cuid())
  tenantId    String
  tenant      Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userId      String?
  user        User?      @relation(fields: [userId], references: [id], onDelete: SetNull)

  // Action
  action      String     // CREATE, UPDATE, DELETE
  entityType  String     // Site, Asset, User...
  entityId    String?

  // Changements
  changes     Json?      // {before: {...}, after: {...}}

  // Context
  ipAddress   String?
  userAgent   String?

  timestamp   DateTime   @default(now())

  @@index([tenantId])
  @@index([tenantId, timestamp])
  @@index([tenantId, userId])
  @@index([tenantId, entityType, entityId])
}
```

### Autorisation (delegation-first)

> ⚠️ **Obsolète :** le modèle Casbin (`model CasbinRule`, 4 rôles `ADMIN/MANAGER/TECHNICIEN/VIEWER`, 83 policies) décrit dans les anciennes versions de ce document a été **retiré en v1.3** (cf. [ADR-009 delegation-first](../decisions/adr-009-delegation-first-model.md)).

L'autorisation repose désormais sur trois tables :
- `UserDelegation(userId, delegationId, right: MANAGE|WRITE|READ)` — source de vérité principale
- `User.isSuperAdmin Boolean` — flag tenant-wide
- `AccessOverride(userId, delegationId, siteId?, type: ALLOW|DENY, permission?)` — surcharges fines par site

Voir [AUTH_MODEL.md](./AUTH_MODEL.md) pour la spec complète.

---

## Indexes & Performance

**Indexes critiques** :
- `tenantId` sur TOUTES les tables (RLS + isolation)
- Foreign keys (relations Prisma)
- `coordinates` spatial index (PostGIS GIST)
- `status`, `healthStatus` (filtres fréquents)
- `createdAt`, `updatedAt` (tri chronologique)

**Full-text search** :
- `Site.name`, `Site.code`, `Site.address` → `tsvector` GIN index
- `Asset.model`, `Asset.serialNumber` → `tsvector` GIN index

---

## Migrations Prisma

```bash
# Générer migration
npx prisma migrate dev --name init

# Appliquer production
npx prisma migrate deploy

# Seed initial (tenant, admin user, 3 délégations démo, sites, assets, etc.)
# Déclenché par POST /api/setup/initialize { loadDemoData: true }
# ou programmatiquement via SeedService (modules/seed/seed.service.ts)
```

---

## PostGIS Setup

```sql
-- Activer extension PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Exemple query spatiale (chantiers dans rayon 10km)
SELECT * FROM "Site"
WHERE ST_DWithin(
  coordinates,
  ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326), -- Paris
  10000 -- 10km en mètres
);
```

---

## Row-Level Security (RLS)

```sql
-- Exemple application RLS sur Site
ALTER TABLE "Site" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_site ON "Site"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Répéter pour Asset, Rack, Task, etc.
```

**Activation dans app** :
```typescript
// NestJS middleware
async setTenantContext(tenantId: string) {
  await this.prisma.$executeRaw`SET app.current_tenant_id = ${tenantId}`;
}
```

---

## Prochaines étapes

1. ✅ Schéma conceptuel défini
2. ⏳ Création fichier `prisma/schema.prisma`
3. ⏳ Setup PostgreSQL + PostGIS (Docker Compose)
4. ⏳ Première migration `prisma migrate dev`
5. ⏳ Seed initial (tenant, admin, policies)

---

**Dernière mise à jour** : 2025-12-31 par Architecte Lead
