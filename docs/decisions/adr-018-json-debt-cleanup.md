# ADR-018 : Refacto JSON résiduel — extraction des « sacs JSON » survivants vers Prisma typé

**Date :** 2026-04-27
**Statut :** **Proposé** — en attente de validation utilisateur avant implémentation S6/S7
**Référence :** [ADR-009](adr-009-delegation-first-model.md), [ADR-013](adr-013-residual-json-debt.md), [ADR-014](adr-014-native-monitoring.md), [ADR-016](adr-016-monitoring-unification.md), [ADR-017](adr-017-prisma-versioned-migrations.md)
**Dépendance :** ADR-017 (S5) doit être livrée pour que les drops/migrations de cette session soient versionnés et revertibles.

---

## Contexte

[ADR-013](adr-013-residual-json-debt.md) avait acté la dette JSON résiduelle en deux poches : `Asset.networkInfo` et `NotificationConfig.{channels,events}`. Depuis, plusieurs choses ont bougé :

1. **ADR-016 lot E** a déjà extrait `monitorName/monitorStatus/lastHealthCheck` de `Asset.networkInfo` vers le nouveau modèle natif (`Asset.monitor* drops`). La partie *monitoring* d'`Asset.networkInfo` est donc déjà nettoyée.

2. **NotificationConfig.{channels,events}** reste un JSON typé faiblement, mais c'est une session dédiée de plus grande ampleur (ADR-013 pt 1) avec des tests d'héritage exhaustifs requis. **Hors scope de cette session** — sera traité à part après v1.6.

