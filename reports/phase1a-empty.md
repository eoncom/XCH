# Phase 1A — Validation fonctionnelle : déploiement vierge

**Date :** 2026-04-17
**Environnement :** `https://xch.eoncom.io` (dev, Docker Compose)
**Version testée :** v1.3.0 (commit `ef139a6`)
**DB :** `prisma db push --force-reset --accept-data-loss` puis setup wizard sans `loadDemoData`
**Auteur :** Claude (audit automatisé, validation Chrome DevTools + API curl)

## Résumé

| Catégorie | Valeur |
|---|---|
| Tests API exécutés | 25+ |
| PASS | 14 |
| FAIL (tests script) | 3 (dus à DTO field names — corrigés en analyse, pas des bugs backend) |
| Bugs identifiés | **12** |
| Critiques | **1** |
| Majeurs | **4** |
| Mineurs | **7** |

Setup wizard fonctionne end-to-end. Empty state propre. Backend accepte la majorité des opérations. **Un bug critique** sur la validation des enums dynamiques (Asset type/status) permet d'injecter n'importe quelle valeur.

---

## Bugs identifiés

### 🔴 CRITIQUE

#### BUG-1A-001 — Validation enums Asset absente sur CREATE/UPDATE
**Sévérité :** Critique (data integrity + XSS vector potentiel)
**Impact :** Tous environnements
**Fichier :** `backend/src/modules/assets/dto/create-asset.dto.ts` (lignes 7-8, 49-52) + `assets.service.ts:create()` (ligne 32+)

**Description :**
Les champs `type` et `status` du DTO `CreateAssetDto` sont typés `@IsString()` seulement. Les commentaires indiquent "dynamic via EnumLabel" mais aucune validation n'est appliquée côté DTO ou service. La validation par `KNOWN_ASSET_TYPES`/`KNOWN_ASSET_STATUSES` existe uniquement dans `importFromCsv()` (ligne 737), jamais dans `create()`.

**Reproduction :**
```bash
POST /api/assets
{"name":"x","type":"INVALID_TYPE","serialNumber":"SN-BAD","siteId":"<id>","status":"UNKNOWN"}
→ 201 Created (devrait être 400)
```

**Tests concluants :**
- `type=INVALID_TYPE` → 201
- `status=INVALID` → 201
- `name=<script>alert(1)</script>` → 201 (stocké tel quel ; React escape à l'affichage, donc pas de XSS exploitable pour l'instant, mais **changera** si un futur composant utilise `dangerouslySetInnerHTML`)

**Conséquences :**
- Pollution des données : icons, filtres, groupings cassés silencieusement
- Surface XSS latente (si rendering par `innerHTML` ajouté quelque part)
- Rapports de coûts/consommation faussés si `type` = string libre
- Contradiction avec la promesse v1.3 de types dynamiques validés via `EnumLabel`

**Fix recommandé :**
- Ajouter validateur `@IsDynamicEnum('AssetType')` qui check contre `DEFAULT_LABELS.AssetType` + `EnumLabel` custom (isActive=true)
- Appliquer aussi sur le `update-asset.dto.ts`
- Appliquer le même pattern sur `pins` (`pinType`)

---

### 🟠 MAJEUR

#### BUG-1A-002 — Fresh install ne redirige pas vers /setup
**Sévérité :** Majeur (UX bloquant pour le premier déploiement)
**Fichier :** `frontend/src/middleware.ts`

**Description :**
Sur une instance neuve (aucun tenant), visiter `https://xch.eoncom.io/` envoie l'utilisateur sur `/login` alors qu'il n'y a aucun compte. Le wizard d'installation est à `/setup` mais n'est jamais atteint automatiquement.

**Reproduction :**
1. `prisma db push --force-reset` (aucun tenant)
2. Visiter `/` ou `/dashboard` → redirect vers `/login` avec formulaire vide
3. L'utilisateur ne sait pas qu'il doit aller sur `/setup`

