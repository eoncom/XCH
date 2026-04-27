# ADR-015 : S1 Security Hardening — closure

**Date :** 2026-04-26 (mis à jour 2026-04-27 — closing résidu intégré au lot M de [ADR-016](adr-016-monitoring-unification.md))
**Statut :** **Clos** — toutes les vagues livrées
**Contexte :** Plan v2 sessions S0 + S1 (S1-A + S1-B + S1-closing + S1-closing-2)

> Note de numérotation : ADR-014 est réservé au monitoring natif (ADR à
> rédiger en ouverture de la session monitoring, cf.
> `docs/prompts/next-session-monitoring-native.md`). Cet ADR sécurité prend
> donc le numéro **015**.

## Contexte

Le diagnostic global du plan v2 a révélé une dizaine de findings sécurité /
résilience à clore avant la session monitoring (S2). La session S1 du plan
v2 a été découpée en 3 vagues — A (rotation + bugs critiques), B (Redis
auth + magic-bytes ZIP), closing (Multer limits + magic-bytes images +
secrets compose stricts).

Cet ADR consigne :
1. ce qui a été appliqué et pourquoi ;
2. les findings audités qui se sont révélés être des **faux positifs** —
   tracés ici pour qu'aucun audit futur ne les re-soulève par mégarde ;
3. ce qui reste hors scope, à traiter dans des ADR/sessions dédiées.

## Décision — ce qui a été appliqué

### Phase A (commits `2f1da73`)
- **Rotation des secrets prod** : `JWT_SECRET` (37→64 chars), `JWT_REFRESH_SECRET`
  (41→64), `MINIO_ACCESS_KEY` (15→20 hex), `MINIO_SECRET_KEY` (22→40 hex),
  `MONITORING_WEBHOOK_SECRET` (28→32) **synchronisé** avec
  `GATUS_WEBHOOK_SECRET` (0→32, était absent du `.env` racine →
  fallback `"changeme"` du compose, webhook Gatus cassé silencieusement).
  Script idempotent `scripts/rotate-secrets.sh` (Phase A + B,
  `--dry-run`, `--yes`, backups timestampés, healthcheck, smoke tests).
- **Bug critique webhook (P0)** : le `try/catch` dans
  `monitoring-webhook.controller.ts` swallowait les `ForbiddenException`
  et retournait HTTP 200 même sur secret invalide → la rotation du
  secret était inutile côté défense. Fix : re-throw `Forbidden`,
  `Unauthorized`, `BadRequest` ; on garde le 200 `status:error` UNIQUEMENT
  pour les 5xx internes (parser Kuma/Gatus) afin d'éviter les boucles
  de retry des outils monitoring.
- **OOM `/consumption/summary` (P0)** : cap dur 500 sites + pagination
  `limit/offset` + `meta.totalSites/returned/truncated`. Avant : findMany
  sans pagination + include.assets non borné = blowup mémoire pour un
  tenant pathologique.
- **Cap `/expenses/projection` (P1)** : `count` préalable + `BadRequest`
  si > 10 000 expenses dans la fenêtre. Avant : >10 MB de JSON sérialisé
  + expansion mensuelle CPU-intensive.
- **Throttle granulaire** : `@Throttle` decorator sur les endpoints
  sensibles (webhook 30/min/IP, search 30/min/user, audit 60/min/user,
  import CSV 5/min/user, projection 10/min/user) en complément du
  `XchThrottlerGuard` global 100/min.
- **Logger conditionné NODE_ENV** : `'debug'` retiré en prod.

### Phase B (commit `30913c2`)
- **`REDIS_PASSWORD` obligatoire en prod** : `docker-compose.prod.yml`
  Redis `--requirepass ${REDIS_PASSWORD:?...}` (compose refuse de
  démarrer sans). `docker-compose.yml` (dev) conditionnel via `sh -c`
  pour rester ergonomique sans `.env`.
- **Magic-bytes ZIP** : helper inline `validateMagicBytes` dans
  `common/utils/upload-security.ts` (zéro dépendance — `file-type` v17+
  est ESM-only, incompatible NestJS CJS). Appliqué dans
  `backup.service.restoreFullBackup` et `restoreSiteBackup` avant
  `new AdmZip(buffer)`.

### Phase closing (commit `c2b8ca9`)
- **Multer `fileSize` limits + `fileFilter` sur 8 routes** :
  `assets` (4 routes — 3 imports CSV 10 MB + attachment 25 MB) et
  `floor-plans` (4 routes — inspect-pdf + create + upload + new-version
  à 50 MB). Avant : `FileInterceptor('file')` sans `limits` acceptait
  par défaut n'importe quelle taille = DoS upload trivial.
- **Nouveaux file filters** : `csvFileFilter` (text/csv only),
  `floorPlanFileFilter` (PDF + PNG + JPEG), `pdfOnlyFileFilter`.
