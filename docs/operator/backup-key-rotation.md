# Operator runbook — Backup key rotation (Track D.2, v2.3.0+)

**Audience** : operators with shell access to the XCH backend host.
**Prerequisite** : Track D.2 v2.3.0 shipped (encryption Step 1+2 — see
[ADR-026 §1](../decisions/adr-026-backup-v2-polish.md)).
**Related** : [ADR-019 secrets-at-rest encryption](../decisions/adr-019-secrets-at-rest-encryption.md)
defines the `XCH_MASTER_KEY` lifecycle ; this runbook extends it for the
backup-archive use case.

---

## Why rotation matters

Backups produced with `encrypt: true` are AES-256-GCM ciphertext.
Their sidecar `<filename>.enc.json` records the `keyVersion` (an
integer) that maps to the master key. A backup encrypted with
`XCH_MASTER_KEY` at the time of write **CANNOT** be decrypted later
without that exact 32-byte key.

The encryption/decryption flow honors a **version registry** :

```
XCH_MASTER_KEY        → currentVersion (always the LATEST key, used to ENCRYPT)
XCH_MASTER_KEY_V1     → legacy key for v1: backups (decrypt only)
XCH_MASTER_KEY_V2     → legacy key for v2: backups (decrypt only)
...
```

When a backup's sidecar says `"keyVersion": 1`, the service looks up
`XCH_MASTER_KEY_V1` first (legacy read), then falls back to
`XCH_MASTER_KEY` if `currentVersion === 1`. If neither resolves to a
registered key, restore fails with `BadRequestException("No master
key registered for version v<N> (set XCH_MASTER_KEY_V<N>)")`.

> **Critical** : if you rotate `XCH_MASTER_KEY` and DO NOT preserve the
> outgoing key as `XCH_MASTER_KEY_V<n>`, every backup ever encrypted
> with that key becomes permanently unreadable. There is no recovery.

---

## Rotation procedure

### 1. Inventory : list which key versions you have backups for

```bash
# On a host with mc (MinIO client) configured or via the AWS S3 SDK :
mc cp --recursive xch-deploy/xch-backups/ /tmp/sidecars/ --include '*.enc.json'
jq -s 'group_by(.keyVersion) | map({keyVersion: .[0].keyVersion, count: length})' /tmp/sidecars/*.enc.json
```

Or query the audit log (`AuditLog.action IN ('BACKUP_FULL_V2', 'BACKUP_SITE_V2')`
with `changes.encrypted === true`) and join MinIO for the sidecars. The
output should look like :

```json
[
  { "keyVersion": 1, "count": 47 },
  { "keyVersion": 2, "count": 3 }
]
```

Every `keyVersion` listed here is one you MUST preserve in the env
(as `XCH_MASTER_KEY_V<keyVersion>`) for restore to remain possible.

### 2. Generate the new key (off the production host)

```bash
# Locally :
openssl rand -base64 32
# → e.g. "X6vMNqK0...32-base64-chars"
```

Stash this in your secret manager (1Password, Vault, etc.). **Do not**
paste the new value into a shared chat or commit it.

### 3. Apply on the production host

```bash
ssh xch-deploy
cd /opt/xch-dev/XCH

# 3a. Capture the OUTGOING key as a legacy V<n>.
#     Assume currentVersion is 1 in this example.
sudo grep '^XCH_MASTER_KEY=' backend/.env | head -1
# → XCH_MASTER_KEY=<old-base64-32B>

# Append the legacy read key (or add to your secret manager-driven .env tooling).
# IMPORTANT : the value MUST be the EXACT same 32-byte key that wrote the
# existing backups — copy-paste the line above with the env var renamed.
sudo tee -a backend/.env <<'EOF'

# Track D.2 — legacy backup decrypt key (kept after rotation 2026-MM-DD)
XCH_MASTER_KEY_V1=<old-base64-32B>
EOF

# 3b. Replace XCH_MASTER_KEY with the NEW v2 key.
sudo sed -i 's|^XCH_MASTER_KEY=.*|XCH_MASTER_KEY=<new-base64-32B>|' backend/.env

# 3c. Optional — bump the currentVersion comment if you also want
# the CryptoService to emit "v2:" envelopes for column secrets.
# Track D.2 backup encryption derives its keyVersion from the live
# currentVersion at encrypt-time (see CryptoService.createCipherStream),
# so the NEW backups will carry "keyVersion": 2 in their sidecar.
```

### 4. Rebuild + restart with the new env

