# ADR-026 : Backup v2 Polish (chiffrement streaming + observabilité + cross-tenant + multipart upload + deprecation X-Backup-Sync)

Date : 2026-05-14 (skeleton) — corps rempli au fil des Steps D.2
Statut : Proposé (skeleton ouvert Step 0 Track D.2, fermé Step 7)
Tag cible : v2.3.0 (Track D.2 — Backup v2 Polish, scope figé MCP `XCH_TRACK_D2_BACKUP_V2_2026_05_14`)

Dépendances :
- ADR-019 (chiffrement secrets at-rest AES-256-GCM, `XCH_MASTER_KEY` + versionning `v<n>:`) — réutilisé pour §1 encryption stream
- ADR-020 (Notifications BullMQ refacto) — pattern Bull v3 queue/processor réutilisé pour §6
- ADR-023 (DTO discipline) — étendu Step 2 + Step 4 + Step 4.5
- ADR-024 (GlitchTip air-gap observability) — étendu §2 transactions via scrubEvent fail-closed
- ADR-025 (Backup v2 streaming + idempotent restore + Bull v3) — base D.1 sur laquelle D.2 ajoute en add-only

## Contexte

Track D.1 v2.2.0 (commit `c8ab91e` PR #70, hotfix `6d9ead9` PR #71) a livré le backup v2 streaming + idempotent restore + dry-run + async Bull v3. Le scope D.1 a explicitement déféré 5 features à D.2 (MCP `XCH_TRACK_D2_BACKUP_V2_FUTURE` figé 2026-05-10) + 2 items détectés lors de l'audit cohérence plan D.2 v3 (BACKUP_ACTIONS dette v2.2.1 + async multipart upload précondition v2.4.0).

D.2 ship donc 7 améliorations en add-only sur la base D.1 stable, **sans toucher au format v2 ni à la couche streaming/idempotence existante**.

Soak gate strict : merge ≥ 2026-05-21 (1 semaine post-deploy v2.2.0). Pas de bypass.

## Décision

Voir §1-§6 ci-dessous pour chaque sous-décision D.2.

### §1 — Encryption stream pattern (Step 1+2)

**TODO Step 2** : remplir avec :
- Pipeline cipher Transform en aval de `HashingStream` archive (déterminisme préservé)
- Sidecar JSON co-localisé MinIO `<filename>.enc.json` avec shape `{ version, algo, keyVersion, ivBase64, authTagBase64 }`
- Atomicité : zip uploadé d'abord, sidecar ensuite (orphan détectable au restore)
- Decipher restore : fetch sidecar first → build `createDecipheriv` avec key version résolue → pipe AVANT MagicByteValidator
- Forward errors manuel (ADR-025 pattern `.pipe().pipe()` Node ne propage pas)
- No-key path : `createCipherStream()` throws explicite (PAS fail-soft), UI grise via `GET /backup/capabilities`

### §2 — scrubEvent étendu transactions (Step 3)

**TODO Step 3** : remplir avec :
- `tracesSampleRate: 0 → 1.0` (backup low-volume, 100% sampling négligeable)
- `beforeSendTransaction: () => null` → `beforeSendTransaction: scrubEvent` (parité ADR-024 fail-closed multi-emplacement)
- Multi-emplacement scrubber : test PII dans `span.description` + `span.attributes` + `transaction.tags`. Si un seul leak → test fail
- Auto-instrumentation Sentry désactivée explicite si présente (vérif obligatoire avant merge)

### §3 — Cross-tenant restore policy (Step 4)

**TODO Step 4** : remplir avec :
- `remapDelegation()` + `rewriteOwnership()` helpers single source of truth top de `applyDataFilesToDbInner`
- 5 colonnes directes `delegationId` (Site, Asset, Expense, Budget, BillingEntity) — analyse FK chain confirmée par grep schema
- Skip users loop en cross-tenant + warning UI + audit log RESTORE_CROSS_TENANT
- Ownership FK rewrite **PERMANENT** vers caller admin (préservé même si caller perd manage rights post-restore)
- Pre-remap invariant R∗ validation : assert `task.delegationId === site.delegationId` etc. AVANT remap. Si violation source → BadRequestException restore aborted
- Schema invariant R1 préservé par all-or-nothing remap (target unique pour toutes les rows)
- Permission gate : double check manage source ET target (target via `req.user.tenantId`)
- Warning UI text figé pour transparence opérateur

### §4 — X-Backup-Sync deprecation cycle (Step 5)

**TODO Step 5** : remplir avec :
- v2.3.0 : warn log + Swagger `@ApiHeader DEPRECATED` (code path préservé)
- v2.4.0 : hard delete sync path complet (CHANGELOG `[BREAKING]` planifié)
- Précondition v2.4.0 : §6 async multipart upload doit être en place avant retrait
- Métrique de bascule : grep prod logs `XCH_LOG_MARKER X-Backup-Sync header used` over 1 semaine = 0 ⇒ green pour hard delete

### §5 — BACKUP_ACTIONS constant centralization (Step 0.5)

**TODO Step 0.5** : remplir avec :
- Origine dette : v2.2.1 hotfix PR #71 `6d9ead9` (listBackups filtre hardcodé cachait v2 backups)
- Centralisation `backend/src/modules/backup/backup.actions.constants.ts` avec `BACKUP_ACTIONS as const` + type `BackupAction`
- 4 call sites refactor depuis arrays littéraux
- Test regression v2.2.1 : catalog liste v1 + v2 backups préservée
- Pattern : prévient régression catalog si bump format v3 future

### §6 — Async multipart upload restore pattern (Step 4.5)

**TODO Step 4.5** : remplir avec :
- Controller `POST /backup/full/restore-upload` multer FileFieldsInterceptor (backup + sidecar optional)
- Stream multipart → `os.tmpdir()/xch-restore-upload-<uuid>.zip`
- Enqueue restore job avec `tmpUploadPath` au lieu de `backupId`
- Processor branch : if `tmpUploadPath` → use it ; else download from MinIO via `backupId`
- Cleanup `try/finally fs.rm(force: true)` dans processor
- Edge case sidecar coupling : encrypted ZIP sans sidecar uploadé → 400 explicit
- Disk check pré-upload : 507 si free < 1.2 × uploaded (pattern D.1 InsufficientStorageException)
- Précondition au hard delete v2.4.0 X-Backup-Sync (sinon DR scenario depuis ZIP local cassé)

## Conséquences

### Positives (TODO finaliser Step 7)

- Backup chiffrement opt-in opérateur via UI toggle
- Observabilité fine post-mortem (durée par phase, identification bottlenecks réels)
- Migration cross-tenant pour pilotes / recovery sur tenant neuf
- Voie multipart upload moderne (async + queue) remplace fallback sync DR-only
- Dette v2.2.1 résolue (catalog regression-proof si bump format futur)

### Négatives / Compromis (TODO finaliser Step 7)

- `XCH_MASTER_KEY` perte = encrypted backups irrécupérables (déjà documenté ADR-019, doc opérateur enrichie `backup-key-rotation.md`)
- `tracesSampleRate: 1.0` augmente volume ingestion GlitchTip (acceptable pour backup ops low-volume)
- Cross-tenant restore skip Users : opérateur doit comprendre que tenantB users existants gardent leurs accès via délégation (warning UI explicite)
- Sidecar JSON couple le ZIP au keyVersion : downgrade `XCH_MASTER_KEY` casse les restores (mitigation : versionning + `XCH_MASTER_KEY_V<n>` env legacy fallback)

### Forward dependencies (Track D.3)

- Backup incrémental (diff depuis last full)
- Compression alternative (zstd, lz4)
- Backup automatique programmé (`@Cron`)
- Multi-region MinIO failover
- Compliance audit reports (RGPD, SOC2)
- **Hard removal X-Backup-Sync** (v2.4.0, après 1 cycle deprecation v2.3.0)
- Concurrency > 2 (si data prod justifie)
- Schema migration `Photo.contentHash` + `Expense.receiptFile` (NK fallback v2.3.0 suffisant)
- Crypto agility (AES-GCM-SIV, ChaCha20-Poly1305) — sidecar `version: 1` prêt à recevoir bump
- Sentry SDK v8 migration (`instrumentation-client.ts` auto-load Next.js 15.3+)

## Patterns figés Track D.2 (TODO Step 7)

| Pattern | Rationale | Fichier référence |
|---|---|---|
| Cipher Transform en aval HashingStream archive | Déterminisme sha256 archive préservé (hash sur plaintext bytes) | `backup.service.ts:buildArchiveV2ToTmp` |
| Sidecar versionné `version: 1` | Crypto agility future (AES-GCM-SIV, ChaCha20) sans migration painful | `crypto.service.ts:createCipherStream` |
| Atomicity zip-before-sidecar | Orphan sidecar inexistant ; orphan zip détectable comme plaintext (NoSuchKey sidecar) | `backup.service.ts:uploadTmpToBackupBucket` |
| scrubEvent fail-closed multi-emplacement | Parité ADR-024, transactions traitées comme events | `glitchtip/init.ts` |
| remapDelegation all-or-nothing | Schema invariant R∗ préservé (target unique pour toutes rows) | `backup.service.ts:applyDataFilesToDbInner` |
| Ownership FK rewrite permanent | Traçabilité audit préservée même si caller perd manage rights | `backup.service.ts:rewriteOwnership` |
| Pre-remap invariant validation | Évite propager bug source vers target tenant silently | `backup.service.ts:validateInvariants` |
| Multipart tmp uuid uniqueness | 2 opérateurs simultanés sans collision | `backup.controller.ts:restoreUpload` |
| BACKUP_ACTIONS as const + BackupAction type | Type narrowing, prévention régression catalog | `backup.actions.constants.ts` |
| X-Backup-Sync deprecation warn log + Swagger | 1 cycle visibility avant hard delete v2.4.0 | `backup.controller.ts` |

## Alternatives considérées (TODO Step 7)

À remplir au fil des Steps avec les alternatives concrètement rejetées :
- Cipher Transform UPSTREAM du HashingStream (rejeté : casse déterminisme test D.1)
- `XCH_BACKUP_KEY` séparée de `XCH_MASTER_KEY` (rejeté : 2 lifecycles de rotation, complexité ops)
- Sentry SDK v8 upgrade pré-D.2 (rejeté : scope creep, défer session dédiée)
- Cross-tenant user upsert dans target (rejeté : collisions email + pollution tenant cible)
- Multipart sync HTTP timeout 1h (rejeté : voir ADR-025 — reverse proxy timeout)
- Hard removal X-Backup-Sync D.2 (rejeté : 1 cycle deprecation requis par scope MCP)

## Validation pre-merge (TODO Step 7)

Checklist d'acceptance D.2 (cf `XCH_TRACK_D2_BACKUP_V2_2026_05_14`) :

- [ ] Round-trip encrypt on + restore OK
- [ ] Round-trip encrypt off + 0 sidecar uploadé
- [ ] Tamper byte ciphertext → 400 auth-tag avant magic byte
- [ ] Cross-tenant A→B + delegationId remap + 0 leak A
- [ ] Cross-tenant + skip users + ownership rewrite vers caller admin
- [ ] Pre-remap invariant violation source → BadRequestException
- [ ] GlitchTip 5 spans par phase visibles + scrubber multi-emplacement passes
- [ ] X-Backup-Sync warn log + Swagger deprecated
- [ ] BACKUP_ACTIONS catalog regression v2.2.1 préservée
- [ ] Multipart upload happy + encrypted+sidecar + sans sidecar 400
- [ ] (CONDITIONAL Step 6) Concurrency 2 + RSS < 50% limit
- [ ] Soak gate ≥ 2026-05-21 respecté avant merge

## Post-deploy smoke v2.3.0 (TODO Step 7)

À exécuter sur xch-deploy après le tag v2.3.0 + rebuild. Procédure détaillée plan v3 §"Smoke procedure post-merge" (12 cas).
