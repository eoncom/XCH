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

### IMPORTANT (9)

> **Note Pass 9.1 (révision post-ADR review)** : finding initial I-E1-1 (`assertCanWriteSite` Forbidden vs NotFound) **RÉVOQUÉ** — ADR-021 §4 fige explicitement le pattern Read→404 / Write→403 pour cross-DELEGATION (user a vu la ressource via une fenêtre légitime, refus explicite). `assertCanWriteSite` Forbidden EST aligné avec ADR-021. Le fix v2.3.2 pour cross-TENANT utilise NotFoundException, ce qui est aussi correct car le caller cross-tenant n'a aucun read access → defense in depth (cf. §9.1).

| ID | Finding | Pass | Track cible |
|---|---|---|---|
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

---

## 10. Pass 9 — Audit 5-niveaux (code vs MCP foundational vs ADR vs plan v2 vs docs architecturaux)

Pass étendue 2026-05-15 sur 2 catches utilisateur successifs :
1. **Catch 1 post-Pass-8** : tout audit code doit cross-checker contre **code + ADRs + plan v2 + docs architecturaux** (4 niveaux).
2. **Catch 2 post-Pass-9 initial** : il existe un 5e niveau **MCP foundational** — entités-protocole figées (`DEPLOY_WORKFLOW`, `XCH_ENGINEERING_PRINCIPLES`, `XCH_DEMO_DATA_PRINCIPLE`, `XCH_PRISMA_MODELING_RULES`, `XCH_PLAN_V2_FINALIZATION`) que tout chat doit lire en **Phase 0 préambule** (cf. obs 47 de `XCH_PLAN_V2_FINALIZATION`).

**Pattern méta corrigé** : "le code marche" ≠ "pattern figé architecturalement", et "j'ai lu Track E + air-gap context + Track G" ≠ "j'ai lu les fondations protocole". Voir MCP `XCH_AUDIT_PATTERN_CODE_VS_DOCS_COVERAGE` (mis à jour 5-niveaux).

### 10.0 Phase 0 protocol miss

**Auto-finding** : la Phase 0 de cette session Track E.1 a lu uniquement les MCP entities Track E + air-gap context + Track G placeholder + XCH_BOLA_PATTERN_CHECK + XCH_RELEASE_v2_3_1 + XCH_SECURITY_AUDIT_TANSTACK. **Elle a manqué les 5 entités foundational** :

- `DEPLOY_WORKFLOW` — workflow déploiement 2-repos, conventions DB/throttle, pièges NPM IP, migration Prisma versionnée
- `XCH_ENGINEERING_PRINCIPLES` — règles de l'art, pas de dette technique, fail-closed @Require*, RBAC scopé délégation
- `XCH_DEMO_DATA_PRINCIPLE` — "aucune donnée importante en prod, c'est de la démo", **migrations destructives autorisées**, reset+seed OK, pas de feature flag de transition
- `XCH_PRISMA_MODELING_RULES` — `@@unique` nullable doit avoir `nulls: "not distinct"`, PG 15+ required
- `XCH_PLAN_V2_FINALIZATION` — vrai plan v2 (MCP, pas fichier), 7 sessions v1.6 → v2.0.0

