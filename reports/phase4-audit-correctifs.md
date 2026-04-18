# Phase 4 — Correctifs post-audit Claude-Chrome

**Date :** 2026-04-18
**Version livrée :** v1.4.0
**Source audit :** exploration Claude-Chrome multi-rôle sur `https://xch.eoncom.io`
(4 comptes démo : admin, manager, technicien, viewer).

---

## Résumé

L'audit de phase 4 a relevé **8 bugs critiques/majeurs + 11 mineurs + 13 points UX**.
La v1.4.0 couvre tous les bugs critiques et majeurs ainsi que la majorité des mineurs.
Quelques points UX non bloquants sont documentés comme « déférés » ci-dessous avec
justification.

L'occasion a aussi été prise de livrer la **feature Apparence** (tenant defaults +
user override avec verrou admin, ADR-010) et de **reconstruire la base démo** pour
qu'elle reflète l'architecture courante (3 délégations, AccessOverride, Budget,
UserNotification, AuditLog, multi-delegation user).

---

## Findings traités

| ID | Sévérité | Fichiers principaux | Statut | Commit |
|----|----------|---------------------|--------|--------|
| **C1** — Viewer (READ) peut accéder à `/sites/[id]/edit` | 🔴 CRITIQUE | `frontend/src/app/dashboard/sites/[id]/edit/page.tsx` + `frontend/src/app/dashboard/sites/[id]/page.tsx` (SiteEditIconLink) | ✅ Fixé | `c3836ad` + ce PR |
| **C2** — Viewer accède à `/dashboard/users` avec boutons Modifier/Supprimer | 🔴 CRITIQUE | `backend/src/modules/users/users.controller.ts` (`@RequireManage()`) + `frontend/src/app/dashboard/users/page.tsx` (AccessGate + canAct) | ✅ Fixé | `c3836ad` + ce PR |
| **C3** — Manager voit moins de users que Viewer | 🔴 CRITIQUE | `backend/src/modules/users/users.service.ts` (`resolveManageScope` + union) | ✅ Fixé | `c3836ad` |
| **M1** — Lien Paramètres absent pour WRITE/READ | 🟠 MAJEUR | `frontend/src/app/dashboard/layout.tsx` (section « Personnel ») | ✅ Fixé | ce PR |
| **M2a** — Profil affiche enum brut (MANAGE/WRITE/READ) | 🟠 MAJEUR | `frontend/src/lib/labels.ts` + `frontend/src/app/dashboard/settings/page.tsx` (`profileRightLabel`) | ✅ Fixé | ce PR |
| **M2b** — Technicien WRITE affiche « READ » dans Profil | 🟠 MAJEUR | `frontend/src/app/dashboard/settings/page.tsx` (meilleur droit parmi toutes les délégations) | ✅ Fixé | ce PR |
| **M3** — Manager voit les événements de toutes les délégations dans l'audit | 🟠 MAJEUR | `backend/src/modules/audit/audit.controller.ts` (super-admin only) + `frontend/src/app/dashboard/admin/audit/page.tsx` (AccessGate super-admin) | ✅ Fixé | `c3836ad` + ce PR |
| **M4** — Champ « Téléphone » = email pour tous les users | 🟠 MAJEUR (seed) | Reset DB + `SeedService.createUsers` | ✅ Fixé (reset + re-seed) | ce PR |
| **M5** — URL NetBox = email au lieu d'une URL | 🟡 MINEUR (seed) | Reset DB (champ laissé vide par défaut) | ✅ Fixé (reset) | ce PR |
| **m1** — Mot de passe actuel pré-rempli par l'autocomplete | 🟡 MINEUR | `frontend/src/app/dashboard/settings/page.tsx` (dummy username + autoComplete new-password) | ✅ Fixé | ce PR |
| **m2** — Dashboard Alertes (2) ≠ /alerts (3) | 🟡 MINEUR | — | ⏸ Déféré | — |
| **m3** — Dashboard TV « Alertes actives » (0) vs /alerts (3) | 🟡 MINEUR | `frontend/src/app/tv/page.tsx` (titre « Alertes monitoring » + clarification) | ✅ Partiellement résolu (renommé + expliqué) | ce PR |
| **m4** — Manager voit « By SuperAdmin » dans le filtre Délégation | 🟠 MAJEUR (reclassé) | `backend/src/modules/organization/organization.{controller,service}.ts` | ✅ Fixé | `c3836ad` |
| **m5,m6** — Badges HEALTHY/ACTIVE/PREPARATION non traduits | 🟡 MINEUR | `frontend/src/lib/labels.ts` + `frontend/src/app/dashboard/sites/page.tsx` | ✅ Fixé | ce PR |
| **Typo Portee** — Coûts × Dépenses, Coûts × Entités, Contacts, Contacts (nouveau) | 🟡 MINEUR | 4 fichiers | ✅ Fixé | ce PR |
| **Placeholder logo Tenant** — `https://example.com/logo.png` | 🟡 MINEUR (seed) | Seed ne stomp pas la config tenant ; operator → vide lors du reset | ✅ Fixé (reset) | ce PR |
| **Monitoring — lien vers « Intégrations » inexistant** | 🟡 MINEUR | `frontend/src/app/dashboard/monitoring/page.tsx` | ✅ Fixé | ce PR |
| **Nom « Lyon Métropole (éditée) »** | 🟡 MINEUR (seed) | `SeedService.createOrganization` upsert.update force le nom | ✅ Fixé (reset + re-seed) | ce PR |
| **Plan « jih v1 »** | 🟡 MINEUR (seed) | Reset DB — plan artifact non re-créé | ✅ Fixé (reset) | ce PR |
| **Badge sidebar « MANAGE »** non traduit | 🟡 MINEUR | `frontend/src/app/dashboard/layout.tsx` (rightLabel) | ✅ Fixé | ce PR |