- **Magic-bytes images** dans 3 services consumers :
  - `floor-plans.service.inspectPdf` → `validateMagicBytes(['pdf'])`
  - `floor-plans.service.uploadFile` → `validateMagicBytes(['pdf','png','jpeg'])`
  - `assets.service.uploadAttachment` → `validateMagicBytesForMimetype`
    (helper qui mappe mimetype → kinds attendus, silencieux pour les
    formats text-based ou Office legacy non couverts par notre helper
    inline).
- **Secrets `docker-compose.yml` strict** : suppression des fallbacks
  `XchSecure2024!` (POSTGRES_PASSWORD) et `XchMinIO2024SecureKey!`
  (MINIO_SECRET_KEY) qui étaient committés en clair dans le repo. Tous
  passent en `${VAR:?message}` qui fait échouer compose si la variable
  n'est pas dans `.env`. POSTGRES_USER et POSTGRES_DB gardent un défaut
  lisible (ce ne sont pas des secrets).

### Phase closing-2 (commit `4c3c5d0`, intégrée au lot M de [ADR-016](adr-016-monitoring-unification.md))

Audit de fin de session ADR-016 a relevé 4 résidus que le `c2b8ca9`
n'avait pas couverts. Tous fermés dans le même commit que les autres
items de fin de session monitoring.

- **Multer Tasks attachments** : la route `POST /api/tasks/:id/attachments`
  utilisait `@UseInterceptors(FileInterceptor('file'))` NU (pas de
  `limits`, pas de `fileFilter`). Vrai trou DoS. Ajout `memoryStorage` +
  `limits.fileSize: 10 MB` + `attachmentFileFilter` (parité avec
  `assets`/`sites`/`racks`).
- **Magic-bytes manquants sur 3 services attachments** : Tasks, Sites,
  Racks bypassaient `validateMagicBytesForMimetype` alors que Floor
  Plans, Backup et Assets l'appelaient déjà. Ajout dans les 3 services
  AVANT l'upload vers MinIO. Bouche le vecteur "PE/ELF renommé en
  .png" pour les attachments rattachés à des tâches/sites/baies.
- **Mots de passe hardcodés `XchSecure2024!` / `XchMinIO2024SecureKey!`**
  encore présents dans `.env.example`, `backend/.env.example`,
  `backend/.env.production` (le compose strict `:?` du closing #1
  n'avait nettoyé que les fallbacks compose ; les fichiers `.env*`
  exemples gardaient les valeurs en dur). Réécrits en placeholders
  `<PASSWORD>` + commentaires expliquant `openssl rand -base64 32` /
  `scripts/rotate-secrets.sh`. Le `backend/.env.production` (qui était
  un fichier semi-réel committé) devient un template propre.
- **Registre des faux positifs** : nouveau fichier
  [`docs/security/false-positives.md`](../security/false-positives.md)
  pour documenter au fil des audits ce qui finit en faux positif (avec
  trancheur, date, cause racine, preuve, condition de re-évaluation).
  Évite les retests à chaque audit. Gabarit d'entrée inclus.

## Faux positifs vérifiés (à ne pas re-soulever)

L'audit initial avait listé 4 findings qui se sont révélés non valides
après lecture détaillée du code. Ils sont consignés ici pour traçabilité.

### `audit.service` — « tenantId scope leak »
- **Suspicion initiale** : 7 `findMany` séquentiels enrichLabels
  pourraient fuiter des entités d'autres tenants si l'attaquant forge un
  `entityId`.
- **Vérification** : `audit.service.ts` lignes 24, 87, 102, 112, 122, 132 —
  **tous les sub-fetches passent `tenantId` dans le `where` Prisma**.
  Un `entityId` forgé d'un autre tenant ne match aucune ligne, le label
  reste null, et le `auditLog.findMany` racine est lui aussi scopé
  tenantId ligne 24. Pas de fuite possible.
- **Verdict** : **OK**, aucun changement.

### `all-exceptions.filter.ts` — « stack trace exposée client »
- **Suspicion initiale** : les erreurs en prod renvoient la stack à
  l'utilisateur, divulguant les paths interne et les requêtes Prisma.
- **Vérification** : la réponse client (`response.status(status).json(...)`
  ligne 94-100) ne contient **que** `statusCode`, `error`, `message`,
  `timestamp`, `path` — jamais la stack. La stack est uniquement loguée
  serveur via `this.logger.error(..., err?.stack)` ligne 88-91.
- **Verdict** : **OK**, aucun changement.

### `uptime-kuma.provider.ts` + `gatus.provider.ts` — « credential leak in logs »
- **Suspicion initiale** : `logger.log` mentionnant `config.url` pourrait
  loguer des credentials si l'URL est de la forme `http://user:pass@host`.
- **Vérification** : `axios.create` reçoit `auth: { username, password }`
  séparément de l'URL ; la baseURL configurée par les utilisateurs dans
  Settings est attendue sans inline credentials. Le risque existe seulement
  si un opérateur saisit délibérément `http://user:pass@host` dans le
  formulaire → comportement utilisateur, pas un bug code.
- **Verdict** : **risque faible accepté**, à durcir en future ADR si
  le formulaire UI ne valide pas l'URL côté front (enhancement, pas un
  bug de sécurité).