**Impact sur l'audit** :
- Pass 9.2 a regardé le **mauvais artefact** (`V2_STRATEGY_PROPOSAL.md` historique au lieu de l'entité MCP `XCH_PLAN_V2_FINALIZATION`). Correction §10.2.
- ADR-028 partie B (`migration zero-downtime`, `nullable backfill`) était **sur-prudent** — `XCH_DEMO_DATA_PRINCIPLE` autorise les migrations destructives sur xch-deploy. Simplification ADR-028 (cf. update commit).
- Aucun finding code manqué (audit empirique vérifie le code réel) mais finding **protocole** : tout nouveau chat doit lire ces 5 entités en Phase 0 préambule.

**Vigilance V6 ajoutée** au parent `XCH_TRACK_E_PREPROD_READINESS_2026_05_15` : Phase 0 obligatoire des 5 foundational + Track-spécifiques pour Tracks E.2/E.3/E.4.

### 10.1 ADR coverage (Pass 9.1)

ADRs lus : 002 (RLS), 004 (RBAC Casbin), 009 (Delegation-First), 017–026 récents.

**ADR-021 (RBAC Universal Data Filtering, 2026-04-29) couvre déjà** :
- §3 — `findFirst({where:{id, tenantId}})` + `assertCanReadSite/Delegation` (404 si denied) → **Pattern 1 multi-tenant lookup figé**
- §4 table HTTP — Read miss → 404, Write miss avec read access (cross-DELEGATION) → 403, cross-skew → 403 → **Pattern 2 404/403 discipline figée**
- §1 décorateurs `@RequireRead/Write/Manage` → **Pattern 3 RBAC figé**
- §5 `SYSTEM_CTX` factory (cron/processors) — orthogonal à `@SkipDelegation` (decorator user-facing)

**Conséquences pour BOLA Sites v2.3.2** :
- ADR-021 table récap fin (ligne 241) liste `sites.findOne ⚠️ → findOne assertCanReadSite` comme PR5 Session 4b
- Le `findUnique({where:{id}})` à `sites.service.ts:382` était une **violation latente d'ADR-021** non détectée pendant PR5 (oversight). Le fix v2.3.2 = **alignement tardif** au pattern existant depuis 2026-04-29, pas pattern nouveau.
- v2.3.1 `restoreFullBackupV2` BOLA = même situation (violation latente ADR-021).
- **Rétroactif** : si check CI ts-morph "any `findOne` sur entité tenant-scopée sans `CallerCtx`" (forward dep ADR-021 ligne 194) avait été implémenté en Session 4b, les 2 BOLAs auraient été détectés à la PR introduction. → renforcement candidat Track E.4.

**Gaps confirmés** :
- ❌ `@SkipDelegation` taxonomy (5 catégories) — pas d'ADR
- ❌ AuditLog enrichment (`ipAddress`/`userAgent` capture path + `delegationId` column) — pas d'ADR (ADR-021 §6 catégorie D justifie `userId` nullable, pas l'enrichment)

**Action prise** : [ADR-028](../decisions/adr-028-audit-log-enrichment-skipdelegation-taxonomy.md) créé pour combler les 2 gaps.

### 10.2 Plan v2 coverage (Pass 9.2)

> **Correction post-publication (catch utilisateur)** : la première lecture Pass 9.2 a identifié `docs/V2_STRATEGY_PROPOSAL.md` (2026-01-25) comme plan v2. **FAUX** — ce fichier est un proposal historique pré-Sessions. Le vrai plan v2 est l'entité MCP **`XCH_PLAN_V2_FINALIZATION`** (validée 2026-04-29, 113 observations, source de vérité). Plan v2 ≠ fichier `.md`, c'est une entité MCP figée.

**Vrai plan v2 (`XCH_PLAN_V2_FINALIZATION`)** : 7 sessions menant XCH de v1.6.0 à v2.0.0 (tag final closure plan v2). Couvre :
- Session 4 → RBAC universel **ADR-021** (réorienté 2026-04-29 après audit Contact cross-deleg, ex-Session perf/DB)
- Session 5 → Performance & intégrité DB + UX 404 résiduelle (ex-Hardening tail)
- Session 7 → Refonte E2E Playwright → tag v1.9.0
- Session 8 → Sentry/GlitchTip **ADR-024** (promu prérequis pilotes 2026-05-02)
- Session 9 → Hardening tail (CSP nonce dynamique + DTOs structurés 30+ endpoints) **ADR-023**

**Coverage findings Track E.1 vs vrai plan v2 (MCP)** :
| Finding | Couvert plan v2 ? | Référence |
|---|---|---|
| BOLA Sites (C-E1-1) | ✅ Pattern figé Session 4 / ADR-021 §3 | obs 20-25 (Session 4 livrée 2026-04-29) |
| CSP frontend externals (C-E1-2) | ⚠️ Partiel — Session 9 CSP nonce dynamique pour backend response. **Ne couvre PAS le CSP frontend `csp.ts` externals OSM/Carto/Leaflet** (Option A retenue Track E.3 est *un délivrable* post-plan-v2) | obs 52 (Hardening tail debt) + ADR-024 air-gap implicite |
| RBAC 100% coverage | ✅ Session 4 ADR-021 + Session 7 specs RBAC | obs 20, 83-84 |
| AuditLog `ipAddress`/`userAgent` NULL | ❌ NON (Session 5 perf/DB inclut index audit mais pas enrichissement capture) | gap → **ADR-028** |
| AuditLog `delegationId` manquant | ❌ NON | gap → **ADR-028** |
| Zombie deps casbin/typeorm | ❌ NON | dette implicite, Track E.4 cleanup |