## Findings déférés

| ID | Raison | Ticket suivi |
|----|--------|--------------|
| 2FA réel | Hors scope de la mission (rapport d'audit n'en parlait pas). | Roadmap post-MVP. |

**Findings initialement déférés, résolus dans le commit `30cac1f` (Lot 4 final)** :
- **m2/m3** — Alertes dashboard vs /alerts vs TV : désormais unifiées via
  `frontend/src/lib/alerts.ts::computeAlerts()`. Règles de dedup cohérentes
  (BLOCKED > URGENT > OVERDUE). Le TV garde volontairement son périmètre NOC
  (monitoring uniquement) avec note explicative vers `/dashboard/alerts`.
- **m11** — Consommation vs Équipements : encart explicatif UX ajouté sur
  `/dashboard/consumption` (différence baies/racine, asset watts déclarés).
- **m12** — Placeholder tenant logo « https://example.com/logo.png » : placeholder
  Input remplacé par une instruction FR, exemple Swagger du DTO setup épuré.

---

## Feature Apparence (résumé implémentation)

**Backend** :
- DTOs `AppearancePayload` / `UpdateTenantAppearanceDto` / `UpdateUserAppearanceDto`
  (whitelist `theme`, format `#rrggbb` sur `primaryColor`, enum `density`).
- `TenantsService.getAppearanceConfig` / `updateAppearanceConfig` (audit log).
- `UsersService.getMyAppearance` / `updateMyAppearance` / `getEffectiveAppearance`.
- Endpoints `@SkipDelegation + @RequireManage` (tenant write = super admin) ou
  `@SkipDelegation` seul (user-scoped /me).

**Frontend** :
- `AppearanceProvider` enrobe `DashboardLayout` — charge
  `GET /users/me/effective-appearance` au mount, applique `data-density`,
  `--primary-rgb` et bridge `next-themes`.
- Cards `AppearancePreferencesCard` (source + density + reset-to-tenant) et
  `TenantAppearanceCard` (super admin : theme, density, primaryColor, toggle
  `allowUserOverride`) ajoutées en bas de l'onglet Apparence.

**Tests fonctionnels post-reset** :
- Super admin modifie `density=compact` sur le tenant → apparence « hérité » des
  4 comptes démo bascule en compact après refresh.
