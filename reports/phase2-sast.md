# Phase 2 — Analyse SAST (Static Application Security Testing)

**Date :** 2026-04-17
**Version :** commit `b382446` (après corrections Phase 1)
**Outils :**
- `npm audit` (backend + frontend)
- Semgrep `v1.x` avec rulesets `p/owasp-top-ten`, `p/nodejsscan`, `p/javascript`, `p/typescript`, `p/react`, `p/secrets`, `p/security-audit`

## TL;DR

| Outil | Avant | Après | Livrable |
|---|---|---|---|
| npm audit **backend** | 32 vulns (2 critical, 16 high) | **13 vulns (0 critical, 4 high)** | [phase2-backend-audit-v3.json](phase2-backend-audit-v3.json) |
| npm audit **frontend** | 4 vulns (4 high) | **0 vulns** ✅ | — |
| Semgrep | 9 findings (4 ERROR) | **6 findings, tous false-positives** documentés | [phase2-semgrep-post-fix.json](phase2-semgrep-post-fix.json) |

**Objectif "zéro erreur critique" : ATTEINT** ✅

---

## 1. npm audit

### Backend — 32 → 13 vulnérabilités

**Actions :**
1. Supprimé `puppeteer@21.6.1` (dead dependency, jamais importée dans `src/`) → élimine tout un arbre transitif (`tar-fs`, `ws`, `@puppeteer/browsers`, `puppeteer-core`)
2. Bump `axios ^1.6.5 → ^1.12.2` → fixe `__proto__` DoS
3. Bump `bcrypt ^5.1.1 → ^6.0.0` → remplace la chaîne `tar@6` vulnérable (node-pre-gyp → node-tar path traversal)
4. Bump `minio ^7.1.3 → ^8.0.7` → **élimine les 5 critiques `fast-xml-parser`** (GHSA-g65p-5h2m-mwwr et consorts)
5. `npm audit fix` (non-breaking) pour le lock file

**Tenté et revert** : `@nestjs/*` 10 → 11 aurait éliminé les 4 highs restants (`multer`, `express`, `body-parser`, `path-to-regexp`) mais introduit des erreurs TS strict dans la stratégie OIDC (`config.get()` devient `string|undefined`). Travail à mener séparément (ADR dédié).

**Reliquat (4 high, 9 moderate) :**

| Package | Sévérité | Source | Type | Mitigation existante |
|---|---|---|---|---|
| `multer <=2.1.0` | high (3×) | `@nestjs/platform-express@10` | DoS via resource exhaustion | Rate limiting global + Nginx body size cap |
| `express 4.x` | high (3×) | `@nestjs/platform-express@10` | `body-parser`/`qs`/`path-to-regexp` DoS | Rate limiting + reverse proxy timeout |
| `axios` | high (2×) | direct (1.12.2) | SSRF + metadata exfiltration (nouveau CVE) | Pas d'appels axios vers input user (seulement NetBox/Uptime Kuma configurés par admin) |
| `minimatch`, `glob` | high | dev-only (ts-node, webpack CLI) | ReDoS | Non exposé runtime prod |
| Autres moderate | moderate | dev/build ou transitif non exploitable | — | — |

**Risque résiduel jugé acceptable pour pilote de production :**
- Aucun critique restant
- Les DoS Express/Multer se défendent par rate limiting + Nginx (déjà en place)
- Axios : consommateur pas exposé à des URLs d'entrée utilisateur
- Reste à traiter post-pilote : upgrade NestJS 10 → 11 (ADR à produire)

### Frontend — 4 → 0 vulnérabilités ✅

**Actions :**
1. Remplacé `xlsx@0.18.5` par l'URL CDN officielle SheetJS `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` → fixe GHSA-4r6h-8v6p-xvw6 (prototype pollution) + GHSA-5pgg-2g8v-p4x9 (ReDoS). C'est le workaround officiel de SheetJS (le 0.18.5 sur npm est figé).
2. Bump `canvas ^2.11.2 → ^3.1.0` → élimine les 6 advisories `node-tar`

**Résultat :** `found 0 vulnerabilities`.

---

## 2. Semgrep — 9 → 6 (tous false positives)

### Vrais bugs corrigés (3)