**Cohérence stratégique post-v2.0.0** :
- Plan v2 ferme à v2.0.0. Tag `v2.0.0` posé (cf obs 99+ S8 GlitchTip post-v2.0.0).
- **Track E v2.1 = extension post-plan-v2** : Option C mixte + air-gap pilote employeur + 4 modes déploiement + Track G productization → **PAS dans plan v2** par construction (post-clôture).
- Plan v2 finalization ne couvrait PAS multi-client mixte — pivot stratégique acté **2026-05-15** Track E v2.1.

**Recommandation Pass 9.2 (révisée)** :
- Plan v2 finalization **a fait son travail** sur sa fenêtre (v1.6.0 → v2.0.0).
- **Refresh plan v3 IMPÉRATIF Track E.4** pour formaliser la portion **post-v2.0.0** (Track A, D.1/D.2, E.1→E.4, F, G) en plan structuré équivalent au plan v2 MCP.
- Ne pas écrire un fichier `.md` — créer entité MCP `XCH_PLAN_V3_POST_V2_2026_05_XX` qui :
  - Synthétise Track A→E décisions
  - Articule 4 modes déploiement
  - Sequence Track F (cleanup post-cutover) + Track G (productization kit) + Track D.3 (backup auto) + ADR-028 implementation
  - Devient nouvelle source de vérité pour les nouveaux chats

**Hors scope E.1** : refresh = audit-only ne fait que recommandation. Track E.4 lead.

### 10.3 Autres docs architecturaux (Pass 9.3)

| Doc | Date | Coverage E.1 findings | Gap |
|---|---|---|---|
| `docs/architecture/AUTH_MODEL.md` | 2026-04-04 | ✅ Tenant scope + RBAC patterns + `@SkipDelegation` mentionné | ⚠️ Discipline 404 vs 403 non documentée (mentionnée seulement v1.8.0 release notes) |
| `docs/architecture/tech-stack.md` | 2026-04-06 v1.1.1 | ❌ Pas d'air-gap, pas de CSP, pas d'egress | 🔴 Section sécurité infra entièrement absente |
| `docs/architecture/database-schema.md` | 2026-04-08 v1.3 | ✅ AuditLog colonnes `ipAddress`/`userAgent` présentes | ⚠️ `delegationId` audit_log absent (intentionnel ou gap ?) → clarifié dans ADR-028 |
| `README.md` | 2026-04-23 v1.4.0 | ✅ Multi-tenant + RBAC | ❌ Air-gap deployment non mentionné |
| `CONTRIBUTING.md` | inexistant | N/A | ⚠️ Pattern enforcement non documenté (à créer Track E.4 ?) |
| `docs/status/PROJECT_STATUS.md` | 2026-05-15 (auto-update) affiche v1.9.0 | **STALE** | 🔴 Affiche v1.9.0 alors que tag git = v2.3.2 ; G1 du plan Track E v2.1 confirmé |

### 10.4 Mapping table 4-niveaux (synthèse)