3. **Plusieurs autres « sacs JSON »** ont été identifiés en parcourant le code, qui violent le principe directeur XCH (« pas de dette technique, règles de l'art ») au même titre que `Asset.networkInfo` :
   - `Tenant.config` héberge **5 sous-objets distincts** (modules / electricity / appearance / branding / sso), dont des secrets (SSO).
   - `Site.metadata.healthBreakdown` cache un payload écrit par `HealthAggregationService` qui devrait être structuré.
   - `Site.contacts` JSON array dont la structure est exactement `Contact` (table déjà existante).
   - `Site.accessNotes` 4 textareas free-form imbriqués dans un JSON sans gain.
   - `Site.emplacements` `[{type, url, description}]` avec `type` enum-like sans table dédiée (et pas d'UI d'édition encore — moment idéal pour structurer avant qu'une UI s'y greffe).
   - `Site.metadata.serverInfo` 5 scalaires fixes nommés (`smbPath`, `sharepointUrl`, `gedUrl`, `accessRightsUrl`, `notes`) qui devraient être des colonnes.

L'objectif de cette session est d'**éliminer ces sacs JSON** au profit de modèles Prisma typés, avant de tag v1.6.0.

La Décision E ci-dessous documente les JSON conservés, **avec la justification structurée par champ** (volumétrie, structure, triggers de re-questionnement). C'est précisément ce matériel qui permettra à un audit futur de challenger ces choix de manière informée — la conservation est argumentée, pas figée.

---

## Décision

Quatre cibles d'extraction (A → D), une revue argumentée des JSON conservés (E), une migration versionnée par cible (4 migrations au total — la cible D regroupe les 4 nettoyages JSON résiduels sur `Site` qui ne se chevauchent pas).

---

## Décision A — `Asset.networkInfo` éclaté en colonnes scalaires + `Asset.adminLinks` migré vers table `AssetAdminLink`

### Aujourd'hui

```prisma
// schema.prisma:438
networkInfo Json? @db.JsonB // {ip, mac, hostname, vlan, port}
```

(Le commentaire est obsolète : `adminLinks: AdminLink[]` est aussi présent dans le payload — confirmé via les types frontend `frontend/src/types/index.ts:207-217` et le seed `backend/src/modules/seed/seed.service.ts`.)

### Cible

```prisma
model Asset {
  ...
  // Network identity (extracted from former networkInfo JSON in S6).
  // Indexable for IP-based search; queryable for tenant-wide network audits.
  ip         String?
  mac        String?
  hostname   String?
  vlan       String?
  port       String?

  // Relations
  adminLinks AssetAdminLink[]
  ...
}

model AssetAdminLink {
  id        String   @id @default(cuid())
  assetId   String
  asset     Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  label     String   // free-form, ex. "Web GUI", "SSH jump", "Kibana"
  url       String
  order     Int      @default(0)  // display order
  createdAt DateTime @default(now())

  @@index([assetId])
  @@map("asset_admin_links")
}
```

### Migration de données

```sql
-- Migration 2_asset_network_info_split

ALTER TABLE "assets"
  ADD COLUMN "ip"       TEXT,
  ADD COLUMN "mac"      TEXT,
  ADD COLUMN "hostname" TEXT,
  ADD COLUMN "vlan"     TEXT,
  ADD COLUMN "port"     TEXT;

UPDATE "assets" SET
  "ip"       = "networkInfo"->>'ip',
  "mac"      = "networkInfo"->>'mac',
  "hostname" = "networkInfo"->>'hostname',
  "vlan"     = "networkInfo"->>'vlan',
  "port"     = "networkInfo"->>'port'
WHERE "networkInfo" IS NOT NULL;

CREATE INDEX "assets_tenantId_ip_idx" ON "assets"("tenantId", "ip") WHERE "ip" IS NOT NULL;

-- AssetAdminLink table + data migration
CREATE TABLE "asset_admin_links" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assetId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_admin_links_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE
);
CREATE INDEX "asset_admin_links_assetId_idx" ON "asset_admin_links"("assetId");

INSERT INTO "asset_admin_links" (id, "assetId", label, url, "order", "createdAt")
SELECT
  gen_random_uuid()::text,
  a.id,
  l->>'label',
  l->>'url',
  ord - 1,
  NOW()
FROM "assets" a,
     jsonb_array_elements(COALESCE(a."networkInfo"->'adminLinks', '[]'::jsonb)) WITH ORDINALITY AS arr(l, ord)
WHERE a."networkInfo" -> 'adminLinks' IS NOT NULL
  AND jsonb_array_length(a."networkInfo"->'adminLinks') > 0
  AND l->>'label' IS NOT NULL AND l->>'label' <> ''
  AND l->>'url'   IS NOT NULL AND l->>'url'   <> '';

ALTER TABLE "assets" DROP COLUMN "networkInfo";
```

### Surface de refacto

**Backend** (~6 fichiers) :
- `backend/src/modules/seed/seed.service.ts` — réécrit `networkInfo: { ip, mac, hostname, ... }` en colonnes scalaires sur les ~30 entrées d'assets.
- `backend/src/modules/assets/assets.service.ts` — auto-sync IP (ADR-016 lot H) lit `Asset.ip` directement.
- `backend/src/modules/assets/dto/create-asset.dto.ts` — split `networkInfo` DTO en `ip/mac/hostname/vlan/port/adminLinks`.
- `backend/src/modules/sdwan/sdwan.service.ts` — adapte si lit `networkInfo.ip`.
- `backend/src/modules/monitoring/monitor-reactions.service.ts` — idem.
- `backend/src/modules/integrations/netbox/netbox-sync.service.ts` — idem.
- `backend/src/modules/floor-plans/floor-plans.service.ts` — idem.
- `backend/src/modules/backup/backup.service.ts` — adapte le mapping export/import.

**Frontend** (~9 fichiers) :
- `frontend/src/types/index.ts` — `Asset.networkInfo` remplacé par `ip`, `mac`, `hostname`, `vlan`, `port`, `adminLinks?: AdminLink[]`. **Retire aussi les champs morts** `monitorName/monitorStatus/lastHealthCheck` (déjà drop côté schéma en ADR-016 lot E, le type frontend est resté désaligné).
- `frontend/src/components/monitoring/MonitorConfigSection.tsx` — `defaultTarget` lit `asset.ip` au lieu de `asset.networkInfo.ip`.
- `frontend/src/lib/export-site.ts` — exporte les colonnes scalaires.
- `frontend/src/lib/api/sdwan.ts` — adapte payload.
- `frontend/src/components/sdwan/SdwanSection.tsx` — idem.
- `frontend/src/app/dashboard/assets/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`, `floor-plans/[id]/page.tsx` — formulaires + affichage.

### Gain

- **`Asset.ip` indexé** — recherche par IP en O(log n) au lieu de scan + parse JSON.
- **`Tenant.allowInternalNetworkTargets`** peut être appliqué côté DB en CHECK constraint si on veut serrer un cran de plus (hors scope ADR-018, mais devient possible).
- **Type-safety** côté front/back, fini les `(asset.networkInfo as any).ip`.

---

## Décision B — `Tenant.config` éclaté en 5 modèles distincts (split intégral)

### Aujourd'hui

```prisma
// schema.prisma:36
config Json? @db.JsonB
```

Contient en pratique cinq sous-objets indépendants :

| Sous-objet | Contenu | Usage |
|---|---|---|
| `modules` | `Record<string, boolean>` | Feature flags lus par `ModuleGuard` (`@RequireModule('floor_plans')`, `@RequireModule('integrations_netbox')`, `tasks`, etc.) |
| `electricity` | `{ costPerKwh: number, currency: 'EUR' }` | `ConsumptionService` pour estimer les coûts kWh |
| `appearance` | `{ theme, primaryColor, density, allowUserOverride }` | Defaults UI tenant (ADR-010), résolus par `UsersService.getEffectiveAppearance()` |
| `branding` | `{ logoUrl?, primaryColor?, secondaryColor?, accentColor?, organizationName?, securityReminders? }` | UI sidebar / login / login-page |
| `sso` | `{ provider, clientId, clientSecret, callbackUrl, ... }` | OIDC strategy (passport-openidconnect) — **contient des secrets** |

### Cible

Cinq modèles 1:1 avec `Tenant`, plus une table 1:N pour les feature flags :

```prisma
model Tenant {
  ...
  // Tenant.config JSON dropped — replaced by typed relations below.
  // Branding / primaryColor on Tenant kept as legacy short-hand (already exists).

  // Relations
  modules        TenantFeatureFlag[]    // 1:N
  electricity    TenantElectricityConfig?  // 1:0..1
  appearance     TenantAppearance?         // 1:0..1
  branding       TenantBranding?           // 1:0..1
  ssoConfig      TenantSsoConfig?          // 1:0..1
  ...
}

// Feature flags: 1 row per tenant × module name, queryable & enumerable.
model TenantFeatureFlag {
  tenantId  String
  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name      String  // 'floor_plans', 'integrations_netbox', 'tasks', …
  enabled   Boolean @default(true)
  updatedAt DateTime @updatedAt

  @@id([tenantId, name])
  @@map("tenant_feature_flags")
}

model TenantElectricityConfig {
  tenantId    String  @id
  tenant      Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  costPerKwh  Decimal @db.Decimal(10, 4) @default(0.20)
  currency    String  @default("EUR")
  updatedAt   DateTime @updatedAt

  @@map("tenant_electricity_configs")
}

model TenantAppearance {
  tenantId           String  @id
  tenant             Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  theme              String  @default("light")  // 'light' | 'dark' | 'auto'
  primaryColor       String  @default("#0070f3")
  density            String  @default("comfortable")  // 'comfortable' | 'compact'
  allowUserOverride  Boolean @default(true)
  updatedAt          DateTime @updatedAt

  @@map("tenant_appearance_configs")
}

model TenantBranding {
  tenantId            String  @id
  tenant              Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  logoUrl             String?
  primaryColor        String?
  secondaryColor      String?
  accentColor         String?
  organizationName    String?
  // securityReminders extracted to TenantSecurityReminder table (1:N) for
  // future per-site scoping (BTP chantiers vs office sites) and severity
  // categorization. See dedicated model below.
  updatedAt           DateTime @updatedAt

  @@map("tenant_branding_configs")
}

enum SecurityReminderSeverity {
  INFO
  WARNING
  CRITICAL
}

model TenantSecurityReminder {
  id          String                    @id @default(cuid())
  tenantId    String
  tenant      Tenant                    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  // Optional site scope. NULL = applies to all sites in the tenant (current
  // global behavior). Non-null = only that site (BTP chantier-specific rules).
  siteId      String?
  site        Site?                     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  title       String
  body        String                    @db.Text
  severity    SecurityReminderSeverity  @default(INFO)
  category    String?                   // free-form, ex. "EPI", "Accès", "Procédures"
  order       Int                       @default(0)
  enabled     Boolean                   @default(true)
  createdAt   DateTime                  @default(now())
  updatedAt   DateTime                  @updatedAt

  @@index([tenantId])
  @@index([tenantId, siteId])
  @@map("tenant_security_reminders")
}

model TenantSsoConfig {
  tenantId      String  @id
  tenant        Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  provider      String  // 'oidc' | 'azure-ad' | …
  clientId      String
  clientSecret  String  // encrypted-at-rest TODO post-S6 (cf. follow-up below)
  issuerUrl     String?
  callbackUrl   String?
  scopes        String?  // space-separated, e.g. "openid profile email groups"
  groupClaim    String?  // claim name in JWT mapping to delegations
  enabled       Boolean @default(false)
  updatedAt     DateTime @updatedAt

  @@map("tenant_sso_configs")
}
```

### `User.appearancePreference` aussi splitté

```prisma
// schema.prisma:148 (avant)
appearancePreference Json?  @db.JsonB // { theme?, primaryColor?, density? }

// après
appearanceTheme         String?  // 'light' | 'dark' | 'auto'
appearancePrimaryColor  String?
appearanceDensity       String?  // 'comfortable' | 'compact'
```

3 colonnes scalaires nullables — alignées avec `TenantAppearance`. La résolution `getEffectiveAppearance()` reste : si `appearanceSource = 'inherit'` → tenant defaults ; si `'custom'` → user fields qui sont non-null override field-by-field, et **uniquement si** `TenantAppearance.allowUserOverride === true`.

### Migration de données

```sql
-- Migration 3_tenant_config_split

CREATE TABLE "tenant_feature_flags" (
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("tenantId", "name"),
  CONSTRAINT "tenant_feature_flags_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE TABLE "tenant_electricity_configs" (
  "tenantId" TEXT NOT NULL PRIMARY KEY,
  "costPerKwh" DECIMAL(10,4) NOT NULL DEFAULT 0.20,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_electricity_configs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

-- (CREATE TABLE for appearance, branding, sso similar)

-- Data migration from JSON
INSERT INTO "tenant_feature_flags" ("tenantId", "name", "enabled", "updatedAt")
SELECT t.id, jsonb_each_text.key, (jsonb_each_text.value)::boolean, NOW()
FROM "tenants" t,
     jsonb_each_text(COALESCE(t.config -> 'modules', '{}'::jsonb))
WHERE t.config -> 'modules' IS NOT NULL;

INSERT INTO "tenant_electricity_configs" ("tenantId", "costPerKwh", "currency", "updatedAt")
SELECT id,
       COALESCE((config -> 'electricity' ->> 'costPerKwh')::numeric, 0.20),
       COALESCE(config -> 'electricity' ->> 'currency', 'EUR'),
       NOW()
FROM "tenants"
WHERE config -> 'electricity' IS NOT NULL;

-- (similar INSERTs for appearance, branding, sso)

-- TenantSecurityReminder — extracted from former config.branding.securityReminders
INSERT INTO "tenant_security_reminders" (id, "tenantId", title, body, severity, "order", enabled, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  t.id,
  COALESCE(NULLIF(r->>'title', ''), '(sans titre)'),
  COALESCE(r->>'body', ''),
  'INFO'::"SecurityReminderSeverity",
  ord - 1,
  true,
  NOW(), NOW()
FROM "tenants" t,
     jsonb_array_elements(COALESCE(t.config -> 'branding' -> 'securityReminders', '[]'::jsonb))
       WITH ORDINALITY AS arr(r, ord)
WHERE t.config -> 'branding' -> 'securityReminders' IS NOT NULL
  AND jsonb_array_length(t.config -> 'branding' -> 'securityReminders') > 0;

-- User.appearancePreference → 3 scalar columns
ALTER TABLE "users"
  ADD COLUMN "appearanceTheme"        TEXT,
  ADD COLUMN "appearancePrimaryColor" TEXT,
  ADD COLUMN "appearanceDensity"      TEXT;

UPDATE "users" SET
  "appearanceTheme"        = "appearancePreference"->>'theme',
  "appearancePrimaryColor" = "appearancePreference"->>'primaryColor',
  "appearanceDensity"      = "appearancePreference"->>'density'
WHERE "appearancePreference" IS NOT NULL;

ALTER TABLE "users" DROP COLUMN "appearancePreference";
ALTER TABLE "tenants" DROP COLUMN "config";
```

### Surface de refacto

**Backend** :
- `backend/src/modules/tenants/tenants.service.ts` — réécrit `updateElectricityConfig`, `updateAppearance`, lecture `getModules`, etc.
- `backend/src/modules/seed/seed.service.ts` — split l'init `tenant.config = { ... }` en 5 inserts dans les nouvelles tables.
- `backend/src/modules/setup/setup.service.ts` — idem au moment du `POST /api/setup/initialize`.
- `backend/src/modules/users/users.service.ts` — `getEffectiveAppearance()` lit `tenant.appearance.*` et `user.appearance{Theme,PrimaryColor,Density}`.
- `backend/src/modules/integrations/integrations.service.ts` — lecture SSO config.
- `backend/src/modules/auth/strategies/oidc.strategy.ts` — lecture SSO config.
- `backend/src/modules/consumption/consumption.service.ts` — lecture `tenant.electricity.costPerKwh`.
- `backend/src/modules/consumption/consumption.service.spec.ts` — adapte les mocks (fixtures `config: { electricity: ... }` deviennent des relations).
- `backend/src/common/guards/module.guard.ts` — `tenant.config.modules[name]` → `findUnique TenantFeatureFlag where tenantId+name`.
- `backend/src/common/decorators/require-module.decorator.ts` — doc string mise à jour.

**Frontend** :
- `frontend/src/lib/api/tenant.ts` (et où la config est consommée — ~5-8 fichiers) — split client.

### Gain

- **Type-safety totale** sur SSO/appearance/branding/electricity.
- **Secrets SSO** isolés dans `TenantSsoConfig.clientSecret` — surface réduite, on peut chiffrer at-rest dans une session future.
- **Feature flags queryables** : `SELECT * FROM tenant_feature_flags WHERE name = 'floor_plans' AND enabled = true` — plus facile pour audit + admin tooling.
- **`User.appearancePreference` désimbriqué** — 3 colonnes scalaires, indexables si besoin (analytics par theme).

### Note SSO chiffrement

Le champ `TenantSsoConfig.clientSecret` reste en clair au repos pour cette ADR (équivalent à aujourd'hui — `Tenant.config.sso.clientSecret` est aussi en clair). Le chiffrement at-rest demande l'introduction d'un KMS / pgcrypto avec key rotation, qui sort du scope S6/S7. **À tracker dans une ADR dédiée post-v1.6.**

---

## Décision C — `Site.healthBreakdown` extrait de `Site.metadata` vers `SiteHealthSnapshot`

### Aujourd'hui

```ts
// HealthAggregationService.recomputeSite() écrit :
metadata: { ...existingMetadata, healthBreakdown: breakdown }
// avec breakdown: { overall, timestamp, components: [...] }
```

```prisma
// Site.metadata reste sur :
metadata Json? @db.JsonB
// — aujourd'hui contient { healthBreakdown, serverInfo? }
```

Le frontend lit `site.metadata.healthBreakdown` à 8 endroits (sites/[id]/page.tsx + tv/page.tsx).

### Cible

```prisma
model Site {
  ...
  // metadata.healthBreakdown extracted to SiteHealthSnapshot 1:0..1.
  // metadata.serverInfo (smbPath/sharepointUrl/...) kept as JSON — see Décision E.
  metadata Json? @db.JsonB

  // Relations
  healthSnapshot SiteHealthSnapshot?
}

model SiteHealthSnapshot {
  siteId       String        @id
  site         Site          @relation(fields: [siteId], references: [id], onDelete: Cascade)
  overall      HealthStatus  // HEALTHY | WARNING | CRITICAL | UNKNOWN
  componentsJson Json @db.JsonB  // [{type, id, name, status, impact}] — variabilité acceptable
  computedAt   DateTime

  @@index([overall])
  @@map("site_health_snapshots")
}
```

L'agrégat overall est déjà dénormalisé dans `Site.healthStatus` (existant) — le snapshot ne re-stocke pas l'overall pour éviter le double-source-of-truth (sauf si un test prouve le contraire).

**Justification du `componentsJson Json` plutôt que table 1:N** : le `breakdown.components` est un payload de cache *éphémère*, recomputed à chaque pulse worker (~30s). Le créer en table normalisée signifie 5-10 INSERTs+DELETEs par site par minute → coût élevé pour un usage purement read-only « j'affiche la dernière photo ». La structure est documentée par le type TS `HealthBreakdown.components`, mais reste un blob côté DB. **Pattern « cache structuré »** acceptable ADR-013.

### Migration de données

```sql
-- Migration 4_site_health_snapshot

CREATE TABLE "site_health_snapshots" (
  "siteId" TEXT NOT NULL PRIMARY KEY,
  "overall" "HealthStatus" NOT NULL,
  "componentsJson" JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_health_snapshots_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE
);
CREATE INDEX "site_health_snapshots_overall_idx" ON "site_health_snapshots"("overall");

-- Migrate existing breakdown payloads
INSERT INTO "site_health_snapshots" ("siteId", "overall", "componentsJson", "computedAt")
SELECT
  id,
  COALESCE((metadata->'healthBreakdown'->>'overall')::"HealthStatus", "healthStatus"),
  COALESCE(metadata->'healthBreakdown'->'components', '[]'::jsonb),
  COALESCE((metadata->'healthBreakdown'->>'timestamp')::timestamp, "lastHealthCheck", NOW())
FROM "sites"
WHERE metadata -> 'healthBreakdown' IS NOT NULL;

-- Strip healthBreakdown from metadata, keep serverInfo etc.
UPDATE "sites" SET metadata = metadata - 'healthBreakdown'
WHERE metadata ? 'healthBreakdown';
```

### Surface de refacto

**Backend** (1 fichier critique) :
- `backend/src/modules/monitoring/health-aggregation.service.ts` — `recomputeSite()` upsert `SiteHealthSnapshot` au lieu d'écrire dans `metadata`.
- `backend/src/modules/sites/sites.service.ts` — `findOne` inclut `healthSnapshot`.

**Frontend** (3 fichiers) :
- `frontend/src/app/dashboard/sites/[id]/page.tsx` — `liveHealthComponents` lit `site.healthSnapshot.componentsJson` au lieu de `site.metadata.healthBreakdown`.
- `frontend/src/app/tv/page.tsx` — 3 occurrences à adapter.

### Gain

- **Querybable** : `SELECT siteId FROM site_health_snapshots WHERE overall = 'CRITICAL'` au lieu de scanner le JSON sur N sites.
- **Scope `Site.metadata` réduit** au seul `serverInfo` (SMB path / SharePoint URL / GED), conservé en JSON par Décision E.

---

## Décision D — `Site` : nettoyage JSON résiduel (contacts + accessNotes + emplacements + serverInfo)

Quatre champs JSON différents sur `Site` qui ne devraient pas l'être. Regroupés ici en une cible parce qu'ils partagent le même modèle (Site), ne se chevauchent pas, et tiennent dans une seule migration `5_site_json_cleanup`.

### D.1 `Site.contacts` JSON-array → table `Contact` existante

#### Aujourd'hui

```prisma
// schema.prisma:271
contacts Json? @db.JsonB // [{name, phone, email, role, isPrimary}]
```

Et **en parallèle**, une table `Contact` existe déjà (`schema.prisma:800`) avec relation 1:N → Site (`contactsOnSite Contact[]`). Donc deux sources de vérité pour les contacts d'un site : le JSON-array historique + la vraie table.

#### Cible

Drop `Site.contacts` JSON. Tous les contacts vivent dans la table `Contact` avec `siteId` non-null.

#### Migration de données

Pour chaque site avec `contacts` non-null/non-vide, créer des rows `Contact` en déduplant sur `(siteId, email, phone)` (clé d'unicité retenue car name peut être ambigu). Mapper les champs :
- `contacts[i].name` → `Contact.name` (existant)
- `contacts[i].phone` → `Contact.phone`
- `contacts[i].email` → `Contact.email`
- `contacts[i].role` → `Contact.role` (champ déjà existant)
- `contacts[i].isPrimary` → `Contact.isPrimary` (à confirmer existence champ — sinon ajout colonne)

#### Surface de refacto

**Frontend** : `sites/[id]/page.tsx` (`site.contacts` → `site.contactsOnSite`), `sites/[id]/edit/page.tsx`, `sites/new/page.tsx`, `lib/export-site.ts`. **Backend** : `sites.service.ts` (`findOne` inclut `contactsOnSite`, drop le mapping `contacts`), `seed.service.ts`.

---

### D.2 `Site.accessNotes` JSON → 4 colonnes `Text`

#### Aujourd'hui

```prisma
// schema.prisma:274
accessNotes Json? @db.JsonB // {schedules, badges, procedures, safety}
```

Le frontend traite chaque sous-champ comme un `<textarea>` indépendant (`accessNotes.schedules`, `.badges`, `.procedures`, `.safety` — cf. formulaires `sites/[id]/edit/page.tsx`). Aucune sous-structure dynamique : 4 blocs de texte fixes, sans imbrication.

#### Cible

Quatre colonnes `Text` directement sur `Site` :

```prisma
model Site {
  ...
  accessSchedules   String? @db.Text  // ex. "lun-ven 8h-17h, badge accueil requis"
  accessBadges      String? @db.Text
  accessProcedures  String? @db.Text
  accessSafety      String? @db.Text
}
```

#### Justification du non-JSON

Quatre textareas indépendants ne forment pas un objet structuré — ils forment quatre champs scalaires. Le JSON ajoute une indirection sans gain (pas de query par contenu, pas d'imbrication, pas de variabilité). Si demain `schedules` doit devenir un objet structuré (ex. `{monday: {open, close}, tuesday: ...}`), c'est cette cible isolée qu'on splittera, pas un JSON globalement plus dur à raisonner.

---

### D.3 `Site.emplacements` JSON-array → table `SiteEmplacement`

#### Aujourd'hui

```prisma
// schema.prisma:284
emplacements Json? @db.JsonB // [{type: 'smb'|'sharepoint', url, description}]
```

Note : `ANALYSE_ECARTS_FRONTEND_BACKEND.md` (à archiver post-S6/S7) indique que le champ est défini en DB mais **sans interface d'édition** côté frontend. La colonne dort. C'est le moment idéal pour la matérialiser proprement avant qu'une UI s'y greffe.

#### Cible

```prisma
enum EmplacementType {
  SMB
  SHAREPOINT
}

model SiteEmplacement {
  id          String          @id @default(cuid())
  siteId      String
  site        Site            @relation(fields: [siteId], references: [id], onDelete: Cascade)
  type        EmplacementType
  url         String
  description String?
  order       Int             @default(0)  // display order
  createdAt   DateTime        @default(now())

  @@index([siteId])
  @@map("site_emplacements")
}
```

#### Justification du non-JSON

Structure bien typée (le `type` est explicitement énuméré entre 2 valeurs), 1:N parfait, pas d'imbrication. Le coût de la table est négligeable (~5 colonnes, 1 enum), le gain est la cohérence avec l'écosystème Prisma + le futur ajout d'un type (`gdrive`, `s3`, …) qui devient un `enum value` versionné au lieu d'une string magique.

---

### D.4 `Site.metadata.serverInfo` JSON → 4 colonnes scalaires

#### Aujourd'hui

```prisma
// schema.prisma:300
metadata Json? @db.JsonB // {serverInfo: {smbPath, sharepointUrl, gedUrl, accessRightsUrl, notes}}
```

Cinq sous-champs fixes nommés. Le frontend les affiche un par un (`SiteResourcesSection` dans `sites/[id]/page.tsx`). `notes` existe **déjà** comme colonne sur `Site` (`schema.prisma:301`) — le JSON est partiellement redondant.

#### Cible

Quatre colonnes scalaires sur `Site` :

```prisma
model Site {
  ...
  smbPath          String?
  sharepointUrl    String?
  gedUrl           String?
  accessRightsUrl  String?
  // notes — colonne déjà existante, pas de duplication
}
```

Après cette extraction, **`Site.metadata` devient inutile** (D.4 est le dernier consommateur post-Décision C). On en profite donc pour **dropper la colonne `Site.metadata`** entièrement. Plus de sac-à-tout.

#### Justification du non-JSON

Cinq scalaires nommés, structure stable depuis la création du modèle, jamais étendue. Trois sont des URL, un est un chemin SMB, un est une note. Aucune raison de les imbriquer dans un JSON.

---

### Migration de données (D unifiée)

Une seule migration `5_site_json_cleanup` qui exécute D.1 + D.2 + D.3 + D.4 dans l'ordre :

```sql
-- Migration 5_site_json_cleanup

-- D.1 — contacts to Contact rows
INSERT INTO "contacts" (id, "tenantId", "siteId", name, phone, email, "role", "isPrimary", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, s."tenantId", s.id,
  (c->>'name'),
  NULLIF(c->>'phone', ''),
  NULLIF(c->>'email', ''),
  NULLIF(c->>'role', ''),
  COALESCE((c->>'isPrimary')::boolean, false),
  NOW(), NOW()
FROM "sites" s,
     jsonb_array_elements(COALESCE(s.contacts, '[]'::jsonb)) AS c
WHERE s.contacts IS NOT NULL AND jsonb_array_length(s.contacts) > 0
  AND NOT EXISTS (
    SELECT 1 FROM "contacts" existing
    WHERE existing."siteId" = s.id
      AND COALESCE(existing.email, '') = COALESCE(c->>'email', '')
      AND COALESCE(existing.phone, '') = COALESCE(c->>'phone', '')
  );
ALTER TABLE "sites" DROP COLUMN "contacts";

-- D.2 — accessNotes to 4 columns
ALTER TABLE "sites"
  ADD COLUMN "accessSchedules"  TEXT,
  ADD COLUMN "accessBadges"     TEXT,
  ADD COLUMN "accessProcedures" TEXT,
  ADD COLUMN "accessSafety"     TEXT;

UPDATE "sites" SET
  "accessSchedules"  = "accessNotes"->>'schedules',
  "accessBadges"     = "accessNotes"->>'badges',
  "accessProcedures" = "accessNotes"->>'procedures',
  "accessSafety"     = "accessNotes"->>'safety'
WHERE "accessNotes" IS NOT NULL;

ALTER TABLE "sites" DROP COLUMN "accessNotes";

-- D.3 — emplacements to SiteEmplacement
CREATE TYPE "EmplacementType" AS ENUM ('SMB', 'SHAREPOINT');

CREATE TABLE "site_emplacements" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "siteId" TEXT NOT NULL,
  "type" "EmplacementType" NOT NULL,
  "url" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_emplacements_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE
);
CREATE INDEX "site_emplacements_siteId_idx" ON "site_emplacements"("siteId");

INSERT INTO "site_emplacements" (id, "siteId", "type", url, description, "order", "createdAt")
SELECT
  gen_random_uuid()::text,
  s.id,
  UPPER(e->>'type')::"EmplacementType",
  e->>'url',
  NULLIF(e->>'description', ''),
  ord - 1,  -- 0-indexed
  NOW()
FROM "sites" s,
     jsonb_array_elements(COALESCE(s.emplacements, '[]'::jsonb)) WITH ORDINALITY AS arr(e, ord)
WHERE s.emplacements IS NOT NULL
  AND jsonb_array_length(s.emplacements) > 0
  AND e->>'type' IN ('smb', 'sharepoint');

ALTER TABLE "sites" DROP COLUMN "emplacements";

-- D.4 — metadata.serverInfo to 4 scalar columns + drop metadata
ALTER TABLE "sites"
  ADD COLUMN "smbPath"         TEXT,
  ADD COLUMN "sharepointUrl"   TEXT,
  ADD COLUMN "gedUrl"          TEXT,
  ADD COLUMN "accessRightsUrl" TEXT;

UPDATE "sites" SET
  "smbPath"         = metadata->'serverInfo'->>'smbPath',
  "sharepointUrl"   = metadata->'serverInfo'->>'sharepointUrl',
  "gedUrl"          = metadata->'serverInfo'->>'gedUrl',
  "accessRightsUrl" = metadata->'serverInfo'->>'accessRightsUrl'
WHERE metadata -> 'serverInfo' IS NOT NULL;

-- 'notes' déjà sur Site — fusionner sans écraser si Site.notes est déjà non-null
UPDATE "sites" SET "notes" = metadata->'serverInfo'->>'notes'
WHERE "notes" IS NULL
  AND metadata -> 'serverInfo' ->> 'notes' IS NOT NULL;

-- Drop metadata column entirely (post-Décision C, only serverInfo was left)
ALTER TABLE "sites" DROP COLUMN metadata;
```

### Surface de refacto unifiée (D)

**Backend** :
- `sites.service.ts` — `findOne` inclut `contactsOnSite` + `siteEmplacements`. Adapter `findAll` SELECT raw queries (cf. `FIXES_REPORT.md` les met explicitement). Drop le mapping `contacts/accessNotes/emplacements/metadata`.
- `sites/dto/create-site.dto.ts` — split DTO (4 textareas accessNotes, emplacements en sous-DTO `EmplacementInputDto[]`, smbPath/sharepointUrl/gedUrl/accessRightsUrl scalaires).
- `seed.service.ts` — réécrit les sites en colonnes scalaires + `siteEmplacements` create + `Contact` rows (déjà partiellement le cas).

**Frontend** :
- `sites/[id]/page.tsx` — adapte `SiteResourcesSection` (props passe de `serverInfo` à `{smbPath, sharepointUrl, gedUrl, accessRightsUrl}`), `SiteContactsGrid` lit `contactsOnSite`, affichage emplacements via nouveau hook.
- `sites/[id]/edit/page.tsx` — formulaires.
- `sites/new/page.tsx` — formulaire création.
- `lib/export-site.ts` — adapte le mapping export.

---

## Décision E — JSON conservés : justification par champ

L'inventaire ci-dessous documente **pourquoi** on garde JSON pour chacun de ces champs, et **dans quelles conditions** un audit futur devrait re-questionner ce choix. C'est précisément le rôle d'un audit de challenger ces décisions à la lumière des données et besoins du moment ; cet ADR fournit le matériel pour que cette re-question soit informée plutôt que théorique.

Trois statuts distincts :

- **Hors scope ADR-018** : tranché par une autre décision/session.
- **Conservation argumentée** : structure et usage justifient le JSON aujourd'hui.
- **YAGNI** : on ne sait pas encore comment la donnée sera consommée — on attend des signaux pilote avant de figer une structure.

---

### E.1 Hors scope ADR-018

#### `NotificationConfig.channels` + `NotificationConfig.events`

- **Pourquoi pas dans cet ADR** — héritage global → délégation déjà déployé en prod, complexité de tests d'idempotence trop élevée pour cette session. Tracé par [ADR-013](adr-013-residual-json-debt.md) point 1, session dédiée planifiée post-v1.6.
- **Trigger pour re-questionner** — bug de cohérence d'héritage observé en prod, ou besoin d'audit « quels users reçoivent quel canal ». Quand on s'y attelle, refacto vers `NotificationChannelConfig` + `NotificationEventConfig` typés.
- **Volumétrie** — petite (1 row par tenant, ~5 KB). Faible fréquence d'écriture (config update via Settings UI).

#### `MonitorHttpConfig.headers` (`Json?`)

- **Pourquoi JSON aujourd'hui** — YAGNI. La spec HTTP autorise des headers arbitraires, mais en pratique sur le pilote on ne sait pas encore quels headers les opérateurs ajoutent (Authorization, X-API-Key, custom ?).
- **Trigger pour re-questionner** — un signal pilote où l'opérateur demande de voir/auditer/modifier un header en particulier. À ce moment, on pourra promouvoir les 2-3 headers récurrents en colonnes nommées (par ex. `MonitorHttpConfig.authorizationHeader`) et garder les autres en JSON, ou tout structurer si le pattern devient clair.
- **Volumétrie** — ~50-200 bytes, 0-5 entries par config. Écrit uniquement à la création/édition d'un MonitorCheck HTTP.

---

### E.2 Conservation argumentée

#### `VendorCatalog.content` (`Json`)

- **Pourquoi JSON est le bon choix** — vérifié dans `backend/src/modules/asset-models/vendor-templates.service.ts:269` : `content: catalog as any` stocke le payload uploadé **opaquement**, sans le re-modéliser. Le rôle est *backup pour re-download identique*, pas query. Les données métier (modèles d'équipement, prix) sont DÉJÀ extraites en tables normalisées (`AssetModel`) au moment de l'upload via `importFortinetShapedPayload()` ou `importGenericItems()`. La structure varie réellement entre vendors : Fortinet a `{fortiap[], fortiswitch[], fortigate[]}`, le format Generic a `{items[]}`. Re-modéliser le `content` reviendrait à dupliquer un parser pour chaque shape, sans bénéfice (les modèles métiers sont déjà accessibles).
- **Trigger pour re-questionner** — besoin d'un diff structuré entre deux versions de catalog (ex. « quels modèles HPE ont changé de prix entre v2.0 et v2.1 »). Solution alors : table `VendorCatalogChange` dédiée à ce diff, pas re-model du `content` (qui doit rester un round-trip identique pour la fonction download).
- **Volumétrie** — quelques MB par catalogue (centaines/milliers de lignes produit). Écrit 1× par upload, rarement.

#### `SiteHealthSnapshot.componentsJson` (`Json` — `[{type, id, name, status, impact}]`)

- **Pourquoi JSON est le bon choix, malgré le « 0 JSON » strict** — c'est un **cache structuré éphémère**. `HealthAggregationService.recomputeSite()` recompute et réécrit l'intégralité du `breakdown.components` à chaque pulse worker (~30s ou à chaque événement monitor). Si on normalisait en table 1:N, chaque pulse coûterait `DELETE * FROM site_health_snapshot_components WHERE siteId = X` + `INSERT N rows` — bruit de write élevé, gain query nul (le frontend lit toujours la liste complète d'un coup, jamais en filtre individuel).
- **Trigger pour re-questionner** — passage d'un modèle « snapshot complet » à un modèle « delta » (ne pousser que les composants qui ont changé) : à ce moment-là, table normalisée justifiée. Ou si on veut tracer historiquement quels composants ont été DOWN dans la fenêtre des 24h pour de l'analytique → table d'événements séparée plutôt que de modifier ce cache.
- **Volumétrie** — ~5-20 KB par site, recomputed toutes les ~30s par site monitoré. Pic de write à éviter.

---

## Conséquences

**Positives :**
- Schéma totalement type-safe — fini les `(x as any).y` côté backend et `any` côté frontend.
- Surface JSON divisée par ~3 (passe de 9-10 colonnes JSON « sac » à ~5 colonnes JSON-list délibérées).
- SSO secrets isolables (chemin vers chiffrement at-rest ouvert).
- Recherche par IP (Asset) et par status (SiteHealthSnapshot) en O(log n) au lieu de scan + parse.
- Type frontend `Asset.networkInfo.{monitorName, monitorStatus, lastHealthCheck}` (mort depuis ADR-016) supprimé en passant.
- Migrations versionnées et revertibles (grâce à ADR-017).

**Négatives (acceptées) :**
- ~40-45 fichiers touchés (backend + frontend), risque de régression à mitiger par smoke complet xch-deploy.
- Reset+reseed obligatoire en prod (xch-deploy démo, autorisé).
- 9 nouvelles tables (`AssetAdminLink`, `TenantFeatureFlag`, `TenantElectricityConfig`, `TenantAppearance`, `TenantBranding`, `TenantSsoConfig`, `TenantSecurityReminder`, `SiteHealthSnapshot`, `SiteEmplacement`) + 2 enums (`EmplacementType`, `SecurityReminderSeverity`) — augmentation significative du nombre d'objets DB, justifiée par le gain type-safety.
- `Site` gagne 8 colonnes scalaires (4 accessNotes + 4 serverInfo) ; reste dans des proportions raisonnables sur un modèle existant (~30 colonnes au total).

---

## Alternatives considérées

1. **Garder `Tenant.config` JSON, ne splitter que SSO** — rejeté. Demi-mesure qui laisse 4 sous-objets en JSON faiblement typé.
2. **Faire `Site.contacts` en cible principale, reporter Tenant.config** — rejeté. `Tenant.config` est plus impactant (5 sous-objets vs 1 array, dont des secrets).
3. **`SiteHealthSnapshot.components` en table normalisée** — rejeté pour raison de coût write (cf. Décision C).
4. **Splitter `NotificationConfig` dans la même session** — rejeté, ampleur trop grande, tests héritage manquants.
5. **Différer S6/S7 et tag v1.6.0 maintenant** — rejeté. Le tag v1.6.0 prévoyait précisément la fin de la dette JSON. Tagger maintenant désaligne intent vs livré.

---

## Suivi — séquencement des tâches

Ordre d'exécution :

1. **Cible A — Asset.networkInfo split** (~1h30). Migration `2_asset_network_info_split` + refacto backend (DTO, services, seed) + frontend (types, formulaires, components).
2. **Cible B — Tenant.config split intégral** (~2h30). Migration `3_tenant_config_split` + 5 nouvelles tables (`TenantFeatureFlag` 1:N + 4 modèles 1:0..1) + refacto `tenants.service`, `users.service.getEffectiveAppearance`, `module.guard`, `oidc.strategy`, `consumption.service`, `setup.service`, `seed.service`, mocks tests.
3. **Cible C — Site.healthBreakdown extraction** (~45 min). Migration `4_site_health_snapshot` + `recomputeSite()` upsert + 3 fichiers frontend.
4. **Cible D — Site JSON cleanup** (~1h30). Migration `5_site_json_cleanup` (4 sous-cibles : contacts → table existante, accessNotes → 4 Text columns, emplacements → table + enum, metadata.serverInfo → 4 scalaires + drop metadata) + refacto `sites.service`, DTO, seed, formulaires frontend, export PDF.
5. **Smoke complet xch-deploy** : reset → migrate → seed → login → vérification des 4 cibles via UI + requêtes SQL `\d sites`, `SELECT * FROM tenant_feature_flags`, etc.
6. **Bump version 1.5.0 → 1.6.0** dans `backend/package.json` + `frontend/package.json`.
7. **Tag `v1.6.0`** + push tag.
8. **Mise à jour mémoire MCP** + `MEMORY.md` + `PROJECT_STATUS.md` + `DEVELOPMENT_LOG.md`.
9. **Rapport final** + prompt suivant (UX/UI globale, session séparée).

---

## Références

- [ADR-013](adr-013-residual-json-debt.md) — origine de la dette « JSON sac », poches identifiées.
- [ADR-016](adr-016-monitoring-unification.md) lot E — premier nettoyage `Asset.networkInfo` (drop monitor*).
- [ADR-017](adr-017-prisma-versioned-migrations.md) — infra de migrations versionnées requise pour ces drops.
- Plan v2 sessions S6 + S7 (mémoire `project_plan_v2.md`).
- Principe directeur XCH 2026-04-20 : « Toujours faire propre, pas de dette technique ».
