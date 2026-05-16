# XCH — Rollback procedure

> **Scope** : rollback rapide d'un déploiement XCH à un tag précédent (code) ± restore data si la régression a touché la DB.
> Placeholders : `<DEPLOY_HOST>`, `<COMPOSE_DIR>`, `<PREVIOUS_TAG>`, `<DEPLOY_DOMAIN>`.

---

## 1. Quand rollback ?

| Signal | Action |
|---|---|
| Smoke 6/6 FAIL post-deploy | Rollback immédiat (code only) |
| `/api/health` 503 stable > 5 min post-deploy | Rollback immédiat (code only) |
| Data corruption détectée (rows manquants, contraintes brisées) | Rollback code + restore depuis backup pré-deploy |
| Régression UX critique (login cassé, dashboard vide) | Rollback code only |
| Bug non-critique mais bloquant pour un user | Hotfix forward (pas rollback) |

---

## 2. Rollback code only (~5 min)

```bash
# Sur la VM cible
ssh <DEPLOY_HOST>
cd <COMPOSE_DIR>

# 1. Identifier le tag précédent stable
git log --oneline --decorate -10
TAG_OLD=<PREVIOUS_TAG>   # ex. v2.3.3

# 2. Checkout
git fetch --tags origin
git checkout "$TAG_OLD"

# 3. Rebuild + restart (CACHE TRAP : --no-cache pour Prisma)
docker compose build --no-cache backend backend-worker frontend
docker compose up -d --force-recreate backend backend-worker frontend

# 4. NPM reload (DNS cache gotcha)
docker exec <NPM_CONTAINER> sh -c 'nginx -s reload'

# 5. Smoke
bash scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>
```

Si smoke 6/6 PASS → rollback réussi. Documenter incident via [incident-response.md §5](incident-response.md#5-post-mortem--apprendre).

---

## 3. Rollback code + restore data (~15-30 min)

Si la régression a corrompu la DB :

```bash
# 1. Rollback code (cf. §2)
git checkout "$TAG_OLD"
docker compose build --no-cache backend backend-worker frontend

# 2. Identifier le backup le plus récent PRE-deploy
curl -s -b /tmp/c.txt https://<DEPLOY_DOMAIN>/api/backup/list | \
  jq '[.backups[] | select(.createdAt < "<DEPLOY_TS>")][0]'
BACKUP_ID=<ID_FROM_LIST>

# 3. Restore via restore-full.sh --mode=api OU via API directe
curl -s -b /tmp/c.txt -X POST https://<DEPLOY_DOMAIN>/api/backup/full/restore \
  -H 'Content-Type: application/json' \
  -d "{\"backupId\":\"$BACKUP_ID\",\"dryRun\":false}"
# → Poll jusqu'à completed (cf. dr-drill.md §3.6)

# 4. Restart stack + smoke
docker compose up -d --force-recreate backend backend-worker frontend
docker exec <NPM_CONTAINER> sh -c 'nginx -s reload'
bash scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>
```

---

## 4. Rollback total (VM cassée — DR scenario)

Si bootstrap nécessaire : suivre [bootstrap-runbook.md](bootstrap-runbook.md) + restore depuis offsite USB (cf. [offsite-backup.md §4](offsite-backup.md#4-restore-depuis-offsite-dr-critique)).

---

## 5. Validation post-rollback

- [ ] `/api/health` → 200 `status:ok`
- [ ] `bash scripts/smoke-prod.sh` → PASS 6/6
- [ ] Login admin PASS
- [ ] Tag déployé : `docker exec xch-backend cat /app/VERSION 2>/dev/null || git -C <COMPOSE_DIR> describe --tags`
- [ ] Audit log : entrée incident + rollback documentée
- [ ] User communication envoyée (si downtime > 10 min)

---

## 6. Cross-références

- DR drill mesuré : [dr-drill.md](dr-drill.md)
- Recovery scénarios : [recovery-runbook.md](recovery-runbook.md)
- Incident response : [incident-response.md](incident-response.md)
- Bootstrap : [bootstrap-runbook.md](bootstrap-runbook.md)
- Restore script : [scripts/restore-full.sh](../../scripts/restore-full.sh)