**Fix recommandé :**
```typescript
// Dans middleware.ts, avant la vérification token :
if (pathname === '/' || pathname === '/login') {
  // Check needs-setup via HEAD /api/setup/status si cookie d'état non présent
  // Ou plus simple : ajouter un check dans la page /login elle-même
}
```
Alternative : la page `/login` fait déjà `setupApi.getStatus()` au mount et redirige → à vérifier et implémenter si absent.

---

#### BUG-1A-003 — Wizard : health check incomplet
**Sévérité :** Majeur (fausse confiance pour l'admin)
**Fichier :** `backend/src/modules/setup/setup.service.ts:getStatus()`

**Description :**
Le wizard affiche "Services détectés : PostgreSQL ✓" mais ne teste **pas** Redis et MinIO, qui sont pourtant requis (sessions, stockage fichiers). Si MinIO/Redis down, l'app démarrera mais cassera silencieusement (upload plans, QR codes, sessions).

**Reproduction :**
- Arrêter `xch-redis` et `xch-minio`, lancer setup → pas d'erreur détectée
- Créer un plan d'étage ou QR → échec

**Fix recommandé :**
Ajouter dans `getStatus()` :
```typescript
try { await this.redisClient.ping(); services.push({name:'Redis',status:'ok'}); }
catch { services.push({name:'Redis',status:'error',message:'Cannot reach Redis'}); }
// Idem MinIO via /minio/health/live
```

---

#### BUG-1A-004 — Politique mot de passe incohérente (wizard vs backend)
**Sévérité :** Majeur (sécurité)
**Fichiers :**
- `frontend/src/app/setup/page.tsx:115-119` (front: 8 chars min seulement)
- `backend/src/modules/users/dto/create-user.dto.ts` (back: regex upper+lower+digit)

**Description :**
Le wizard accepte un mot de passe de 8 chars sans complexité (ex: `12345678`), mais la création de users subséquente l'exige (`^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$`). Résultat : un admin peut être créé avec un mot de passe faible (e.g. `password`), pendant qu'un manager créé après devra respecter la complexité. Asymétrie problématique.

**Fix recommandé :**
- Appliquer la même regex dans `SetupDto` (et dans `/setup/page.tsx` validation client)
- Considérer ajouter la contrainte "pas de caractère spécial requis" dans le texte d'aide du wizard

---

#### BUG-1A-005 — Dropdown Délégation sur formulaire Site reste vide (empty state)
**Sévérité :** Majeur (UX bloquant pour l'admin du premier jour)
**Fichier :** `frontend/src/app/dashboard/sites/new/page.tsx`

**Description :**
Sur une instance sans délégation, le menu Sites mène au formulaire, dont le champ Délégation est requis mais son dropdown est vide et sans option pour créer une délégation inline. Pas de message "Créez d'abord une délégation dans Paramètres > Structure". L'admin est bloqué sans savoir quoi faire.

**Fix recommandé :**
- Sur la liste Sites `/dashboard/sites`, si 0 délégation → afficher CTA "Créer une délégation d'abord" qui link vers `/dashboard/settings?tab=structure`
- Dans le dropdown : si 0 option → "Aucune délégation — cliquez pour en créer une" (dialog inline)

---

### 🟡 MINEUR

#### BUG-1A-006 — `duplicate site code` retourne 400 au lieu de 409
**Sévérité :** Mineur (sémantique API)
**Description :** Lorsqu'on crée un site avec un code existant, l'API renvoie `400 Bad Request` au lieu de `409 Conflict`. Semantique HTTP incorrecte pour les clients API.

#### BUG-1A-007 — `duplicate serial number` renvoie 400 au lieu de 409
Idem BUG-1A-006 pour `serialNumber` asset.

#### BUG-1A-008 — `duplicate email` renvoie 400 au lieu de 409
Idem pour user email. Note : certains de ces duplicates renvoient bien 409 dans le service (`ConflictException`), mais d'autres passent par des exceptions génériques de Prisma → normalisation nécessaire.

#### BUG-1A-009 — Accents français manquants dans l'UI
**Sévérité :** Mineur
**Endroits :** Tab "Structure" dans Paramètres (« creee », « controle », « acces », « delegation »), textes de création de délégation (« Creer »)

**Fix recommandé :** Activer la règle ESLint/Prettier pour détecter les chaînes sans accents OU passer le code en i18n avec un lint de complétude.

#### BUG-1A-010 — Page 404 bare (pas de layout XCH)
Visiter une URL invalide (ex: `/dashboard/search`) affiche la 404 Next.js par défaut (blanc, pas de sidebar). Devrait utiliser le layout XCH avec bouton "Retour dashboard".

#### BUG-1A-011 — `R10` violation 400 vs 403 incohérent
Selon la mémoire projet (R10), l'absence du header `X-Delegation-Id` doit renvoyer 400. En pratique : Admin retourne 400, Manager retourne 403. À unifier.

#### BUG-1A-012 — Nom tenant tronqué sans tooltip
Dans la sidebar, « EONCOM Test Vali… » affiche un texte tronqué, pas de tooltip au survol. Impacte les organisations aux noms longs.

---

## Tests PASS validés

### Sécurité & auth
- ✅ Admin login valide : 201 avec cookies `accessToken`/`refreshToken` httpOnly
- ✅ Mauvais mot de passe : 401
- ✅ SQL injection dans login : 401
- ✅ Password validation backend : short (5), no-digit, no-mixed-case → 400
- ✅ **Rate limiting activé** : 19/20 tentatives de login → 429
- ✅ Endpoints API sans auth → 401/403 (9 endpoints probés, tous protégés)
- ✅ Security headers complets : `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `Referrer-Policy`

### RBAC
- ✅ Manager sans délégation attribuée → 403 sur `/sites`
- ✅ Manager `POST /users` → 403 (admin-only)
- ✅ Manager `DELETE /delegations/:id` → 403

### Setup & CRUD
- ✅ Wizard 5 étapes complet jusqu'à "Accéder à XCH"
- ✅ Tenant + admin superadmin créés en DB
- ✅ Empty states dashboard cohérents (0 sites, 0 assets…)
- ✅ Dashboard cartographie affiche « Aucun site avec coordonnées GPS »
- ✅ CRUD complet : Délégation, Site, Asset (hors validation type), Task, Audit, Notifications inbox, Search, Utilisateur
- ✅ GPS auto-complété depuis adresse (Paris centre)
- ✅ R1 (cohérence delegationId/siteId) : mismatch → 400
- ✅ R10 (X-Delegation-Id requis) sur `POST /sites` : 400 sans header
- ✅ XSS `<script>alert(1)</script>` stocké mais correctement échappé par React à l'affichage

### Infrastructure
- ✅ PostgreSQL + Redis + MinIO tous healthy
- ✅ Nginx reverse proxy OK
- ✅ TLS/SSL fonctionnel (Let's Encrypt)

---

## Limitations de cette passe

Testé principalement via API. Couvertures UI limitées à quelques écrans (setup wizard, dashboard, assets list, settings structure). Tests non effectués en Phase 1A (à faire en 1B avec demo data) :
- Upload floor plan + édition pins Konva
- Drag-drop Kanban tasks
- QR code scan caméra (nécessite device physique)
- Visualisation rack Konva avec équipements montés
- Mapping NetBox drag-drop
- Import CSV assets avec preview
- Consommation électrique calculs
- Budget/coûts allocation
- Notifications email SMTP / Teams webhooks

Ces tests seront conduits en Phase 1B (données démo chargées).

---

## Score Phase 1A

- **Bloquant pour prod :** 1 (BUG-1A-001)
- **Fortement conseillé :** 4 (BUG-1A-002 à 005)
- **Nice-to-have :** 7 (BUG-1A-006 à 012)

**Verdict : À corriger bugs 1A-001 à 1A-005 avant la mise en production.**