- Super admin bascule `allowUserOverride=false` → card « Mes préférences » devient
  « Verrouillé par l'administrateur », PATCH `/users/me/appearance` renvoie 403 FR.
- `technicien@demo.fr` se connecte → apparence `dark + compact` appliquée
  immédiatement (seed).

**ADR :** `docs/decisions/adr-010-appearance.md`.

---

## Donnée démo — état final

Reset complet effectué via `prisma db push --force-reset --accept-data-loss` puis
re-seed via le setup wizard (`POST /api/setup/initialize` avec `loadDemoData:true`).
Credentials démo inchangés : `@demo.fr` / `demo123`.

**Entités seedées (résumé)** :
- **3 délégations** : IDF Ouest, Lyon Métropole, Marseille.
- **8 sites** : 6 en IDF Ouest + Lyon Part-Dieu + Marseille Euromed, tous avec
  coordonnées GPS.
- **6 utilisateurs démo** :
  - `admin@demo.fr` — Super Admin (MANAGE auto sur toutes les délégations via
    `syncSuperAdminDelegations`).
  - `manager@demo.fr` — MANAGE sur IDF, Lyon, Marseille.
  - `technicien@demo.fr` — WRITE sur IDF. Appearance custom dark+compact.
  - `technicien2@demo.fr` — WRITE sur IDF.
  - `viewer@demo.fr` — READ sur IDF.
  - `multi@demo.fr` — MANAGE sur IDF + Lyon, READ sur Marseille (exerce le switcher
    multi-délégation).
- **14 racks** (IDF), **~83 assets**, **12 tâches**, **10 contact-types**,
  **10 contacts fournisseurs**.
- **2 AccessOverride** : 1 ALLOW (viewer → WRITE sur La Défense temporaire),
  1 DENY (technicien blacklisté sur Boulogne).
- **1 Budget** (annuel IDF 120 k€), **3 BillingEntity** (DSI-IT, BU-IDF, BU-LYON),
  **1 Expense récurrente** avec CostAllocation 60/40.
- **5 ConnectivityLink** (miroir structuré du `Site.connectivity` JSON).
- **3 UserNotification non-lues** (Manager + Technicien).
- **2 AuditLog** initiaux.
- **Tenant.config.appearance** seedé avec les défauts `{ theme:'system',
  primaryColor: tenant.primaryColor, density:'comfortable', allowUserOverride:true }`.

**Vérifications post-reset** :
- ✅ Login 4 rôles (`admin` / `manager` / `technicien` / `viewer`) + `multi@demo.fr`.
- ✅ Manager voit 6+ utilisateurs (tous membres IDF ∪ Lyon ∪ Marseille).
- ✅ Viewer obtient 403 sur `/dashboard/users`.
- ✅ Viewer obtient 403 sur `/dashboard/sites/[id]/edit`.
- ✅ Viewer obtient 403 sur `/dashboard/admin/audit`.
- ✅ Filtre Délégation ne montre plus « By SuperAdmin » aux non-super-admins.
- ✅ Apparence custom de Marc Leroy effective (dark + compact).

---

## Vérifications finales (matrice rôle × page × action)

| Rôle | `/dashboard/users` | `/sites/[id]/edit` | `/admin/audit` | Sidebar « Paramètres » | Profil « Rôle » |
|------|--------------------|--------------------|----------------|------------------------|-----------------|
| Super Admin | ✅ tous les users | ✅ | ✅ | ✅ (sans « Administration » Paramètres — mais section Personnel OK) | `Super Admin` |
| Manager MANAGE (1+ déleg) | ✅ users de ses délégations | ✅ | ❌ 403 avec message | ✅ | `Administrateur` |
| Tech WRITE | ❌ 403 AccessGate | ✅ | ❌ 403 | ✅ | `Éditeur` |
| Viewer READ | ❌ 403 AccessGate | ❌ 403 AccessGate (+ backend PATCH 403) | ❌ 403 | ✅ | `Lecteur` |

Tous les fix ont été testés via `curl` (RBAC backend direct) **et** via Claude-Chrome
(UI end-to-end) sur `https://xch.eoncom.io` après reset + re-seed.

---

*Rapport clos le 2026-04-18.*
