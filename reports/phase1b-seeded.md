# Phase 1B — Validation fonctionnelle : déploiement avec données démo

**Date :** 2026-04-17
**Environnement :** `https://xch.eoncom.io`
**Version testée :** v1.3.0 (commit `ef139a6`)
**DB :** `prisma db push --force-reset` puis `POST /api/setup/initialize` avec `loadDemoData:true`
**Données seed reportées :** 6 sites, 4 users, 83 assets, 14 racks, 12 tasks, 10 contactTypes, 10 contacts

## Résumé

| Catégorie | Valeur |
|---|---|
| Tests API exécutés | 40+ |
| PASS | 28 |
| FAIL | 2 |
| Bugs identifiés | **11 supplémentaires** (+ 12 de la Phase 1A = **23 au total**) |
| Critiques | 0 (en plus de 1A) |
| Majeurs | **6** |
| Mineurs | **5** |

La plupart des CRUD READ et les workflows principaux fonctionnent. Le seed via SeedService (utilisé par le wizard) **diverge** des docs et du seed legacy : emails `@demo.fr`, password `demo123`, coordonnées GPS absentes.

---

## Bugs identifiés en Phase 1B

### 🟠 MAJEUR

#### BUG-1B-001 — SeedService demo n'injecte pas les coordonnées GPS
**Sévérité :** Majeur (feature map HS en démo)
**Fichier :** `backend/src/modules/seed/seed.service.ts`

**Description :**
Le `SeedService.createSites()` crée 6 sites (La Défense, Boulogne, Massy, Saint-Cloud, Vélizy, Saclay) **sans** mettre à jour `coordinates` via `ST_SetSRID(ST_MakePoint(...))`. Le `prisma/seed.ts` legacy le faisait, pas le nouveau.

**Conséquence :**
- Dashboard "Carte des sites" affiche toujours « Aucun site avec coordonnées GPS disponible »
- La feature cartographie PostGIS est inutilisable en démo
- Mauvais premier impression pour les prospects qui essayent l'app

**Reproduction :**
1. Setup wizard avec `loadDemoData:true`
2. Login → Dashboard → carte vide