```bash
docker compose build backend backend-worker
docker compose up -d backend backend-worker
docker compose logs backend backend-worker | grep -E 'XCH_MASTER_KEY|CryptoService'
# → expect 0 "MASTER_KEY missing" warns
# → expect potentially "Legacy plaintext secret detected" warns on
#   column-level secrets (these will be re-encrypted on next write —
#   not relevant for backup files)
```

### 5. Smoke-verify both paths

```bash
# (a) Old backup (keyVersion: 1) should still restore via V_1 legacy.
#     Pick an existing encrypted backup row from the catalog :
BACKUP_ID=$(curl -fsS http://localhost:3002/api/backup/list \
  -H "Cookie: $SESSION" | jq -r '.backups[] | select(.encrypted==true) | .id' | head -1)
curl -X POST http://localhost:3002/api/backup/full/restore \
  -H "Content-Type: application/json" -H "Cookie: $SESSION" \
  -d "{\"backupId\":\"$BACKUP_ID\",\"dryRun\":true}"
# → expect 202 + jobId, poll until completed (kind: 'dry-run')

# (b) New backup should encrypt with keyVersion: 2 (or whatever
#     currentVersion is after rotation).
curl -X POST http://localhost:3002/api/backup/full \
  -H "Content-Type: application/json" -H "Cookie: $SESSION" \
  -d '{"encrypt": true}'
# → poll until completed, then verify the sidecar :
mc cat xch-deploy/xch-backups/<new-filename>.enc.json | jq '.keyVersion'
# → 2
```

### 6. Retention policy for legacy keys

Keep each `XCH_MASTER_KEY_V<n>` for **as long as you keep backups
encrypted under that version**. The two retention windows must agree :

- If your backup retention is 90 days, the legacy key must remain
  in the env for at least 90 days after the corresponding rotation.
- If a tenant pilote stops and you delete their backups, you can
  drop the matching legacy V<n> on the next rotation cycle.

The audit log row `BACKUP_FULL_V2.changes.encrypted: true` is the
authoritative inventory — never delete a legacy key based on
filesystem listing alone.

---

## Recovery scenarios

### "I lost the new XCH_MASTER_KEY but kept the env var registered"

Pull the value from your secret manager and write it back to
`backend/.env`. Rebuild + restart. No data loss.

### "I rotated and didn't keep the previous version"

Encrypted backups under the lost key are **permanently unrecoverable**.
You can still restore unencrypted backups (sidecar absent). Future
backups will encrypt under the new key. There is no way to recover
the old ciphertext without the key — this is by design (AES-256-GCM
auth tag verification refuses any other key).

Document the incident in the MCP audit trail and (ideally) reset the
affected tenants from their latest unencrypted backup or live state.

### "Restore fails with 'No master key registered for version v3'"

The backup was encrypted under a key version that isn't in the env.
Locate the value :

1. Check the secret manager for `XCH_MASTER_KEY_V3` (or whatever
   version the error mentions).
2. Add it to `backend/.env` :
   ```
   XCH_MASTER_KEY_V3=<recovered-base64-32B>
   ```
3. Rebuild + restart backend-worker.
4. Retry the restore.

If the value is truly gone, see the previous scenario.

### "I want to re-encrypt an old backup under the new key"

There's no in-place re-encrypt today (out of scope D.2 ; backlog D.3
if pilot demand justifies). The workaround is :

1. Restore the old backup to a staging tenant (dry-run first).
2. Trigger a fresh backup with `encrypt: true` — it'll use the
   current `XCH_MASTER_KEY` (= newest version).
3. Delete the old backup row from the catalog once you've verified
   the new one round-trips clean.

---

## Configuration reference

| Env var | Purpose | Lifecycle |
|---|---|---|
| `XCH_MASTER_KEY` | The CURRENT key (write + read) | Rotated periodically per security policy. The single source of truth for `CryptoService.createCipherStream()` `keyVersion`. |
| `XCH_MASTER_KEY_V<n>` | Legacy READ key | Kept as long as at least one backup with `"keyVersion": n` exists. Drop after audit log + MinIO cleanup confirm zero remaining. |
| `XCH_BACKUP_KEY` | — | **Not used.** ADR-026 §1 explicitly reuses `XCH_MASTER_KEY` to avoid two key lifecycles. Don't introduce a separate backup key without revisiting the ADR. |

## Cross-reference

- [ADR-019 secrets-at-rest encryption](../decisions/adr-019-secrets-at-rest-encryption.md) — original key version system
- [ADR-026 backup v2 polish §1](../decisions/adr-026-backup-v2-polish.md) — encryption stream pattern
- `backend/src/common/crypto/crypto.service.ts` — `createCipherStream` / `createDecipherStream` implementation
- `backend/src/modules/backup/backup.service.ts` — `fetchSidecar` / sidecar JSON shape `BackupSidecarV1`
