# XCH load tests (k6)

Track E.4 PR2 Pass 3 — baseline performance backend en charge réaliste.

## Pré-requis

### 1. Seed loadtest fixture

```bash
cd backend
npx ts-node scripts/seed-loadtest.ts            # first run
npx ts-node scripts/seed-loadtest.ts --reset    # purge & recreate
```

Crée 1 tenant `loadtest-e4-pr2` isolé, 5 délégations, 5 sites, 50 users + admin
super-admin (`admin-lt@loadtest.local` / `Loadtest1234`), 10 000 assets, 100 000
AuditLog (90 jours sliding). Durée attendue : <5 min.

### 2. Install k6

| OS | Commande |
|---|---|
| Windows | `winget install k6.k6` |
| macOS | `brew install k6` |
| Ubuntu | `sudo apt-get install k6` (after [k6 repo setup](https://k6.io/docs/get-started/installation/)) |

### 3. Backend lancé

```bash
cd backend
npm run start:dev    # http://localhost:3000
```

Optionnel : `DEBUG=prisma:query` pour détecter N+1 lors du run.

## Scénarios

| Scénario | VUs | Durée | Traffic | Endpoints |
|---|---|---|---|---|
| `smoke-load.js` | 5 | 30s | sanity | `/api/setup/status`, `/api/sites`, `/api/assets` |
| `read-heavy.js` | 50 | 5m | 70% mix | `/api/assets`, `/api/sites`, `/api/tasks` |
| `write-mixed.js` | 10 | 5m | 20% mix | `POST /api/assets`, `PATCH /api/tasks/:id`, `POST /api/expenses` |
| `audit-heavy.js` | 5 | 5m | 10% mix | `GET /api/audit?delegationId=…` (stress index composite PR1) |

## Thresholds (SLA pilote air-gap)

- **p95 read** < 500ms, **p99** < 2s
- **p95 write** < 1s, **p99** < 2s
- **error rate** < 1%

Configurés à la fois inline dans chaque scénario ET globalement dans `k6-config.json`.

## Run

### Single scenario

```bash
k6 run tests/load/scenarios/smoke-load.js -e K6_BASE_URL=http://localhost:3000
```

### Full suite (séquentiel — recommandé local)

```bash
for s in smoke-load read-heavy write-mixed audit-heavy; do
  echo "=== $s ==="
  k6 run tests/load/scenarios/$s.js -e K6_BASE_URL=http://localhost:3000
done
```

### CI (workflow_dispatch)

```bash
gh workflow run load-test.yml
```

Le workflow boot postgres + redis + minio + backend + applique migrations + seed
loadtest + run les 4 scenarios séquentiel + upload artifacts JSON.

## Interprétation rapport

Pour chaque scénario, k6 produit :
- `http_req_duration` : p50/p95/p99 par groupe/tag/endpoint
- `http_req_failed` : error rate
- `iterations` : itérations VU réussies
- `vus_max` : VUs concurrents observés

À reporter dans [`docs/perf/load-test-2026-05-16.md`](../../docs/perf/load-test-2026-05-16.md) :
- p95/p99 par endpoint (groupé read / write / audit)
- error rate par scénario
- RSS worker peak (`docker stats backend-worker`)
- Queue depth Bull (`redis-cli LLEN bull:notifications:wait`)
- N+1 détectés (parser Prisma logs `DEBUG=prisma:query`)
- Findings count CRITICAL / IMPORTANT / RECOMMENDED

## Hotfix CRITICAL

Si p95 read > 1s OU error rate > 5% OU N+1 détecté sur endpoint smoke
(`/api/assets`, `/api/sites`) → PR hotfix inclus PR2 :
- Ajout `include`/`select` Prisma adapté
- Bump `BULL_WORKER_CONCURRENCY` env
- Tuning index manquant (backlog Track G si non-critique)

## Cleanup

```bash
# Purge seed loadtest tenant (FK CASCADE)
cd backend
npx ts-node scripts/seed-loadtest.ts --reset    # délète + recrée
# Ou via Prisma Studio : DELETE tenant where id='loadtest-e4-pr2'
```