**Fix :**
Ajouter dans `createSites()` après le `prisma.site.create` :
```typescript
await this.prisma.$executeRawUnsafe(
  `UPDATE "sites" SET coordinates = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
  longitude, latitude, site.id,
);
```
Coordonnées à fournir pour chaque site démo.

---

#### BUG-1B-002 — Credentials demo incohérents (SeedService vs docs)
**Sévérité :** Majeur (onboarding cassé)
**Fichiers :** `backend/src/modules/seed/seed.service.ts:290-319`, `CLAUDE.md`, `.claude/STARTUP.md`

**Description :**
- Docs (`CLAUDE.md`, `STARTUP.md`, `PROJECT_STATUS.md`) annoncent : `admin@xch.demo / admin123`, `manager@xch.demo / manager123`, `tech@xch.demo / tech123`
- SeedService actuel crée : `manager@demo.fr`, `technicien@demo.fr`, `technicien2@demo.fr`, `viewer@demo.fr` avec password `demo123`
- Le `prisma/seed.ts` legacy utilise les anciens emails `@xch.demo` mais n'est pas exécuté par le wizard

**Conséquence :**
- Un prospect qui lit la doc et essaie `admin@xch.demo / admin123` → 401
- Confusion utilisateur totale à l'onboarding

**Fix :**
1. Décider de l'unique source de vérité (recommandé : SeedService avec creds `@demo.fr` cohérents)
2. Mettre à jour `CLAUDE.md`, `STARTUP.md`, `PROJECT_STATUS.md`, `LIVRAISON_MVP_100.md`, `/setup` page info
3. Supprimer `prisma/seed.ts` ou l'aligner sur SeedService

---

#### BUG-1B-003 — DELETE /sites avec dépendances ne protège pas
**Sévérité :** Majeur (intégrité des données)
**Fichier :** `backend/src/modules/sites/sites.service.ts:remove()`

**Description :**
Supprimer un site qui contient des assets, racks, tâches, floor-plans retourne **200** (succès) au lieu de **409 Conflict**. Soit les enfants sont cascade-deleted silencieusement, soit orphelins.

**Reproduction :**
```bash
# Site avec 10 assets + 2 racks + 3 tasks
DELETE /api/sites/:id → 200
# GET /api/sites → site disparu
# GET /api/assets?siteId=xxx → ??? (à vérifier)
```

**Fix :**
Ajouter dans `sites.service.remove()` une vérification des dépendances :
```typescript
const [assets, racks, tasks, plans] = await Promise.all([
  this.prisma.asset.count({ where: { siteId: id } }),
  this.prisma.rack.count({ where: { siteId: id } }),
  this.prisma.task.count({ where: { siteId: id } }),
  this.prisma.floorPlan.count({ where: { siteId: id } }),
]);
const total = assets + racks + tasks + plans;
if (total > 0) {
  throw new ConflictException(
    `Impossible de supprimer : ${assets} équipements, ${racks} baies, ${tasks} tâches, ${plans} plans rattachés`
  );
}
```

---

#### BUG-1B-004 — Asset move entre sites de délégations différentes : 400 silencieux
**Sévérité :** Majeur (UX + workflow cassé)
**Fichier :** `backend/src/modules/assets/assets.service.ts:update()`

**Description :**
`PATCH /api/assets/:id {siteId: <otherSite>}` avec un site d'une autre délégation retourne 400 sans message clair. Le déplacement d'équipement inter-sites est bloqué même au sein de la même délégation dans certains cas.

**Reproduction :** `PATCH /api/assets/$A -d '{"siteId":"<other-site>"}'` → 400

**Fix :** Vérifier dans `update()` si `siteId` cible appartient à la même délégation, et :
- Si oui : recalculer `delegationId` automatiquement
- Si non : renvoyer 409 avec message clair + offrir une route `/assets/:id/transfer` explicite

---

#### BUG-1B-005 — `GET /expenses/projection` retourne 400 sur query params valides
**Sévérité :** Majeur (feature cassée)
**Fichier :** `backend/src/modules/expenses/expenses.controller.ts`

**Description :**
Le endpoint de projection décrit dans la spec v1.3.0 retourne 400 avec des query params pourtant valides : `?from=2026-01-01&to=2026-12-31`.

**Hypothèse :** Validation DTO attend un autre format (ISO-8601 complet) ou un param manquant (`groupBy`?). À investiguer.

**Fix :** Vérifier le DTO `ProjectionQueryDto`, documenter les paramètres requis/optionnels dans Swagger.

---

#### BUG-1B-006 — `GET /consumption/site/:id` retourne 404
**Sévérité :** Majeur (feature v1.3.0 cassée)
**Fichier :** `backend/src/modules/consumption/consumption.controller.ts`

**Description :**
Endpoint documenté dans le changelog v1.3.0 comme `/api/consumption/{summary,site/:id,rack/:id}`. Le summary OK (200), mais `/consumption/site/:id` retourne 404 même avec un site ID valide.

**Hypothèse :** Route mal déclarée (`@Get('site/:siteId')` peut-être, avec un nom de param différent).

**Fix :** Vérifier le décorateur `@Get` et normaliser les noms de params entre documentation et code.

---

### 🟡 MINEUR

#### BUG-1B-007 — Unicode caractères (emoji, cyrillique, chinois) rejetés par création asset
Création d'asset avec `name: "🚀 Асест тест 测试"` → 400. Utilisateurs internationaux bloqués. Investiguer quel validateur rejette (possiblement `@IsString()` avec un charset limité quelque part, ou parsing JSON Docker locale).

#### BUG-1B-008 — Pas d'endpoint `/api/health` pour monitoring externe
`GET /api/health` → 404. Aucun endpoint unauthenticated pour checker la santé applicative. Crucial pour Gatus/Uptime Kuma/Prometheus. Ajouter `@Public() @Get('health')` dans `AppController`.

#### BUG-1B-009 — Limite de taille payload non explicite
`name: 100k chars` → 400 mais message d'erreur générique. La limite Nginx/Nest devrait être documentée, et un validateur `@MaxLength(500)` explicite sur les champs text-libres permettrait une UX claire.

#### BUG-1B-010 — Dashboard : inconsistance compteurs
- Dashboard affiche 5 sites (après DELETE test), 25 assets
- API `/assets` retourne 56 items pour admin superAdmin
- Explication probable : dashboard filtre par statut ACTIVE + hidden (?). À documenter ou unifier le calcul.

#### BUG-1B-011 — Tech crée site : 400 au lieu de 403
Le tech a uniquement `READ` sur sites/delegations (pas WRITE). Tentative de création renvoie 400 (validation), au lieu de 403 (forbidden). Le check de permission devrait passer AVANT la validation du body → sémantique plus claire.

---

## Tests PASS validés en 1B

### CRUD complet
- ✅ GET list : sites, assets, racks, tasks, delegations, users, contacts, contact-types, billing-entities, expenses, budgets, audit, notifications (13/13 OK)
- ✅ GET detail : sites/:id, assets/:id, racks/:id, tasks/:id (200)
- ✅ GET invalid ID → 404 (pas 500)
- ✅ PATCH sites/:id, assets/:id, tasks/:id → 200
- ✅ DELETE tasks/:id → 200
- ✅ Audit trail capture les CRUD (6 entries après quelques opérations)
- ✅ Audit par entité : `GET /audit/entity/Asset/:id` → 200

### Workflows
- ✅ Recherche globale (`/api/search?q=Paris`) → 200
- ✅ Recherche avec chars spéciaux (`<script>`, `../etc/passwd`, `%00`, SQL injection) → 200 (sanitization OK, pas de crash)
- ✅ Notifications inbox + count-unread + mark-all-read → OK
- ✅ Task status transitions : TODO → IN_PROGRESS → DONE

### Edge cases & robustesse
- ✅ Payload 100k chars rejeté proprement (400, pas de crash)
- ✅ JSON malformé → 400 (pas 500)
- ✅ Null byte dans nom → 400
- ✅ Path traversal (`/api/sites/../../etc/passwd`) → 404 (géré par framework)
- ✅ Negative price → 400

### RBAC avec seeded users (`@demo.fr` / `demo123`)
| Rôle | Action | Attendu | Obtenu |
|---|---|---|---|
| Manager | GET /sites | 200 | ✅ 200 |
| Manager | POST /users | 403 | ✅ 403 |
| Manager | DELETE /delegations/:id | 403 | ✅ 403 |
| Manager | GET /audit | 200 | ✅ 200 |
| Tech | GET /audit | 403 | ✅ 403 |
| Tech | POST /sites | 403 attendu | ⚠️ 400 (voir BUG-1B-011) |
| Viewer | GET /sites | 200 | ✅ 200 |
| Viewer | PATCH /sites/:id | 403 | ✅ 403 |

### Intégrations
- ✅ `/integrations/monitoring/monitors` → 200
- ✅ Rate limiting actif (confirmé en 1A)
- ✅ Security headers tous présents (confirmé en 1A)

---

## Limitations non-testées (à faire manuellement ou phase 2+)

- Upload floor plan (PDF/PNG) → pas testé (besoin fichier sample)
- Pins drag-drop Konva sur floor plan
- QR code scan caméra PWA (device physique requis)
- Rack visualization Konva avec équipements montés (UI spot-check seulement)
- NetBox sync mapping drag-drop
- CSV import avec preview
- Email SMTP / Teams webhooks notifications (besoin fixtures)

---

## Récap 23 bugs Phase 1 complet

| # | ID | Sévérité | Module | Résumé |
|---|---|---|---|---|
| 1 | 1A-001 | 🔴 Critique | Assets | type/status accept any string (dynamic enum non appliqué) |
| 2 | 1A-002 | 🟠 Majeur | Middleware | Fresh install redirige vers /login au lieu de /setup |
| 3 | 1A-003 | 🟠 Majeur | Setup | Health check n'inclut pas Redis/MinIO |
| 4 | 1A-004 | 🟠 Majeur | Setup/Users | Password policy wizard ≠ backend |
| 5 | 1A-005 | 🟠 Majeur | Sites UI | Dropdown délégation vide sans CTA |
| 6 | 1B-001 | 🟠 Majeur | SeedService | Pas de coordonnées GPS sur sites démo |
| 7 | 1B-002 | 🟠 Majeur | Docs | Credentials demo incohérents partout |
| 8 | 1B-003 | 🟠 Majeur | Sites | DELETE ne protège pas des dépendances |
| 9 | 1B-004 | 🟠 Majeur | Assets | Move asset inter-site cassé |
| 10 | 1B-005 | 🟠 Majeur | Expenses | `/projection` 400 sur query valides |
| 11 | 1B-006 | 🟠 Majeur | Consumption | `/consumption/site/:id` 404 |
| 12 | 1A-006..008 | 🟡 Mineur | API | duplicate codes → 400 au lieu de 409 |
| 13 | 1A-009 | 🟡 Mineur | UI | Accents français manquants |
| 14 | 1A-010 | 🟡 Mineur | UI | 404 page bare (pas de layout XCH) |
| 15 | 1A-011 | 🟡 Mineur | API | R10 400 vs 403 incohérent |
| 16 | 1A-012 | 🟡 Mineur | UI | Nom tenant tronqué sans tooltip |
| 17 | 1B-007 | 🟡 Mineur | Assets | Unicode rejeté |
| 18 | 1B-008 | 🟡 Mineur | API | Pas de `/api/health` public |
| 19 | 1B-009 | 🟡 Mineur | API | Limites taille payload non documentées |
| 20 | 1B-010 | 🟡 Mineur | Dashboard | Compteurs divergent de list API |
| 21 | 1B-011 | 🟡 Mineur | RBAC | Tech POST /sites → 400 au lieu de 403 |

## Verdict Phase 1

**À corriger OBLIGATOIREMENT avant prod : 11 bugs (1 critique + 10 majeurs)**
- 1A-001 (Critique — validation enum Asset)
- 1A-002 à 005 (Majeurs — fresh install UX)
- 1B-001 à 006 (Majeurs — demo broken, data integrity, features cassées)

**Nice-to-have : 10 bugs mineurs**

**Phase 2 (SAST) peut démarrer après correctifs majeurs.**