### `body-parser` route-specific (initial finding S1)
- **Suspicion initiale** : `bodyParser.json({ limit: '10mb' })` global
  bloque les uploads de backup ZIP volumineux.
- **Vérification** : Multer **bypasse** `body-parser` pour les
  `multipart/form-data` (FileInterceptor lit directement le stream).
  La vraie limite des uploads vient de `Multer.limits.fileSize`. Le
  finding était mal posé.
- **Verdict** : aucun changement à `body-parser`. Multer `limits`
  ajoutés à la place dans S1-closing #1.

## Hors scope — sessions dédiées à venir

| # | Sujet | Cible |
|---|---|---|
| 1 | Monitoring natif (MonitorCheck/Result + worker BullMQ) | **S2 session dédiée** — ADR-014 |
| 2 | Refacto NotificationConfig (split JSON → tables) | S6 plan v2 |
| 3 | Refacto Asset.networkInfo (split network/monitoring/admin links) | S7 plan v2 |
| 4 | Migrations Prisma versionnées | S5 plan v2 (avant S6/S7) |
| 5 | CSP nonce-based (retire `unsafe-inline`) | S11 plan v2 |
| 6 | Refonte E2E Playwright (suite v1.0.x morte) | S10 plan v2 |
| 7 | Tests unitaires backend (au-delà des 80 actuels) | continu |

## Conséquences

### Positives
- **Posture sécurité prod nettement améliorée** avant ouverture du pilote
  à plus de testeurs : 2 P0 fermés (rotation + bug webhook), 3 P1
  (caps OOM/CPU, Redis auth, magic-bytes), 4 P2 (Multer DoS, throttle
  granulaire, secrets compose, magic-bytes images).
- **80 tests Jest** créés à partir de zéro (PermissionGuard 100%,
  XchThrottlerGuard 100%, ConsumptionService 100%, MonitoringWebhookService 86%,
  OidcStrategy.normalizeRight 100%, ExpensesService.projection branch
  coverage, upload-security 100%) — non-régression mesurable.
- **Scripts opérables** : `rotate-secrets.sh`, `check-deploy-parity.sh`
  réutilisables pour les prochaines rotations / vérifications.
- **Faux positifs documentés** ici pour qu'aucun audit futur ne les
  re-soulève en doublon.

### Négatives (acceptées)
- **`docker-compose.yml` strict** : un dev qui clone le repo doit
  obligatoirement copier `.env.example → .env` et y poser ses secrets
  avant `docker compose up`. Friction acceptée — c'est le bon pattern.
- **Helper magic-bytes inline** plutôt que `file-type` lib : ne couvre
  pas les formats Office legacy (`D0 CF 11 E0`). Acceptable pour le
  pilote ; à upgrader si on adopte un format propriétaire spécifique.
- **`xchapi.eoncom.io` n'est plus joignable** (compose nginx en
  `created` jamais `running`, le routing public passe par
  Nginx Proxy Manager externe sur `xch.eoncom.io/api/`). Pas un bug —
  juste une mémoire à mettre à jour côté observability.

## Alternatives considérées

1. **Tout faire en une seule PR géante** — rejeté. Le découpage en 3 vagues
   (A, B, closing) avec deploy + smoke entre chacune a permis de détecter
   et fixer le bug webhook révélé par le smoke après A, et de patcher
   correctement le `command:` Redis du compose au passage. Une PR géante
   aurait mélangé les régressions.
2. **Bumper à `file-type@latest` (ESM only)** — rejeté. NestJS reste sur
   CommonJS, conversion ESM = chantier disproportionné. Helper inline
   couvre 95% des cas réels.
3. **Reporter S1-closing à S11** — rejeté. Les Multer limits absentes sont
   un risque DoS prouvé (un upload de 10 GB suffit). Mieux clore S1
   propre avant d'ouvrir S2 (12-15h focus monitoring).

## Suivi

Chaîne complète des commits S0+S1 :

| Phase | Commit | Description |
|---|---|---|
| S0 | `eaa8880` | bump 1.3.0 → 1.5.0 + deploy parity script |
| S1-A scripts | `7201bfa` | rotate-secrets.sh (Phase A + B, --dry-run, --yes, backups, healthcheck) |
| Hotfix | `30f62ab` | healthcheck rotate-secrets accepte tout HTTP < 500 |
| S4 tests | `0118c8b` | Jest unit tests on critical fail-closed + math paths |
| S1-A code | `2f1da73` | webhook auth + OOM caps + throttle granulaire |
| S1-B | `30913c2` | Redis auth + magic-bytes ZIP avant unzip |
| S1-closing | `c2b8ca9` | Multer limits 7 routes + magic-bytes images + secrets compose strict |
| S1-closing-2 | `4c3c5d0` | Multer Tasks + magic-bytes Tasks/Sites/Racks + suppression XchSecure2024 + doc faux positifs |

Tag `v1.5.0` posé sur `7201bfa`. **v1.6.0** sera posé après S5 (Prisma
migrations) + S6/S7 (refacto JSON résiduel) du plan v2.