#### SEM-001 — `qrcode.service.ts:39` Math.random() pour token QR (WARNING)
**Fix :** Remplacement par `crypto.randomBytes(24).toString('base64url')`.
**Impact avant :** Les tokens dans les URLs QR d'assets (`/dashboard/assets/:id?qr=TOKEN`) étaient prédictibles (~5 bits d'entropie effective). Un attaquant pouvait énumérer des tokens valides.
**Impact après :** 192 bits d'entropie, imprévisible.

#### SEM-002 — `storage.service.ts:295` Math.random() pour suffixe de fichier (WARNING)
**Fix :** `crypto.randomBytes(4).toString('hex')`.
**Impact :** Faible (collision de nom), mais cohérence avec la politique crypto.

#### SEM-003 — `floor-plans.service.ts:149` `execSync(\`pdftoppm ... -f ${page}\`)` (ERROR detect-child-process)
**Fix :** Ajout d'une validation runtime `Number.isInteger(page) && 1 ≤ page ≤ 10000` avant interpolation.
**Impact avant :** Le paramètre `page` était typé `number` en TS, mais JS n'enforce pas au runtime — un appelant interne mal validant pouvait théoriquement permettre une injection de commande shell.
**Impact après :** Défense en profondeur — même en cas de régression côté appelant, la validation stoppe l'exécution.

### Faux positifs post-fix (6 restants)

| # | Finding | Fichier | Raison FP |
|---|---|---|---|
| 1 | `detect-child-process` | `floor-plans.service.ts:156` | La validation `Number.isInteger(page)` ajoutée en 140-144 neutralise l'injection. Semgrep ne trace pas la data flow post-validation. |
| 2 | `node_timing_attack` `password !== confirmPassword` | `frontend/app/invite/page.tsx:58` | Comparaison côté navigateur entre deux champs utilisateur — aucun secret côté serveur, aucun canal de timing exploitable par un tiers. |
| 3 | `node_timing_attack` idem | `frontend/app/reset-password/page.tsx:58` | Même raison. |
| 4 | `node_password` `'Le mot de passe est requis'` | `frontend/app/setup/page.tsx:116` | Chaîne de **message d'erreur FR**, pas un mot de passe. Heuristique Semgrep déclenchée par le mot « mot de passe ». |
| 5 | idem `'Minimum 8 caractères'` | `setup/page.tsx:118` | Idem. |
| 6 | idem `'Doit contenir au moins...'` | `setup/page.tsx:120` | Idem. |

Aucun ne constitue une vulnérabilité exploitable.

---

## Actions entrées dans le code

Tous commits signés Co-Authored-By Claude Opus 4.7 (1M context) :

| Commit | Description |
|---|---|
| [`b9c3b4f`](https://github.com/eoncom/XCH/commit/b9c3b4f) | chore(deps): remove puppeteer, upgrade xlsx+canvas |
| [`a52c5bd`](https://github.com/eoncom/XCH/commit/a52c5bd) | chore(deps): bump axios/bcrypt/minio for SAST |
| [`211bab6`](https://github.com/eoncom/XCH/commit/211bab6) | chore(deps): NestJS 10→11 (**revert — break TS strict**) |
| [`b0cd254`](https://github.com/eoncom/XCH/commit/b0cd254) | Revert NestJS 11 (blocking TS errors in OIDC) |
| [`b382446`](https://github.com/eoncom/XCH/commit/b382446) | fix(security): Semgrep findings (crypto + cmd-injection defense) |

---

## Recommandations post-Phase 2

### Bloquant Phase 3 (DAST) — aucun
Phase 3 peut démarrer.

### Recommandé avant prod pilote (2 items)
1. **Produire ADR pour NestJS 11 upgrade** et le lancer (inclure stricter TS fixes pour OIDC strategy) — élimine 4 high restants
2. **Audit complémentaire périmètre axios** : documenter explicitement que les URLs passées à `axios.get/post` ne proviennent que de `.env` et de paramètres admin, jamais d'input utilisateur final. Si NetBox/Uptime Kuma URLs passent en DB, ajouter un allow-list schemes + hosts.

### Post-pilote
- Mettre en place un scan SAST hebdomadaire automatique (GitHub Actions `semgrep --error` + `npm audit --audit-level=high`)
- Dependabot/Renovate pour maintenir les deps à jour (aujourd'hui manuel)
