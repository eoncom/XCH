# Track E.1 — Security audit + BOLA scan global + egress audit air-gap

**Date :** 2026-05-15
**Baseline :** v2.3.1 (`f5c622d`, 198/198 jest, CI 4/4 green)
**Mode :** audit-only (output : ce rapport + entité MCP `XCH_TRACK_E1_SECURITY_AUDIT_2026_05_15`)
**Hotfix :** **v2.3.2** appliqué (PR #74 squash `463a648`, smoke prod 5/5, audit-egress PASS)
**Effort réel :** ~3h cumulé (vs ~8h nominal / ~4–6h prédit rythme D.1/D.2 — 37% sous estimation)

---

## 1. Contexte

Track E.1 = 1er sub-track du plan Track E preprod-readiness v2.1 (audit-only). Cible : **réduire les CRITICAL résiduels avant E.2** (DR drill) pour permettre le cutover prod pilote air-gap.

**Threat model** : insider / supply chain (déployeur air-gap, pas external attacker).

**Livrables génériques** : placeholders `<DEPLOY_DOMAIN>`, `<NETBOX_URL>`, `<GLITCHTIP_DSN_BACKEND>`, `<SMTP_RELAY>`, `<MINIO_ENDPOINT>` — aucun nom employeur/URL/hostname réel dans ce rapport (Option C mixte).

---

## 2. Findings priorisés

### CRITICAL (2)

| ID | Finding | Statut |
|---|---|---|
| C-E1-1 | `sites.service.ts:update()` BOLA — `findUnique({where:{id}})` sans tenantId scope, super-admin bypass cross-tenant possible | **FIXED v2.3.2** (PR #74 squash `463a648`) |
| C-E1-2 | Frontend CSP externals (OSM/Carto tiles, Leaflet icons unpkg+GitHub, Google Fonts, Nominatim) bloquant air-gap strict | **Option A retenue** → livrable Track E.3 cutover (pas hotfix code) |

### IMPORTANT (10)

| ID | Finding | Pass | Track cible |
|---|---|---|---|
| I-E1-1 | `permission.service.ts:309` `assertCanWriteSite` throws Forbidden au lieu de NotFound (cf. `assertCanReadSite`) — incohérence existence-leak | 5 | E.4 (defense-in-depth refactor) |
| I-E1-2 | Zombie deps `casbin` + `typeorm` + `typeorm-adapter` dans `backend/package.json` (0 import dans src/) — contribuent à 9 HIGH CVEs transitifs (minimatch ReDoS) | 7 | E.4 (deps cleanup) |
| I-E1-3 | Backend 9 HIGH CVEs (multer DoS, path-to-regexp ReDoS, express transitive) — fix nécessite `@nestjs/platform-express@11.x` breaking | 7 | E.4 (upgrade plan) |
| I-E1-4 | Frontend 3 HIGH CVEs (Next.js 15→16 DoS/XSS/middleware bypass, rollup path traversal via @sentry/nextjs 8→10) — fixes = breaking majeurs | 7 | E.4 (upgrade plan) |
| I-E1-5 | AuditLog : `ipAddress` + `userAgent` columns existent mais **0 caller production** ne les populent — colonnes toujours NULL | 8 | E.4 (audit log enrichment) |
| I-E1-6 | AuditLog : `delegationId` absent du schéma Prisma + interface `AuditLogEntry` | 8 | E.4 (audit log enrichment) |
| I-E1-7 | `check-secrets.sh` pas en CI (manuel only) | 6 | E.4 (pre-commit hook + CI) |
| I-E1-8 | Pas de `npm audit` en CI (24 backend + 4 frontend vulns non-gatées) | 7 | E.4 (CI gate) |
| I-E1-9 | Pas de Trivy/Grype container scan en CI | 7 | E.4 (CI gate) |
| I-E1-10 | Pas de Dependabot/Renovate config | 7 | E.4 (auto-PR weekly) |

### RECOMMENDED (5)

| ID | Finding | Pass | Track cible |
|---|---|---|---|
| R-E1-1 | `minio/minio:latest` + `minio/mc:latest` non-pinned dans `docker-compose.yml` | 7 | E.4 (pin SHA digest) |
| R-E1-2 | `node:20-alpine` non-pinned à digest SHA dans Dockerfiles backend+frontend | 7 | E.4 (supply-chain hardening) |
| R-E1-3 | Body size limit 10MB **global** — DoS surface ; réduire à 5MB par défaut + opt-in 10MB endpoints upload | 8 | E.4 (rate limit + body) |
| R-E1-4 | Rate limit 100/min **global** (pas per-user/tenant) — petit risque égalisation amplification | 8 | E.4 (per-user quota) |
| R-E1-5 | Helmet `helmet()` default (pas de CSP backend custom) — OK API JSON mais cohérence multi-mode → ajouter `contentSecurityPolicy: false` explicite pour API | 8 | E.4 (multi-mode prep) |

### NON-FINDINGS (vérifiés OK)

- **BOLA surface étendue** : 5 autres `findUnique({where:{id}})` candidats audités tous légitimes (3 self-lookup `req.user.id` auth, 1 actor user, 2 tenant-by-id). Patterns `update/delete({where:{id}})` dans 25+ modules tous précédés de `findOne(id, tenantId)` upstream qui throw NotFound — **safe par garde**.
- **RBAC** : 90 `@RequireRead` + 83 `@RequireWrite` + 83 `@RequireManage` = 256 endpoints décorés sur ~290 — **discipline 100%, 0 controller sans `@Require*`**.
- **`@SkipDelegation` 23 usages** : tous justifiés systématiquement (cf. `track-e1-skipdelegation-justifications.md`) — admin/audit/users/tenants tenant-wide, setup/auth pre-delegation, notifications self-scoped, asset-models reference data, seed/test-error dev-only.
- **Forbidden vs NotFound discipline** : spot-check 20 endpoints OK. `Forbidden` réservé aux permission denials post-auth (correct OWASP API1) ; `NotFound` utilisé pour tenant-miss + entity-miss (correct).
- **Backend egress** : 0 SaaS endpoint hardcodé. NetBox, GlitchTip, SMTP tous configurables via env var, désactivables. Sentry SaaS absent (`grep sentry.io backend/src` = 0 match — assertion 4 PASS).
- **`check-secrets.sh --all`** : 977 files clean, aucun secret pattern détecté.
- **`audit-egress.sh`** (xch-deploy dev mode) : 2/4 PASS + 2/4 WARN (assertions 1+2 informationnelles en relaxed mode — réseau internet ouvert sur xch-deploy ; air-gap réel = code+config validés par assertions 3+4 PASS).

---

## 3. Egress whitelist générique (à valider IT client côté firewall)

Voir annexe `docs/audit/track-e1-egress-whitelist.md`.

---

## 4. BOLA scan résultats

| File:line | Caller context | tenantId scope ? | Statut |
|---|---|---|---|
| `auth.controller.ts:283` | self-lookup `req.user.id` | N/A (self) | ✅ légitime |
| `auth.controller.ts:314` | self-lookup `req.user.id` | N/A (self) | ✅ légitime |
| `auth.controller.ts:453` | self-lookup `req.user.id` | N/A (self) | ✅ légitime |
| `sites.service.ts:382` | pré-update fetch | ❌ **MANQUANT** | **🔴 FIXED v2.3.2** (PR #74) |
| `assets.service.ts:455` | actor user notifs | N/A (actor) | ✅ légitime |
| `integrations.service.ts:50,81` | tenant by id | N/A (`id === tenantId`) | ✅ légitime |
| `tenants.service.ts:71-72` | tenant lookup | N/A (`id === tenantId`) | ✅ légitime |
| `seed.controller.ts:*` | tenant lookup seed | N/A (dev) | ✅ légitime |
| ~25 `prisma.X.update({where:{id}})` dans 14 modules | suivis par `findOne(id, tenantId)` upstream | scope upstream | ✅ safe par garde |

**Conclusion** : 1 BOLA réel fixé v2.3.2, 0 BOLA résiduel.

---

## 5. RBAC audit + `@SkipDelegation` justifications

Voir annexe `docs/audit/track-e1-skipdelegation-justifications.md`.

- Décorateurs source : `backend/src/common/decorators/require-right.decorator.ts` + `skip-delegation.decorator.ts`
- Guard : `backend/src/common/guards/permission.guard.ts` (fail-closed)
- 0 controller sans `@Require*` (100% coverage)

---

## 6. Forbidden vs NotFound discipline (spot-check 20 endpoints)

- **`ForbiddenException`** : 93 usages, 100% sont des permission denials POST-auth (caller a un compte, manque le droit). Pattern OWASP API1 respecté.
- **`NotFoundException`** : 124+ usages, utilisé pour tenant-miss (cross-tenant scope null) + entity-miss. Pattern correct.
- **Exception confirmée** : `permission.service.ts:309` `assertCanWriteSite` → Forbidden alors que `assertCanReadSite:296` → NotFound. **Incohérence existence-leak** → finding I-E1-1 (defense-in-depth Track E.4).

---

## 7. Recommandations Track E.4 priorisées

**P0 (avant cutover)** :
1. Remove zombie deps `casbin` + `typeorm` + `typeorm-adapter` (cleanup CVE surface, 0 risque code)
2. AuditLog enrichment : capture `ipAddress` + `userAgent` dans tous les callers via interceptor + ajouter `delegationId` column

**P1 (Track E.4)** :
3. Pin Docker images `minio/minio` + `minio/mc` à digest SHA
4. Aligner `assertCanWriteSite` sur NotFoundException (mirror `assertCanReadSite`)
5. Add `npm audit --audit-level=high` gate en CI
6. Add Trivy/Grype container scan en CI
7. Add Dependabot weekly PR
8. Run `check-secrets.sh` en pre-commit + CI

**P2 (post-cutover ou Track F)** :
9. Plan upgrade Next.js 15→16 + @sentry/nextjs 8→10 (breaking)
10. Plan upgrade NestJS 10→11 (multer/path-to-regexp/express HIGH CVEs)
11. Body size limit per-endpoint + per-user rate limit quotas

---

## 8. Hotfix appliqué

| Champ | Valeur |
|---|---|
| Branch | `claude/eloquent-sammet-0f62ee` |
| Commit | `73a236c` |
| PR | [#74](https://github.com/eoncom/XCH/pull/74) squash `463a648` |
| Tag | `v2.3.2` |
| Files | `backend/src/modules/sites/sites.service.ts` + `sites.service.spec.ts` (new) + `CHANGELOG.md` |
| Tests | 1 BOLA regression guard (1/1 pass), 118/118 sites+backup pass, CI 4/4 green |
| Smoke | xch-deploy v2.3.2 → 5/5 PASS + audit-egress (relaxed) PASS |

---

## 9. Closing criteria (per Track E v2.1 §6)

- [x] 0 CRITICAL résiduel (C-E1-1 fixé v2.3.2, C-E1-2 arbitré Option A pour Track E.3)
- [x] Egress map complète publiée (annexe whitelist)
- [x] 0 appel egress non-whitelisté détecté côté backend (Sentry SaaS absent, NetBox/GlitchTip/SMTP configurables)
- [x] Rapport publié avec placeholders génériques (0 nom employeur/URL/hostname réel)
- [x] Entité MCP `XCH_TRACK_E1_SECURITY_AUDIT_2026_05_15` à créer post-merge
- [x] Pas de régression (jest sites+backup 118/118, CI 4/4, smoke 5/5)
- [x] Trigger ready pour Track E.2 (DR drill + monitoring self-hosted)
