# XCH — Secrets rotation

> **Scope** : rotation périodique des secrets XCH (JWT, MinIO, Redis, Postgres, master key ADR-019, GlitchTip, SMTP, LUKS) via le script `rotate-secrets.sh` + procédures complémentaires.
> Placeholders : `<DEPLOY_HOST>`, `<COMPOSE_DIR>`, `<ADMIN_EMAIL>`.

---

## 1. Cadence recommandée

| Secret | Cadence | Phase script |
|---|---|---|
| `JWT_SECRET` + `JWT_REFRESH_SECRET` | Trimestriel ou post-incident | A |
| `MINIO_ACCESS_KEY` + `MINIO_SECRET_KEY` | Trimestriel | A |
| `REDIS_PASSWORD` | Trimestriel | B |
| `XCH_MASTER_KEY` (ADR-019) | Annuel + rotation backup re-chiffrement (cf. [backup-key-rotation.md](backup-key-rotation.md)) | C |
| `POSTGRES_PASSWORD` | Annuel (downtime brève) | manuel + restart postgres |
| GlitchTip DSNs | Régénération si compromis ; rotation rare | `gen-dsn.sh` ré-exécution |
| SMTP credentials | Selon politique fournisseur | manuel `.env` patch |
| LUKS passphrase | Annuel OU sur turnover admin | `cryptsetup luksAddKey` + `luksRemoveKey` |

---

## 2. Script `rotate-secrets.sh` (Phases A/B/C)

```bash
# Phase A — JWT + MinIO (≤ 30 sec downtime backend)
bash <COMPOSE_DIR>/scripts/rotate-secrets.sh --phase a

# Phase B — REDIS_PASSWORD (compose modifié)
bash <COMPOSE_DIR>/scripts/rotate-secrets.sh --phase b

# Phase C — XCH_MASTER_KEY (rotation backup re-chiffrement séparé)
bash <COMPOSE_DIR>/scripts/rotate-secrets.sh --phase c

# Phase all — A puis B avec confirmation
bash <COMPOSE_DIR>/scripts/rotate-secrets.sh --phase all
```

Le script :
- Backup `.env` timestampés (`.env.bak.YYYYMMDD-HHMMSS.<phase>`)
- Génère nouveaux secrets via openssl
- Patch atomique des `.env`
- Restart backend/worker/minio selon phase
- Healthcheck `/api/health` (60s timeout)
- Smoke test login admin

Mode `--dry-run` : affiche sans modifier.
Mode `--yes` : skip confirmations interactives.

---

## 3. POSTGRES_PASSWORD rotation (manuel, brève downtime)

```bash
# 1. Snapshot pré-rotation
bash <COMPOSE_DIR>/scripts/backup-full.sh

# 2. Generate new password
NEW_PG_PASS=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 32)

# 3. Change inside Postgres
docker exec xch-postgres psql -U xch_user -d xch_dev \
  -c "ALTER USER xch_user WITH PASSWORD '$NEW_PG_PASS';"

# 4. Update .env files
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$NEW_PG_PASS|" <COMPOSE_DIR>/.env
sed -i "s|postgresql://xch_user:[^@]*@|postgresql://xch_user:$NEW_PG_PASS@|" <COMPOSE_DIR>/backend/.env

# 5. Recreate backend (force-recreate pour env_file reload)
docker compose -f <COMPOSE_DIR>/docker-compose.yml up -d --force-recreate backend backend-worker

# 6. Validation
curl -s https://<DEPLOY_DOMAIN>/api/health | jq .db
# attendu : "up"
```

---

## 4. XCH_MASTER_KEY rotation + backup re-chiffrement

Cf. [backup-key-rotation.md](backup-key-rotation.md) (Track D.2 livrable). Procédure complète :
1. Phase C `rotate-secrets.sh --phase c` génère nouvelle clé
2. Anciens backups encrypted sont déchiffrables avec ancienne clé (sidecar `.enc.json` contient `keyVersion`)
3. Re-chiffrer anciens backups via UI Settings > Backup > Re-encrypt (optionnel)
4. Conserver ancienne clé dans vault jusqu'à confirmation de re-chiffrement

---

## 5. LUKS passphrase rotation

Cf. [offsite-backup.md §5.3](offsite-backup.md#53-rotation-passphrase).

```bash
# Multi-slot LUKS : ajouter avant retirer (zero-downtime)
sudo cryptsetup luksAddKey /dev/sdb1
# Entrer ANCIENNE passphrase pour autoriser
# Entrer NOUVELLE passphrase

# Tester avec la nouvelle
sudo cryptsetup luksOpen /dev/sdb1 test_new
sudo cryptsetup luksClose test_new

# Retirer l'ancienne
sudo cryptsetup luksRemoveKey /dev/sdb1
# Entrer l'ANCIENNE pour suppression

sudo cryptsetup luksDump /dev/sdb1 | grep -A 2 Keyslot
```

---

## 6. GlitchTip DSNs régénération

Si DSN compromis OU rotation projet :

```bash
cd <COMPOSE_DIR>
bash glitchtip/scripts/gen-dsn.sh   # idempotent : GET existing si présents, sinon CREATE
# Si besoin de FORCE new : delete project via UI puis re-exec
```

Injecter nouveaux DSNs dans `backend/.env` + `.env` root + `docker compose up -d --force-recreate backend backend-worker frontend`.

---

## 7. Key escrow (vault opérateur)

Patterns recommandés (cf. [offsite-backup.md §5.2](offsite-backup.md#52-patterns-recommandés)) :
- Sealed envelope (coffre physique)
- Shamir secret sharing (3-of-5 via `ssss-split`)
- Vault opérateur (Bitwarden self-hosted, KeePass partagé)
- Fichier GPG-chiffré

**Anti-patterns à éviter** :
- Passphrase en clair sur le serveur
- Email/messagerie non chiffrée
- Mémorisée par une seule personne

---

## 8. Audit log rotation

Cf. ADR-028 audit log enrichment (Track E.4) — colonnes `ipAddress`/`userAgent`/`delegationId` enrichissement. Rétention :
- Pilote employeur : 1 an + purge cron mensuelle (D4.3 décision RSI)
- Cloud public : 7 ans (S3 lifecycle)

---

## 9. Cross-références

- Script : [scripts/rotate-secrets.sh](../../scripts/rotate-secrets.sh)
- Backup key rotation : [backup-key-rotation.md](backup-key-rotation.md)
- LUKS rotation : [offsite-backup.md §5.3](offsite-backup.md#53-rotation-passphrase)
- Server hardening : [server-hardening.md](server-hardening.md)
- ADR secrets at-rest : [docs/decisions/adr-019-secrets-at-rest-encryption.md](../decisions/adr-019-secrets-at-rest-encryption.md)
- ADR audit log enrichment : [docs/decisions/adr-028-audit-log-enrichment-skipdelegation-taxonomy.md](../decisions/adr-028-audit-log-enrichment-skipdelegation-taxonomy.md)