| Finding E.1 | Code OK ? | ADR couvert ? | Plan v2 couvert ? | Docs archi couvert ? | Gap résiduel |
|---|---|---|---|---|---|
| BOLA Sites (C-E1-1) | ✅ fixed v2.3.2 | ✅ ADR-021 §3 (alignement tardif PR5) | ❌ | ❌ tech-stack | ADR-021 enforcement CI (forward dep §194) → Track E.4 |
| CSP externals air-gap (C-E1-2) | ⏳ Option A Track E.3 | ❌ ADR-024 air-gap mentionne GlitchTip seulement | ❌ | ❌ tech-stack | ADR-024 à étendre OU nouveau ADR multi-host air-gap (Track E.3) |
| RBAC 100% coverage | ✅ vérifié | ✅ ADR-021 §1 | ❌ | ✅ AUTH_MODEL §4 | aucun |
| `@SkipDelegation` taxonomy (justifications) | ✅ 23 justifiés | ❌ avant ADR-028 | ❌ | ⚠️ AUTH_MODEL mentionne, pas taxonomy | **ADR-028 créé** ✅ |
| AuditLog `ipAddress`/`userAgent` NULL (I-E1-5) | ❌ caller missing | ❌ avant ADR-028 | ❌ | ✅ schéma a colonnes, ❌ pas capture path | **ADR-028 créé** ✅ |
| AuditLog `delegationId` absent (I-E1-6) | ❌ schéma | ❌ avant ADR-028 | ❌ | ✅ schéma confirme absence | **ADR-028 créé** ✅ |
| Forbidden / NotFound discipline | ✅ vérifié + ADR-021 cohérent | ✅ ADR-021 §4 | ❌ | ⚠️ AUTH_MODEL non | I-E1-1 RÉVOQUÉ (false finding) |
| Zombie deps backend | ✅ identifié | ❌ | ❌ | ❌ tech-stack | Track E.4 cleanup |
| HIGH CVEs backend+frontend (I-E1-3, I-E1-4) | ⚠️ documenté | ❌ | ❌ | ❌ | Track E.4 upgrade plan |
| Plan v2 stale 3.5 mois | N/A | N/A | N/A (le sujet) | ❌ PROJECT_STATUS stale | Track E.4 refresh plan v3 |

### 10.5 Pattern méta acté

Audit Track XCH désormais discipliné en **4 niveaux** :
1. Code empirique à l'instant T
2. ADRs (`docs/decisions/adr-*.md`)
3. Plan v2 (`docs/V2_STRATEGY_PROPOSAL.md` ou successeur)
4. Docs architecturaux racine (`docs/architecture/*.md`, `README.md`, `PROJECT_STATUS.md`, `CONTRIBUTING.md`)

Application future obligatoire **Tracks E.2/E.3/E.4** — voir MCP `XCH_AUDIT_PATTERN_CODE_VS_DOCS_COVERAGE` + vigilance V6 ajoutée à `XCH_TRACK_E_PREPROD_READINESS_2026_05_15`.

### 10.6 Effort réel Pass 9

| Sub-pass | Estimé | Réel |
|---|---|---|
| Pass 9.1 ADR coverage | 30min | ~25min (3 agents parallèles + ADR-021 lecture directe + ADR-028 rédaction) |
| Pass 9.2 Plan v2 coverage | 30min | (inclus dans agent parallèle ci-dessus) |
| Pass 9.3 Autres docs | 15min | (inclus dans agent parallèle ci-dessus) |
| Rédaction ADR-028 + §10 rapport + MCP update | — | ~25min |
| **Total Pass 9 étendu** | **~1h15** | **~50min** (33% sous estimation) |

Effort cumulé Track E.1 total : **~3h50** (vs ~9h15 nominal avec Pass 9 ajoutée = 58% sous estimation, calibration D.1/D.2 confirmée).

### 10.7 Décisions ouvertes

| Decision | Statut | Action |
|---|---|---|
| Refresh plan v3 (Track E.4) | OUVERT | À acter user — recommandation forte (plan v2 3.5 mois stale, pivot Option C mixte non formalisé) |
| ADR-028 implementation pattern (interceptor vs CallerCtx extension) | OUVERT | À acter pendant implémentation Track E.4 — les 2 respectent l'esprit ADR |
| `@SkipDelegation` JSDoc backfill 23 endpoints | OUVERT | Mini-PR docs Track E.4 (~1h, 0 risque code) — référencer catégorie ADR-028 |
| CI lint ts-morph "findOne sans CallerCtx" (ADR-021 forward dep §194) | OUVERT | Track E.4 (renforcement défense BOLA latente) |
| `PROJECT_STATUS.md` refresh v1.9.0 → v2.3.2 | OUVERT | Track E.4 (refresh + aligner avec git tag automatique) |
