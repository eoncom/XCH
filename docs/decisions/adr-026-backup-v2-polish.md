# ADR-026 : Backup v2 Polish (chiffrement streaming + observabilité + cross-tenant + multipart upload + deprecation X-Backup-Sync)

Date : 2026-05-15 (corps finalisé Step 7 ; skeleton ouvert Step 0 le 2026-05-14)
Statut : Accepté
Tag cible : v2.3.0 (Track D.2 — Backup v2 Polish, scope figé MCP `XCH_TRACK_D2_BACKUP_V2_2026_05_14`)

Dépendances :
- ADR-019 (chiffrement secrets at-rest AES-256-GCM, `XCH_MASTER_KEY` + versionning `v<n>:`) — réutilisé pour §1 encryption stream
- ADR-020 (Notifications BullMQ refacto) — pattern Bull v3 queue/processor réutilisé pour §6
- ADR-023 (DTO discipline) — étendu Step 2 + Step 4 + Step 4.5
- ADR-024 (GlitchTip air-gap observability) — étendu §2 transactions via `scrubEvent` fail-closed
- ADR-025 (Backup v2 streaming + idempotent restore + Bull v3) — base D.1 sur laquelle D.2 ajoute en add-only

## Contexte

Track D.1 v2.2.0 (commit `c8ab91e` PR #70, hotfix `6d9ead9` PR #71) a livré le backup v2 streaming + idempotent restore + dry-run + async Bull v3. Le scope D.1 a explicitement déféré 5 features à D.2 (MCP `XCH_TRACK_D2_BACKUP_V2_FUTURE` figé 2026-05-10) + 2 items détectés lors de l'audit cohérence plan D.2 v3 (BACKUP_ACTIONS dette v2.2.1 + async multipart upload précondition v2.4.0).

D.2 ship donc 7 améliorations en add-only sur la base D.1 stable, **sans toucher au format v2 ni à la couche streaming/idempotence existante**.

Soak gate strict : merge ≥ 2026-05-21 (1 semaine post-deploy v2.2.0). Pas de bypass.

## Décision

Voir §1–§6 ci-dessous pour chaque sous-décision D.2.

### §1 — Encryption stream pattern (Step 1+2)

**Mécanisme.** Toggle UI opt-in « Chiffrer le backup (AES-256-GCM) » dans la pré-launch dialog. La grise est server-driven via `GET /backup/capabilities` qui retourne `{ encryption: boolean }` = `CryptoService.isEnabled()` (true ⇔ `XCH_MASTER_KEY` configuré).

**Pipeline backup.** Dans `buildArchiveV2ToTmp` ([backup.service.ts](../../backend/src/modules/backup/backup.service.ts)) :

```
archive
  ├── archive.on('data') → archiveHasher (UPSTREAM cipher → voit PLAINTEXT)
  └── pipeline(archive, cipher | identity, fs.createWriteStream(tmp))
                                  │
                                  └─ after pipeline resolves :
                                     authTag = cipher.getAuthTag()
                                     → write sidecar JSON {version,algo,keyVersion,iv,tag}
```

**Invariant déterminisme** : `archive.on('data')` tap est **UPSTREAM** du cipher Transform — donc `archiveHasher` voit les bytes PLAINTEXT peu importe `encrypt: on|off`. Les tests déterministes D.1 (hash archive reproductible) restent verts sans modification.

**Sidecar JSON v1** (shape figée) :
```json
{ "version": 1, "algo": "aes-256-gcm", "keyVersion": 1, "ivBase64": "<12B>", "authTagBase64": "<16B>" }
```
- `version: 1` : schema du sidecar (NOT le format de backup, qui reste v2). Réserve pour crypto agility future (AES-GCM-SIV, ChaCha20-Poly1305).
- `keyVersion` : pointer vers `XCH_MASTER_KEY` courante OU `XCH_MASTER_KEY_V<n>` legacy (ADR-019 rotation).

**Atomicité zip-before-sidecar.** `uploadTmpToBackupBucket` upload le ZIP **d'abord** (streaming `fPutObject`), **puis** le sidecar (`putObject` JSON buffer). Crash mid-process laisse :
- Orphan ZIP sans sidecar → restore traite comme plaintext ; si vraiment encrypted, magic-byte ou ciphertext-shape detection (Step 4.5) lève une erreur claire.
- L'inverse (sidecar sans ZIP) est impossible — clean failure mode.

**Pipeline restore** dans `restoreFullBackupV2` :
```
sidecar = fetchSidecar(filename)   // MinIO ; NoSuchKey → null (plaintext)
fileStream = createReadStream(tmpZipPath)
if (sidecar) :
  decipher = crypto.createDecipherStream({keyVersion, iv, tag})  // setAuthTag pre-wired
  fileStream.pipe(decipher).pipe(validator).pipe(zipStream)
  // 3 forward-errors jumpers (ADR-025 pattern .pipe().pipe() Node)
else :
  fileStream.pipe(validator).pipe(zipStream)
  // 2 forward-errors jumpers
```

**Magic byte intercept AFTER decipher.** Le `MagicByteValidator` reçoit donc toujours du plaintext PKZip (50 4B 03 04), peu importe que la source MinIO soit cipher OR plaintext. Tamper ciphertext → auth tag fail à `cipher.final()` qui propage vers `zipStream.destroy(err)` avant que magic byte soit testé.

**HTTP 412 Precondition Failed** côté controller si `encrypt: true && !crypto.isEnabled()` — défense en profondeur (UI greying via capabilities devrait déjà bloquer). Worker invariant check identique côté service (cas worker démarré sans env après controller validé).

**Sync v1 path** : `encrypt: true` warn-log + ignoré (v1 n'a pas de pipeline streaming compatible cipher). Operator a explicitement choisi le path legacy via `X-Backup-Sync: 1` — silent drop refusé, mais erreur 4xx aussi refusée car v1 sync est encore le seul fallback Redis-down jusqu'à v2.4.0.

### §2 — scrubEvent étendu transactions (Step 3)

**Pre-flight vérif `init.ts`** (documentée MCP `XCH_TRACK_D2_BACKUP_V2_2026_05_14` Step 3) confirmée : **0 auto-instrumentation explicite** Sentry SDK v7.91 dans `backend/src/`. Mais les default integrations v7 (notamment `Http`) chargeraient des transactions HTTP si `tracesSampleRate` était bumpé global.

**Approche retenue : `tracesSampler` ciblé** plutôt que `integrations: defaultIntegrations.filter(...)` qui aurait amputé les HTTP breadcrumbs (utiles pour debug captureException). Le sampler retourne `1` ssi `transactionContext.op` commence par `'backup'` OR `transactionContext.name` commence par `'backup.'` — tout autre op (HTTP auto-instrumentation latent, custom non-backup) retourne `0` et la transaction est droppée avant ingestion.

**Honoration `parentSampled`** : nested spans héritent de la décision parent pour éviter des splits parent-sampled/child-not.

**`beforeSendTransaction` étendu `scrubEvent`** (avant : `() => null` = dropped all transactions). Parité ADR-024 fail-closed : le bundle `SECRET_REGEX_BUNDLE` (single source of truth importée depuis le scrubber d'erreurs) scanne maintenant aussi `span.description`, `span.attributes`, `transaction.tags`. Test multi-emplacement (3 PII positions + 1 attribute key + cleanup user/request paths) dans `scrubber.spec.ts` — si un seul emplacement leak PII, test fail strict.

**Span tree shape figée** :
```
backup.full (parent, BackupProcessor.handleBackupFull)
  └── backup.archive-build
  └── backup.minio-upload

backup.restore.full (parent, BackupProcessor.handleRestoreFull)
  └── backup.minio-download
  └── backup.prisma-import (dry_run attribute distingue dry vs real)
        └── backup.restore.phase-1 'Tenant config'
        └── backup.restore.phase-2 'Sites + structure'
        └── backup.restore.phase-3 'Lifecycle'
        └── backup.restore.phase-4 'Finance'
        └── backup.restore.phase-5 'Snapshots + audit'
```

**Tags figés** sur tous les spans (PII-light, scrubber-safe) : `tenant_id` (UUID), `backup_format_version: 2`, `encrypted: boolean`, `job_id`, `source: 'multipart-upload' | 'catalog'` (sur restore), `phase` + `phase_name` (sur sub-spans prisma).

### §3 — Cross-tenant restore policy (Step 4)

**Schema scan exhaustif Step 4.1** (MCP) a corrigé deux dérives du plan v3 :
- **6 colonnes `delegationId` directes** (vs 5 listées plan v3) : **Site, Asset, Contact (gap fix D.1), BillingEntity, Expense, Budget**. Plan v3 oubliait Contact.
- **4 ownership FK rewrite** (vs 4 plan v3 mais 1 mislabel) : **Task.createdBy, Task.assignedTo (gap fix D.1), TaskComment.authorId, Expense.createdBy** (plan v3 disait BillingEntity.createdBy à tort).
- Plus 3 ownership FK already-correct via fallback `|| userId || 'restore'` (FloorPlan.uploadedBy, Photo.uploadedBy, Attachment.uploadedBy) — pas de code change requis, déjà rewrite caller admin.

**Helpers `applyDataFilesToDbInner`** (single source of truth top-scope) :

```ts
const remapDelegation = (srcDelId: string | null | undefined): string | null => {
  if (srcDelId == null) return null;
  return targetDelegationId ?? srcDelId;  // identity en same-tenant
};

const rewriteOwnership = <T>(row: T, fields): { row: T; count: number } => {
  // cross-tenant : remplace fields ownership par caller userId
  // same-tenant : identity (pas de modification)
};
```

**All-or-nothing remap** : `remapDelegation` coerce **TOUTES** les rows → `targetDelegationId`. L'invariant schema R1 (`child.delegationId === site.delegationId` quand siteId+delegationId set, doc lignes 1014/1297/1343/1601 du `schema.prisma`) est **trivialement satisfait post-remap** (entité ET son site enfant ont même target).

**Pre-remap invariant R∗ validation** (ajustement #1 plan v3). `validateInvariants(dataFiles)` au top de `applyDataFilesToDbInner` checke R1 sur 4 modèles (Contact, BillingEntity, Expense, Budget) AVANT remap. Si source corrompue (delegationId child ≠ site.delegationId) → `BadRequestException("Source backup has invariant R1 violation in '<table>' …, restore aborted, fix source")`. Évite de propager un bug source vers target tenant silently.

**Skip Users loop cross-tenant.** Si `targetDelegationId` set, `dataFiles['users']` est ignoré entièrement (collision email + pollution tenant cible). Warning log + counter `skippedCrossTenantUsers` + dry-run `wouldSkipCrossTenant.User` count surfaceé dans le report. Les utilisateurs du tenant cible accèdent aux données migrées via la délégation choisie.

**Ownership FK rewrite PERMANENT** (validation point V3 acté). En cross-tenant, les FK ownership pointent vers le caller admin (`userId`) au moment du restore. Si le caller perd ses droits `manage` plus tard (rotation rôle, départ équipe), les FK historiques sont **préservées telles quelles** — audit traçabilité forensic intacte. L'audit log row `RESTORE_CROSS_TENANT` (voir ci-dessous) sert de SoT contextuelle.

**Permission gate.** `assertTargetDelegationAccessible(targetDelegationId, callerTenantId)` côté service (testable + reusable) — `prisma.delegation.findFirst({ where: { id, tenantId: callerTenantId } })`. Échec → `ForbiddenException('Target delegation not accessible')`. Message générique : pas d'info leak (même réponse si delegation inexistante OR appartient à un autre tenant). Combiné avec `@RequireManage` (source-tenant gate du controller), cela forme le double-check spécifié plan v3.

**Audit log row `RESTORE_CROSS_TENANT`** (ajouté à `BACKUP_AUDIT_ACTIONS` Step 4 — `AuditLog.action` est `String` typed dans schema, **aucune Prisma migration** nécessaire). Émis EN PLUS du `RESTORE_FULL_V2` standard quand `targetDelegationId` set. Carry :
```json
{
  "filename": "<backup-filename>",
  "sourceTenantId": "<tnt>",
  "targetTenantId": "<tnt-caller>",
  "targetDelegationId": "<del-uuid>",
  "skippedUsers": <count>,
  "rewrittenOwnership": <count>,
  "dryRun": false
}
```

**Warning UI text figé** (frontend `RestoreDialog`) :
> Les utilisateurs du tenant source ne sont pas importés. Les utilisateurs du tenant cible auront accès aux données migrées via la délégation choisie. La propriété (createdBy, assignedTo, authorId) est réécrite vers l'admin qui lance le restore — la trace audit est préservée même si vos droits évoluent.

### §4 — X-Backup-Sync deprecation cycle (Step 5)

**Phase v2.3.0 (D.2)** : code path préservé, warn log à chaque hit + Swagger `@ApiHeader deprecated: true` sur les 3 endpoints concernés.

**Helper `logSyncDeprecationWarn(endpoint, tenantId, userId)`** émet une ligne stable :
```
XCH_LOG_MARKER X-Backup-Sync header used on <endpoint> — DEPRECATED, will be removed in v2.4.0 (tenant=... user=...)
```

Wired into 4 sync branches :
- `POST /backup/full` sync v1
- `POST /backup/full/restore` multipart sync v1 (supplanté par §6 multipart upload)
- `POST /backup/full/restore` JSON sync v2 (Redis-unhealthy escape hatch)
- `POST /backup/site/:id` sync v1 stream

**Phase v2.4.0 (D.3)** : hard delete du code path. **Critère de bascule** : grep prod logs `XCH_LOG_MARKER X-Backup-Sync` sur 7 jours soak post-v2.3.0 = 0 hits. Si > 0 hits, investigation caller + extension deprecation 1 cycle supplémentaire.

**Précondition v2.4.0** : §6 async multipart upload **doit** être en place, sinon le DR scenario depuis ZIP local serait cassé. ✅ Livré Step 4.5.

### §5 — BACKUP_ACTIONS constant centralization (Step 0.5)

**Origine dette** : v2.2.1 hotfix (commit `6d9ead9` PR #71) a étendu le filtre `listBackups` de `'BACKUP_FULL'` strict à `['BACKUP_FULL', 'BACKUP_FULL_V2', 'BACKUP_SITE', 'BACKUP_SITE_V2']`. Mais la liste hardcodée a été dupliquée dans **4 call sites** (listBackups, downloadBackup, deleteBackup, cleanupOldBackups). Un futur bump format v3 répète silencieusement le piège.

**Centralisation** `backend/src/modules/backup/backup.actions.constants.ts` :
- `BACKUP_AUDIT_ACTIONS` (9 actions, inclut `RESTORE_CROSS_TENANT` ajouté Step 4) : full set des actions émises par le module backup.
- `BACKUP_CATALOG_ACTIONS` (4 actions, `satisfies readonly BackupAuditAction[]`) : subset catalog-listable.
- `BackupAuditAction` + `BackupCatalogAction` types pour compile-time narrowing.

`logBackupAction(action: BackupAuditAction)` signature tightened — typos `'BACKUP_FULLLLL'` rejetés à la compilation.

**Note STORAGE_CLEANUP** : émis par le module backup mais opère sur `xch-storage` (assets utilisateur), PAS sur `xch-backups`. Inclus dans `BACKUP_AUDIT_ACTIONS` pour cohérence call-site, commentaire D.3 backlog pour relocation éventuelle vers `STORAGE_AUDIT_ACTIONS`.

### §6 — Async multipart upload restore pattern (Step 4.5)

**Précondition v2.4.0** hard delete `X-Backup-Sync` : sans ce step, le DR scenario depuis ZIP local serait cassé une fois la voie sync supprimée.

**Endpoint** `POST /backup/full/restore-upload` :
- `@UseInterceptors(FileFieldsInterceptor([{name: 'backup', maxCount: 1}, {name: 'sidecar', maxCount: 1}]))`
- multer `diskStorage` → `os.tmpdir()/xch-restore-upload-<uuid>-<field>.<ext>`
- 50 GB upload limit, mimetype-loose filter (re-validé downstream par MagicByteValidator)
- Permission gate (Step 4) si `targetDelegationId` set
- Disk check pré-enqueue : ~1.2 × upload size + 512 MB free dans tmpdir → HTTP **507 Insufficient Storage** (RFC 4918 §11.5 literal, absent du `HttpStatus` enum @nestjs/common, pattern D.1 step 1)
- `try/finally` synchrone : si échec PRE-enqueue (perm gate, disk check, queue down), cleanup tmp files via `fsSync.rmSync` AVANT response flush. POST-enqueue, le worker prend ownership via le `finally` de `restoreFullBackupV2`.

**Pipeline processor** : `RestoreFullJobData` gain `tmpUploadPath?` + `tmpSidecarPath?` (mutually exclusive avec `backupId`). `BackupProcessor.handleRestoreFull` branche sur l'existence du `tmpUploadPath` et thread vers `restoreFullBackupV2(...tenantId, null, opts, ..., { tmpZipPath, tmpSidecarPath })`.

**Service skip étapes catalog** : en multipart, `restoreFullBackupV2` skip le `auditLog.findUnique` + `downloadFromBackupBucket` (le ZIP est déjà sur disque). Filename audit log devient synthétique `upload-restore-<iso>.zip`. Champ `RESTORE_FULL_V2.changes.source` = `'multipart-upload' | 'catalog'` pour forensic queries.

**Sidecar source** : multipart lit le sidecar via `fs.readFile(tmpSidecarPath)` au lieu de `fetchSidecar` MinIO. Validation `version === 1 && algo === 'aes-256-gcm'` identique.

**Edge case encrypted-no-sidecar** : pré-pipeline, le service ouvre `tmpZipPath` et peek les 4 premiers bytes. Si ≠ PKZip magic (50 4B 03 04) → `BadRequestException("Uploaded archive does not start with the PKZip magic bytes — usually means the archive is encrypted and you forgot to upload the sidecar JSON")`. Message plus actionable que le generic MagicByteValidator error.

**Cleanup `finally` étendu** dans le service : adopte ownership de `tmpZipPath` ET `tmpSidecarPath`. Garantit 0 orphan tmp file même en exception path.

## Conséquences

### Positives

- **Backup chiffrement opt-in** opérateur via UI toggle server-driven (capabilities discovery). Auth tag intégré, tamper-evident.
- **Observabilité fine** post-mortem via spans par phase dans GlitchTip Performance tab — identification de bottlenecks réels (archive build / MinIO upload / Prisma import) sans Loki grep manuel.
- **Migration cross-tenant** pour scénarios pilote / recovery sur tenant neuf, avec garanties strictes (R1 pre-validation, all-or-nothing remap, skip users, ownership rewrite permanent).
- **Voie multipart upload async** moderne (Bull queue + dry-run + progress polling) remplace le fallback sync DR-only — résout le DR-from-local-ZIP scenario sans coupler à la voie legacy `X-Backup-Sync`.
- **Dette v2.2.1 résolue** : catalog regression-proof si bump format v3 future grâce à la constante centralisée + types narrowing.
- **2 silent loss D.1 fixés** opportunistement (Contact.delegationId + Task.assignedTo) — bénéfice même en same-tenant restore (préserve données source).
- **Bull v3 concurrency 2** (conditional gate post-soak) : throughput backup ×2 sans modification correctness (NK upserts idempotents, tmp paths uniques).

### Négatives / Compromis

- **`XCH_MASTER_KEY` perte = encrypted backups irrécupérables.** Déjà documenté ADR-019 ; runbook opérateur enrichi (`docs/operator/backup-key-rotation.md`).
- **`tracesSampleRate: 1.0` ciblé backup** augmente volume ingestion GlitchTip — acceptable car backup ops low-volume (quelques jobs/tenant/jour) et le sampler exclut les transactions HTTP autres modules.
- **Cross-tenant skip Users** : opérateur doit comprendre que tenantB users existants gardent leurs accès via délégation (warning UI explicite). Source users perdus côté target.
- **Sidecar JSON couple ZIP au keyVersion** : downgrade `XCH_MASTER_KEY` sans conserver `XCH_MASTER_KEY_V<n>` legacy casse les restores. Mitigation : versionning ADR-019 + procédure rotation documentée.
- **Bull concurrency 2 → 4 handlers × 2 = 8 in-flight worst case.** Bottleneck RSS (mesuré < 1 GB sur 5 GB backup D.1, container 4 GB → headroom OK). Gate strict avant merge.
- **3 ownership FK existing fallback** non comptabilisées dans `rewrittenOwnership` counter (FloorPlan.uploadedBy, Photo.uploadedBy, Attachment.uploadedBy). Counter ne reflète que les 4 ownership FK explicitement rewritten via le helper.

### Forward dependencies (Track D.3 ou plus tard)

- Backup incrémental (diff depuis last full)
- Compression alternative (zstd, lz4)
- Backup automatique programmé (`@Cron`)
- Multi-region MinIO failover
- Compliance audit reports (RGPD, SOC2)
- **Hard removal X-Backup-Sync** (v2.4.0, après 1 cycle deprecation v2.3.0)
- Concurrency > 2 (si data prod justifie)
- Schema migration `Photo.contentHash` + `Expense.receiptFile` (NK fallback v2.3.0 suffisant)
- Crypto agility (AES-GCM-SIV, ChaCha20-Poly1305) — sidecar `version: 1` prêt à recevoir bump
- Sentry SDK v8 migration (`instrumentation-client.ts` auto-load Next.js 15.3+, `Sentry.startSpan` sans `tracesSampleRate` requis)
- STORAGE_AUDIT_ACTIONS relocation (sortir STORAGE_CLEANUP de BACKUP_AUDIT_ACTIONS)
- `resolveConflicts: 'merge' | 'overwrite' | 'skip'` policy pour restore (currently skip-if-exists semantic)

## Patterns figés Track D.2

| Pattern | Rationale | Fichier référence |
|---|---|---|
| Cipher Transform en aval HashingStream archive | Déterminisme sha256 archive préservé (hash sur plaintext bytes, peu importe `encrypt` on/off) | `backup.service.ts:buildArchiveV2ToTmp` |
| Sidecar versionné `version: 1` | Crypto agility future (AES-GCM-SIV, ChaCha20) sans migration painful | `backup.service.ts:BackupSidecarV1` |
| Atomicity zip-before-sidecar | Orphan zip détectable comme plaintext (NoSuchKey sidecar) ; orphan sidecar inexistant | `backup.service.ts:uploadTmpToBackupBucket` |
| Magic byte intercept AFTER decipher | Validator voit toujours plaintext PKZip ; tamper ciphertext = auth tag fail avant magic byte | `backup.service.ts:restoreFullBackupV2` |
| 3 forward-errors jumpers `.pipe().pipe()` | Node ne propage pas errors entre stages adjacents (ADR-025 étendu de 2 à 3 jumpers en encrypted path) | `backup.service.ts:restoreFullBackupV2` |
| HTTP 412 + worker invariant check | Double-check encrypt:true vs `XCH_MASTER_KEY` (UI grey + controller 412 + worker throw) | `backup.controller.ts` + `backup.service.ts` |
| scrubEvent fail-closed multi-emplacement | Parité ADR-024 ; bundle scan span.description + span.attributes + transaction.tags | `glitchtip/init.ts` + `scrubber.ts` |
| tracesSampler op-prefix filter | Sample backup ops à 100%, drop HTTP auto-instrumentation latent | `glitchtip/init.ts` |
| Caller-site sub-spans | Spans aux call sites (createFullBackupV2, restoreFullBackupV2) PAS dans méthodes privées — minimise diff line-count | `backup.service.ts` + `backup.processor.ts` |
| `remapDelegation` all-or-nothing | Schema invariant R1 trivialement satisfait post-remap (entité ET site enfant → même target) | `backup.service.ts:applyDataFilesToDbInner` |
| `rewriteOwnership` PERMANENT vers caller | Audit traçabilité préservée même si caller perd manage rights post-restore (validation V3) | `backup.service.ts:applyDataFilesToDbInner` |
| Pre-remap `validateInvariants` R1 sur 4 modèles | Évite propager bug source vers target tenant silently — abort propre AVANT toute écriture | `backup.service.ts:applyDataFilesToDbInner` |
| Skip Users loop en cross-tenant | Évite collisions email tenant cible ; warning UI + audit log RESTORE_CROSS_TENANT | `backup.service.ts:applyDataFilesToDbInner` |
| Permission gate côté service (pas controller direct) | Test-friendly + reuse-friendly ; generic 403 = no info leak | `backup.service.ts:assertTargetDelegationAccessible` |
| AuditLog.action = `String` typed | Ajout `RESTORE_CROSS_TENANT` sans Prisma migration — règle "D.2 add-only sans migration DB" préservée | `backup.actions.constants.ts` |
| Multipart `diskStorage` + uuid uniqueness | 2 opérateurs simultanés sans collision tmp path ; 50 GB upload limit | `backup.controller.ts:restoreFullBackupFromUpload` |
| Encrypted-no-sidecar peek pre-pipeline | Open + read 4 bytes AVANT pipeline → message actionable "forgot to upload the sidecar" | `backup.service.ts:restoreFullBackupV2` |
| `BACKUP_AUDIT_ACTIONS as const` + `BackupAuditAction` type | Type narrowing, prévention régression catalog v2.2.1 | `backup.actions.constants.ts` |
| `BACKUP_QUEUE_CONCURRENCY` constant centralisée | Single-constant rollback si gate smoke fail au merge | `backup.queue.ts` |
| `XCH_LOG_MARKER X-Backup-Sync` grep marker | Ops grep prod logs pour confirmer 0 callers avant v2.4.0 hard delete | `backup.controller.ts:logSyncDeprecationWarn` |
| Swagger `@ApiHeader deprecated: true` | OpenAPI badge automatique côté client UI + description prefix "**DEPRECATED**" | `backup.controller.ts` |

## Alternatives considérées

1. **Cipher Transform UPSTREAM du HashingStream** — rejeté : hash de l'archive bascule selon `encrypt` on/off → casse les tests déterministes D.1.
2. **`XCH_BACKUP_KEY` séparée de `XCH_MASTER_KEY`** — rejeté : 2 lifecycles de rotation distincts, complexité ops, justification marginale pour pilot product.
3. **`tracesSampleRate: 1.0` global** — rejeté : flood traces parasites des HTTP auto-instrumentation latent. `tracesSampler` ciblé op-prefix est plus chirurgical.
4. **`integrations: defaultIntegrations.filter(i => i.name !== 'Http')`** — rejeté : ampute les HTTP breadcrumbs utiles pour debug captureException.
5. **Sentry SDK v8 upgrade pré-D.2** — rejeté : scope creep, défer session dédiée. v7.91 + tracesSampler workaround suffit.
6. **Cross-tenant user upsert dans target** — rejeté : collisions email (même email source vs target = personnes différentes) + pollution tenant cible.
7. **`resolveConflicts: 'overwrite'` cross-tenant** — rejeté D.2 : skip-if-exists semantic D.1 préservé. Feature backlog D.3 si besoin réel.
8. **Multipart sync HTTP timeout 1h** — rejeté : reverse proxy timeout 30-60s par défaut → 504 + retry user → backup parallèle silencieux (cf ADR-025).
9. **Hard removal X-Backup-Sync D.2** — rejeté : 1 cycle deprecation requis par scope MCP. Précondition §6 multipart upload doit être validée prod d'abord.
10. **Bull queue-level concurrency `BullModule.registerQueue({ processors: [{ concurrency }] })`** — non nécessaire : decorator-level `@Process({ concurrency })` accepté par Bull v3 + @nestjs/bull v10 (validation V1 résolue).
11. **Schema migration immédiate `Photo.contentHash` + `Expense.receiptFile`** — rejeté D.2 (règle "add-only sans migration DB"). NK fallback v2.3.0 suffit, migration différée D.3 ou +.

## Validation pre-merge

Checklist d'acceptance D.2 (cf MCP `XCH_TRACK_D2_BACKUP_V2_2026_05_14`) :

- [x] Round-trip encrypt on + restore OK (spec backup-v2.service.spec.ts encryption block)
- [x] Round-trip encrypt off + 0 sidecar uploadé (D.1 tests préservés)
- [x] Tamper byte ciphertext → 400 auth-tag avant magic byte (spec)
- [x] `keyVersion: 99` sidecar → 400 explicit "Unknown key version" (spec)
- [x] Cross-tenant A→B + delegationId remap + 0 leak A (spec applyDataFilesToDb + return shape)
- [x] Cross-tenant + skip users + ownership rewrite vers caller admin (spec skippedCrossTenantUsers + rewrittenOwnership counters)
- [x] Pre-remap invariant R1 violation source → BadRequestException (spec validateInvariants)
- [x] Permission gate target hors tenant → 403 generic (spec assertTargetDelegationAccessible)
- [x] GlitchTip spans : tracesSampler op-prefix filter + scrubEvent transactions parité (spec scrubber.spec.ts 7 cases)
- [x] X-Backup-Sync warn log + Swagger deprecated (spec controller 3 cases X-Backup-Sync)
- [x] BACKUP_ACTIONS catalog regression v2.2.1 préservée (spec backup.actions.constants.spec.ts)
- [x] Multipart upload : happy plaintext + encrypted+sidecar + sans sidecar 400 + mutual exclusivity (spec 4 cases multipart)
- [ ] **Soak gate ≥ 2026-05-21 respecté avant merge** (à valider au merge time)
- [ ] **Step 6 concurrency 2 gate strict** : RSS p95 < 50%, 0 OOM, 0 audit failed (à valider au merge time, sinon revert b41f042)
- [ ] **GlitchTip UI staging validé** : 1 backup réel post-deploy xch-deploy → trace visible avec 5 child spans (post-deploy smoke v2.3.0)

## Post-deploy smoke v2.3.0

À exécuter sur `xch-deploy` après tag `v2.3.0` + rebuild :

```bash
ssh xch-deploy
cd /opt/xch-dev/XCH
git fetch --tags && git checkout v2.3.0
docker compose build backend backend-worker frontend
docker compose up -d backend backend-worker frontend
bash scripts/audit-egress.sh --strict
```

Procédure smoke (12 cas, détaillée plan v3 §"Smoke procedure post-merge") :

1. Backup tenant pilote `encrypt: true` → catalog row icône cadenas + sidecar `.enc.json` présent MinIO
2. Restore same-tenant → counts match source
3. Cross-tenant : backup A → restore B avec `targetDelegationId` → (a) 0 FK violation, (b) delegationId pointe B, (c) 0 leak A, (d) audit row `RESTORE_CROSS_TENANT` présente
4. Ouvrir GlitchTip Performance tab → trace `backup.full` avec 2 child spans (archive-build + minio-upload) + tag `backup_format_version=2`. Trace `backup.restore.full` avec 2+5 child spans (download + prisma-import × 5 phases).
5. `curl -H "X-Backup-Sync: 1" -X POST .../backup/full` → 200 + warn log `XCH_LOG_MARKER X-Backup-Sync` présent
6. (Si step 6 shipped) 2 backups concurrents tenants différents → both complete, `docker stats` RSS < 50% mem_limit
7. Negative : tamper byte ciphertext MinIO → 400 explicit auth-tag error
8. Negative : caller sans manage target → 403 generic
9. Rotation key smoke : régénérer `XCH_MASTER_KEY` en `_V2`, conserver `_V1`, rebuild backend → backup v1-encrypted restorable (cf `backup-key-rotation.md`)
10. Multipart upload smoke : download ZIP local, delete catalog row, re-upload via `POST /backup/full/restore-upload` multipart → restore OK + tmp cleaned
11. Multipart upload encrypted : download encrypted ZIP + sidecar, delete row, re-upload les 2 fichiers → restore decrypt OK
12. BACKUP_ACTIONS regression : catalog liste v1 + v2 backups (v2.2.1 préservée) + nouvelle action `RESTORE_CROSS_TENANT` visible si test 3 ran

Documenter les résultats dans MCP `XCH_RELEASE_v2_3_0` (event_log à créer post-merge).
