# ADR-025 : Backup v2 streaming (idempotent restore + dry-run + Bull v3 async)

Date : 2026-05-14
Statut : Accepté
Tag cible : v2.2.0 (Track D.1 — Backup v2 Core, scope figé MCP `XCH_TRACK_D1_BACKUP_V2_2026_05_10`)

Dépendances :
- ADR-014 (monitoring natif BullMQ — pattern queue/processor réutilisé)
- ADR-017 (Prisma versioned migrations — D.1 n'introduit aucune migration DB)
- ADR-019 (chiffrement at-rest — déferré Track D.2)
- ADR-020 (Notifications BullMQ refacto — template direct pour BackupProcessor)
- ADR-023 (DTO discipline — backup module déjà conforme cascade, étendu D.1)
- ADR-024 (GlitchTip air-gap observability — capture Sentry gratuite via `WorkerEventLogger`)

## Contexte

Track C v2.1.3 (commit `a497675` PR #67) a livré un backup fonctionnellement
complet côté **données** :
- `exportAllTenantData()` couvre 19 tables (10 originales + 9 ajoutées Track C :
  Photo, AssetMovement, TaskComment, ConnectivityLink, SiteHealthSnapshot,
  BillingEntity, Expense, CostAllocation, Budget)
- `restoreFullBackup()` symétrique avec FK ordering strict + Budget hierarchy
  2-pass

**Mais le backup v1 n'est pas DR-ready en prod** :

1. **OOM sur multi-GB** — `createFullZip()` construit le ZIP via
   `Buffer.concat(chunks)` ([backup.service.ts:1582,1613](backend/src/modules/backup/backup.service.ts:1582))
   et `uploadToBackupBucket(buffer)` passe le Buffer entier à
   `minioClient.putObject(bucket, name, buffer, length)`. Sur un tenant
   pilote employeur de plusieurs GB, le worker Node.js OOM avant la fin
   du backup.

2. **Restore in-memory** — `restoreFullBackup()` ([backup.service.ts:526](backend/src/modules/backup/backup.service.ts:526))
   utilise `AdmZip(buffer)` qui charge l'archive entière en mémoire avant
   de l'extraire. Même problème de scaling.

3. **Fichiers MinIO référencés DB seulement** — `collectFiles()`
   ([backup.service.ts:1456](backend/src/modules/backup/backup.service.ts:1456))
   itère les FK (`FloorPlan.fileUrl`, `Photo.fileUrl`, `Attachment.path`)
   et inclut UNIQUEMENT ces blobs. Un blob orphelin dans MinIO (uploadé
   mais jamais référencé) est définitivement perdu — pas DR-safe.

4. **Pas d'idempotence** — re-restorer le même ZIP sur la même DB crée
   des duplicates (ou échoue sur FK conflicts). Empêche tout retry sur
   crash partiel.

5. **Pas de dry-run** — un opérateur qui restore sur un tenant peuplé
   ne peut pas inspecter le diff avant commit. Filet de sécurité absent
   pour le 1er restore prod employeur.

6. **Pas de progress UI** — le sync HTTP attend bloquant pendant la
   durée totale (15-30 min sur multi-GB tenant). UX inacceptable +
   risque de timeout proxy/Nest 30-60s par défaut → 504 + retry user
   → backup parallèle.

7. **`prisma.$transaction` global** — wrap l'intégralité de la
   restauration. Timeout Postgres par défaut 5s, fragile sur gros
   restores.

8. **Magic bytes vérifiés via Buffer** — `validateMagicBytes(zipBuffer)`
   ([backup.service.ts:534](backend/src/modules/backup/backup.service.ts:534))
   attend un Buffer ; incompatible avec un stream brut.

## Décision

Track D.1 ship un backup v2 **streaming end-to-end** avec restore
**idempotent** par natural-key matching, **dry-run preview** safe-default,
et **async Bull v3 jobs** avec polling progress, en préservant la compat
v1 restore-only.

### A. Backup format v2

```
metadata.json                       ← top-level (drop préfixe v1 `full-backup-<ts>/`)
data/<table>.json                   ← une par modèle Prisma
minio/<bucket>/<object-key>         ← mirror 1:1 du bucket entier (orphan-aware)
plans/rendered/<plan-id>.png        ← assets dérivés (overlays pins)
```

Schéma `metadata.json` v2 :

```jsonc
{
  "version": 2,                          // NUMBER (discriminant typeof vs v1 string "1.0")
  "createdAt": "2026-05-14T10:00:00Z",
  "tenantId": "tnt_abc",
  "type": "full",                        // 'full' | 'site' | 'db-only'
  "siteId": null,
  "siteCode": null,
  "appVersion": "2.2.0",
  "buckets": ["xch-storage"],
  "counts": { "sites": 12, "assets": 340, ... },
  "files": {
    "minio/xch-storage/floor-plans/abc.pdf": {
      "size": 482113,
      "sha256": "9f3a...",
      "bucket": "xch-storage",
      "key": "floor-plans/abc.pdf"
    }
  }
}
```

### B. Pipeline streaming backup (zero `Buffer.concat`)

```
exportAllTenantData(tenantId)
       │
       ▼
    archive ──pipeline──▶ fs.createWriteStream(tmpPath)
       ▲ tee archive.on('data') → createHash('sha256')
       │
       ├── data/*.json (small JSON, in-memory)
       ├── minio/<bucket>/<key> via HashingStream (par-file sha256 mid-stream)
       └── metadata.json LAST (files map populated)

fs.stat(tmpPath) → size + archive-level sha256
minio.fPutObject(xch-backups, filename, tmpPath) → streaming upload
try { ... } finally { fs.rm(tmpPath, { force: true }) } → cleanup garanti
```

Implémentation : 5 méthodes service (`createFullBackupV2`,
`streamBucketIntoArchive`, `buildArchiveV2ToTmp`, `uploadTmpToBackupBucket`,
`HashingStream`) — détail dans `backend/src/modules/backup/backup.service.ts`.

### C. Pipeline streaming restore

```
minio.getObject(xch-backups, filename) → tmpZipPath
       │
       ▼
createReadStream(tmpZipPath)
       │
       ▼
MagicByteValidator (Transform : buffer 1er chunk ≥4 bytes, valide PKZip 50 4B 03 04)
       │ pipe + forward 'error' → zipStream.destroy(err)
       ▼
unzipper.Parse({ forceStream: true })
       │
       ▼ for-await entries :
           - metadata.json → JSON.parse → v2Metadata
           - <v1-prefix>/metadata.json → délégation legacy AdmZip
           - data/<table>.json → buffer + JSON.parse → dataFiles[table]
           - minio/<bucket>/<key> → pipeline(entry, HashingStream, writeStream)
             → staging dir + record fileMap entry
           - sinon → entry.autodrain()

→ Validation cascade 4 checks :
     a. v1 par prefix OU version string → fs.readFile + restoreFullBackup legacy
     b. metadata absent → BadRequestException('missing or corrupted')
     c. version !== 2 NUMBER → BadRequestException(`Unsupported: ${v}`)
     d. per-file sha256 verify contre metadata.files[entry]
        → invalidChecksums[] / missingFiles[]

→ Si dryRun:true → DryRunReportResponseDto (no writes)
→ Sinon real run :
     - 5 prisma.$transaction({ timeout: 60_000 }) séquentielles par phase FK
     - applyDataFilesToDb avec upsertByNaturalKey skip-if-exists
     - MinIO uploads post-tx via fPutObject (outside, non-transactionnel)

finally { fs.rm(tmpZipPath, { force: true }) + fs.rm(stagingDir, { recursive: true, force: true }) }
```

### D. Idempotence per-table via natural keys

Helper `upsertByNaturalKey<T>(tx, modelName, where, createData, options)` +
`findExistingByNaturalKey` extracted (réutilisé par dry-run et upsert).
Skip-if-exists semantic (pas de field-level merge en v2.2.0 — future feature
`resolveConflicts` si besoin).

19 tables couvertes par 5 transactions séquentielles avec timeout 60s :

| Phase | Tables | Natural key strategy |
|---|---|---|
| 1. Tenant config | ContactType, Contact, User | `(tenantId, slug)`, `(tenantId, name, typeId)`, `(tenantId, email)` |
| 2. Sites + structure | Site, Rack, Asset, FloorPlan, Pin | `(tenantId, code)`, `(tenantId, siteId, name)`, `(tenantId, siteId, serialNumber)` fallback `name`, `(siteId, title, version)`, `(floorPlanId, x, y, pinType)` |
| 3. Lifecycle | AssetMovement, Task, TaskComment, Attachment, Photo | `(assetId, timestamp, fromSiteId, toSiteId)`, `(tenantId, siteId, title, createdAt)`, `(taskId, authorId, createdAt, body[:64])`, `(tenantId, path)`, `(entityType, entityId, fileUrl)` |
| 4. Finance | BillingEntity, Expense, CostAllocation, ConnectivityLink, Budget | `(tenantId, code)`, **Expense fallback `receiptFile null`** : `(tenantId, totalAmount, dateIncurred, label.trim().toLowerCase())`, `(expenseId, targetId)`, `(tenantId, siteId, role, assetId)`, Budget 2-pass parent-then-children |
| 5. Snapshots | SiteHealthSnapshot, AuditLog | `tx.upsert(siteId)` natif Prisma, AuditLog **SKIPPED** (restaurer corrompt forensic trail) |

GPS coords raw SQL (`ST_SetSRID(ST_MakePoint, 4326)`) appliquées
uniquement sur création (préserve operator edits sur re-restore).

### E. Async Bull v3 + polling progress

- Queue dédiée `backup-jobs` via `BullModule.registerQueue` (concurrency 1
  default — pas de jobs parallèles ; `attempts: 1` ; `timeout: 2h`)
- `BackupProcessor` reprend strictement le pattern `MonitorProcessor`
  ([monitoring/monitor.processor.ts:47](backend/src/modules/monitoring/monitor.processor.ts))
- 4 `@Process` handlers : `backup-full`, `backup-site`, `restore-full`,
  `restore-site` (parqué D.2)
- `@OnQueueCompleted` + `@OnQueueFailed` avec retry guard pattern (n'émet
  qu'après retries exhausted)
- `WorkerEventLogger` injecté → capture Sentry/GlitchTip gratuite via
  ADR-024 (tags `mode=worker queue=backup-jobs job_name=...`)
- Endpoints API :
  - `POST /backup/full|/site/:id|/full/restore` retournent **202 +
    `BackupJobEnqueuedResponseDto { jobId }`** par défaut
  - Header `X-Backup-Sync: 1` force le path v1 sync (fallback urgence
    si Redis down — slated for removal D.2)
  - `GET /backup/jobs/:jobId` → `JobStatusResponseDto` polled par
    frontend `useBackupJob(jobId)` toutes les 2 s
  - Bull v3 states non-DTO (`delayed`, `paused`, `stuck`, `unknown`)
    mapped → `waiting` pour robustesse frontend

**Clarification terminologique** : `XCH_TRACK_D_BACKUP_V2_SCOPE` et
ADR-020 disent « BullMQ » mais la stack utilise en réalité **Bull v3**
via `@nestjs/bull` v10 + `bull` v4.12. API : `job.progress(value)`
accepte number ou objet ; decorators `@Process(name)` + `@OnQueueCompleted` +
`@OnQueueFailed` (legacy). Pas BullMQ v5 (qui aurait FlowProducer, job
groups, workers concurrency par job name).

### F. Dry-run safe-default

`POST /backup/full/restore { backupId, dryRun: true }` (default UI) :
- Pipeline complet (download, magic byte, unzip, parse, sha256 verify)
- Probe natural keys via `applyDataFilesToDb(..., { dryRun: true })`
- Flag `_dryRunMode` set sur le service via `try/finally` (concurrency-safe
  vu Bull queue concurrency 1)
- `upsertByNaturalKey` placeholder branch — retourne `{ id: __dryrun__<model>_<N> }`
  au lieu de `create()`. FK chain followable via idMap.
- GPS raw SQL + MinIO uploads gated sur `!dryRun`
- Retourne `DryRunReportResponseDto` :
  - `wouldCreate: Record<table, number>` (NK no-match)
  - `wouldSkip: Record<table, number>` (NK match)
  - `wouldUpdate: {}` (skip-if-exists semantic, pas de field-level merge)
  - `missingFiles: string[]` + `invalidChecksums: string[]`
  - `totalSize` + `estimatedDurationSec` (50 MB/s model)

UI frontend : Switch dry-run **default `true`** dans le restore dialog,
opérateur doit explicitement décocher pour real run, ou cliquer
« Confirmer l'application réelle » après dry-run.

### G. Frontend `useBackupJob` hook

```ts
function useBackupJob(jobId: string | null): {
  status: BackupJobStatus | null;
  isRunning: boolean;       // waiting | active
  isCompleted: boolean;     // completed
  isFailed: boolean;        // failed
  isUnknown: boolean;       // 404 ou erreur réseau (Redis flush, etc.)
  error: string | null;
  result: unknown;
}
```

Polling 2000 ms. Stop on terminal state (completed / failed / unknown).
Cleanup `setInterval` au unmount + au changement de jobId.

### H. Compat v1 restore-only

- Détection automatique par `typeof metadata.version` :
  - `'string'` (v1, `'1.0'`) → délégation `restoreFullBackup(buffer, …)`
    legacy via `fs.readFile(tmpZipPath)`
  - `number` (v2) → pipeline streaming
- ZIP v1 layout `full-backup-<ts>/metadata.json` détecté aussi par regex
  sur entry path (Track D.1 redondance défensive)
- v1 archives sont small par construction (RAM-bounded — c'est exactement
  la raison d'être de Track D.1) → AdmZip in-memory acceptable

## Conséquences

### Positives

- **DR-ready scale** : RSS worker < 1 GB sur backup 5 GB tenant (vérifié
  Test 1 round-trip step 8 sur xch-deploy)
- **Idempotence stricte** : re-restore = `_created: 0` sur DB peuplée
  (regression guard via Test 2)
- **Orphan blob inclusion** : full bucket walk capture les fichiers MinIO
  non référencés DB (Test 3 + critère acceptance D.1)
- **Dry-run safe-default** : opérateur ne peut PAS accidentellement
  écraser des données — Switch checked par défaut
- **Async progress UI** : `useBackupJob` + Bull progress = barre live,
  pas de timeout proxy/Nest
- **Per-file sha256 integrity** : verify à la restauration, mismatch =
  `BadRequestException` clair
- **Sentry/GlitchTip capture gratuite** : `WorkerEventLogger.jobFailed` →
  `Sentry.captureException` avec tags `mode=worker queue=backup-jobs`
  (ADR-024 hérité)
- **Coexistence v1/v2** : aucun breaking endpoint, v1 restore legacy
  préservé pour archives existantes

### Négatives (acceptées)

- **Format v2 incompatible avec v1 réception** : un employeur sur v1
  existant ne peut PAS restorer un v2 ZIP. Mais v2 PEUT restorer un v1
  ZIP (délégation). One-way migration acceptable — les archives sont
  produites par la même version qui les restaure.
- **Skip-if-exists semantic v2.2.0** : un re-restore avec data modifiée
  sur NK match ne propage PAS les changements. Feature `resolveConflicts`
  ('overwrite' | 'skip' | 'merge') en backlog si besoin réel.
- **Photo content-hash via `fileUrl`** : schema Photo n'a pas `contentHash`
  column. NK utilise `(entityType, entityId, fileUrl)` qui est équivalent
  en pratique (le fileUrl = MinIO key, unique par upload). Future
  migration schema ajoutera `Photo.contentHash` pour dedup strict.
- **Expense `receiptFile` column absente** : schema Expense n'a pas encore
  `receiptFile`. NK active = fallback `(tenantId, totalAmount, dateIncurred,
  label.trim().toLowerCase())`. Future migration ajoutera la column ;
  helper lit `exp.receiptFile` dynamiquement → upgrade transparent.
- **Instance flag `_dryRunMode` global au service** : pragma vs refactor
  18 call sites `upsertByNaturalKey`. Concurrency-safe sous Bull queue
  concurrency 1. Si concurrency monte > 1, refactor en options thread
  requis (documenté inline).
- **Redis state journal `backup:restore:<jobId>:phase:<n>:done`** :
  parqué en backlog. Sans état journal, un crash mid-phase oblige le
  caller à re-run le restore entier — idempotence rend ça safe.
- **AuditLog SKIPPED** : restaurer corrompt forensic trail. Documenté.
  Le real audit log courant reste intact.
- **`HttpStatus.INSUFFICIENT_STORAGE` (507) absent du @nestjs/common enum** :
  literal 507 utilisé dans `InsufficientStorageException` (RFC 4918 §11.5).

### Forward dependencies (Track D.2)

- Chiffrement AES-256-GCM streaming (réutilise `CryptoService` ADR-019,
  toggle UI, sidecar `<filename>.enc.json`)
- Observabilité GlitchTip approfondie (spans per-phase backup/restore)
- Cross-tenant restore mapping (`delegationId` remap)
- Suppression du fallback `X-Backup-Sync: 1`
- Async multipart upload restore (tmp staging + enqueue)
- Concurrency BullMQ > 1 (data-driven post-D.1 prod metrics)

## Patterns figés Track D.1

| Pattern | Rationale | Fichier référence |
|---|---|---|
| `HashingStream extends Transform` | Pattern Node v16+ propre, backpressure native via `.pipe()`, `_transform` sync + `digest()` finalisé après `end` | `backup.service.ts:HashingStream` |
| `MagicByteValidator extends Transform` | Buffer 1er chunk ≥4 octets, valide PKZip 50 4B 03 04, EOF prématuré → BadRequestException explicite | `backup.service.ts:MagicByteValidator` |
| `.pipe().pipe()` forward errors manuel | Node moderne ne propage PAS les errors entre `.pipe().pipe()`. Pattern : `validator.on('error', err => zipStream.destroy(err))` + `fileStream.on('error', err => validator.destroy(err))` | `backup.service.ts:restoreFullBackupV2` |
| `archiver` déterminisme | Pas de `{ date: ... }` sur entries — sinon mtime casse sha256 déterministe. JSDoc inline warning. | `backup.service.ts:buildArchiveV2ToTmp` |
| `unzipper.Parse({ forceStream: true })` | Mode async iterable obligatoire pour `for-await` pattern | `backup.service.ts:restoreFullBackupV2` |
| 5 phases FK ordering | Tenant config → Sites+structure → Lifecycle → Finance → Snapshots+audit. Chacune `{ timeout: 60_000 }`. | `backup.service.ts:applyDataFilesToDbInner` |
| Budget 2-pass parent-then-children | Roots (parentId null) first, puis itère tant que progrès possible | `backup.service.ts:applyDataFilesToDbInner` |
| GPS raw SQL on creation only | `ST_SetSRID(ST_MakePoint, 4326)` uniquement si `wasCreated:true`. Préserve operator edits sur re-restore. | `backup.service.ts:applyDataFilesToDbInner` |
| Discriminated result union | `{ kind: 'dry-run' \| 'applied' \| 'delegated-v1', … }` force le caller à narrow le type | `backup.service.ts:RestoreFullV2Result` |
| Double `try/finally cleanup` | `fs.rm(tmpZipPath, { force: true })` + `fs.rm(stagingDir, { recursive: true, force: true })` | `backup.service.ts:restoreFullBackupV2` |

## Alternatives considérées

1. **Sync HTTP timeout 1h** — rejeté. Reverse proxy timeout 30-60s par
   défaut → 504 + retry user → backup parallèle silencieux. Pas de
   vraie progress bar côté UI.
2. **SSE pour progress** (vs polling) — rejeté. SSE nécessite un
   controller method dédié + CORS-aware Express keep-alive + re-auth
   sur refresh ; pour 0-100% toutes les 2s, polling REST est dramatiquement
   plus simple et aligné avec `monitor.processor.ts` pattern. SSE reste
   nice-to-have Track E.
3. **Clear-then-create global avec confirmation UI** (restore) — rejeté.
   Wipe + recreate perd les données entre backup et restore — inacceptable
   DR. Idempotence per-NK est plus sûre.
4. **Append-only naive + warn UI** — rejeté. Duplique sur re-restore =
   pollution catalog. Idempotence est non-négociable pour DR.
5. **`prisma.upsert` natif** — rejeté pour la plupart des tables.
   Prisma `upsert` exige une `@@unique` constraint définie sur le where ;
   nos natural keys sont des composites variables (siteId+name fallback
   siteId+serialNumber, etc.). `findFirst + create` plus flexible.
   Exception : `SiteHealthSnapshot` a `@unique(siteId)` → `tx.upsert`
   natif utilisé.
6. **`stream.pipeline()` end-to-end pour restore** — rejeté. Incompatible
   avec `for-await` consumer pattern d'unzipper. Forward errors manuels
   acceptés.
7. **Schema migration `Photo.contentHash` + `Expense.receiptFile`
   immédiate** — rejeté. Out of D.1 scope (pas de migration DB step 4
   décision). Fallback NK actif aujourd'hui, upgrade transparent quand
   migration arrive.

## Validation pre-merge

Checklist d'acceptance D.1 (cf `XCH_TRACK_D1_BACKUP_V2_2026_05_10`) :

- [x] Backup 5 GB tenant termine sans OOM (RSS worker < 1 GB max)
- [x] Restore symétrique : sha256(blob) avant wipe == sha256(blob) après restore (Test 1 integration step 8)
- [x] Re-restore = `_created: 0` sur DB déjà restaurée (Test 2 integration step 8)
- [x] Dry-run report fidèle (compté == exécuté sur run réel suivant — verify count match step 8)
- [x] Progress bar UI atteint 100% avant `completed` event (Playwright E2E step 8 + visual check)
- [x] Backup v1 existant restore correctement via la branche legacy (unit tests step 3 tests 5 + 5b)
- [x] Disque < 1.2 × estimé → HTTP 507 clean, pas de tmp orphelin (`InsufficientStorageException` unit-tested step 1)
- [x] Magic byte invalide → BadRequestException explicite (step 3 test 2)
- [x] Metadata corrompue → BadRequestException explicite (step 3 tests 3 + 4)
- [ ] **GlitchTip UI staging validé** : à exécuter en post-deploy smoke v2.2.0 (procédure runbook ci-dessous)

## Post-deploy smoke v2.2.0 (GlitchTip critère #10)

À exécuter sur xch-deploy après le tag v2.2.0 + rebuild :

```bash
ssh xch-deploy
cd /opt/xch-dev/XCH
git fetch && git checkout v2.2.0
docker compose build backend backend-worker frontend
docker compose up -d backend backend-worker frontend

# Identifier un backup existant à utiliser comme source.
curl -fsS http://localhost:3002/api/backup/list -H "Cookie: $SESSION" | jq '.backups[0].id'

# Stop MinIO pour forcer un job restore-full failure.
docker compose stop minio

# Enqueue le restore.
curl -X POST http://localhost:3002/api/backup/full/restore \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION" \
  -d "{\"backupId\":\"$BACKUP_ID\",\"dryRun\":false}"
# → { "enqueued": true, "jobId": "<JOB_ID>" }

# Poll le job — doit atteindre state:failed (MinIO injoignable).
curl -fsS http://localhost:3002/api/backup/jobs/$JOB_ID -H "Cookie: $SESSION" | jq

# Re-start MinIO immédiatement (limite l'impact sur autres opérations).
docker compose start minio

# Ouvrir GlitchTip UI : https://glitch.eoncom.io
# Filtrer projet xch-backend → event récent (< 1 min).
# VÉRIFIER les tags :
#   - mode: worker
#   - queue: backup-jobs
#   - job_name: restore-full
#   - runtime: nodejs
# VÉRIFIER scrubber actif :
#   - user.email absent (juste user.id UUID)
#   - request.cookies / Authorization absents
```

Si l'event arrive avec les bons tags → critère #10 ✅. Documenter le
result (event_id GlitchTip) dans `XCH_RELEASE_v2_2_0` MCP entity.

Si tags manquants ou event absent → bug `WorkerEventLogger` injection
dans `BackupProcessor` ; investigation requise avant ouverture du pilote
externe à v2.2.0.
