# ADR-019 : Chiffrement des secrets en DB (at-rest, AES-256-GCM)

Date : 2026-04-29
Statut : Accepté
Tag cible : v1.6.2 (Session 2 du plan finalization v2)
Dépendances : ADR-018 (TenantSsoConfig + TenantIntegrationConfig sont des
tables typées issues du split `Tenant.config` JSON).

## Contexte

Post-v1.6.0, plusieurs secrets sont stockés **en clair** dans la base
PostgreSQL :

| Cible | Colonne | Type |
|---|---|---|
| 1 | `TenantSsoConfig.clientSecret` | `String` |
| 2 | `TenantIntegrationConfig.netboxToken` | `String?` |
| 3 | `User.totpSecret` | `String?` |
| 4 | `NotificationConfig.channels` JSON | sous-champ `teams.webhookUrl` |

Risque : un dump pg_dump non chiffré, une fuite de backup MinIO, un
accès SSH compromis ou un audit forensique posé sur un disque retiré
exposent tous ces secrets. Pour la 2FA en particulier, le compromis du
`totpSecret` permet de générer des codes valides → bypass 2FA total.

Le schéma marque déjà `TenantSsoConfig.clientSecret` et
`TenantIntegrationConfig.netboxToken` avec `// TODO encrypted-at-rest in
a future ADR`. Cet ADR est ce future ADR.

Bonus du même esprit, hors scope strict du plan v2 mais groupé pour
éviter une mini-session séparée : `User.inviteToken` et `User.resetToken`
sont stockés en clair, ce qui est une faiblesse standard distincte
(pas du chiffrement, du **hash**).

## Décision

### 1. Chiffrement applicatif AES-256-GCM (pas KMS externe)

- Algo : AES-256-GCM (authenticated encryption, NIST SP 800-38D, supporté
  nativement par `node:crypto`).
- Clé : 32 bytes (256 bits), variable d'environnement `XCH_MASTER_KEY`
  encodée en base64.
- IV : 12 bytes aléatoires par chiffrement (jamais réutilisé pour la même
  clé — `crypto.randomBytes(12)`).
- Authentication tag : 16 bytes, vérifié au decrypt (rejette les
  ciphertext modifiés).
- Pas de KMS externe (Vault, AWS KMS, GCP KMS) pour la phase pilote :
  trop d'infra à déployer pour le bénéfice marginal sur du SaaS pilote.
  Option ouverte pour v2.0 (le `CryptoService` est l'interface qu'on
  remplacera).

### 2. Format colonne : `v<n>:<iv>:<tag>:<ct>` (base64)

```
v1:DRGiwxAlKBtLkwiW:vSZ8iX5ZA0ozb6JIFQHmGw==:R3VlbnNDaGFyZ
```

- Préfixe `v1:` versionne la clé de chiffrement courante. Une rotation
  de `XCH_MASTER_KEY` produit du `v2:`, l'ancienne clé reste configurable
  via `XCH_MASTER_KEY_V1` pour décrypter le legacy lors des reads.
- Pas de DDL/migration Prisma : on garde `String` / `JSON`. Le contenu
  devient simplement non lisible sans la clé.
- Compat backward (transitoire) : si une valeur n'a pas le préfixe
  `v<n>:`, le `decrypt` retourne la valeur as-is + log un warning
  `legacy plaintext secret detected`. Le prochain write la chiffrera.
  Permet un déploiement sans reset+seed obligatoire (mais reset+seed
  reste l'opération de référence sur xch-deploy, cf.
  `XCH_DEMO_DATA_PRINCIPLE`).

### 3. Invocation explicite (pas de wrapper Prisma transparent)

`backend/src/common/crypto/crypto.service.ts` exporte un `@Injectable()`
avec :

```ts
encrypt(plaintext: string): string                 // → "v1:..."
decrypt(value: string): string                     // throws si tag invalide
encryptIfPlain(value: string | null | undefined): string | null
decryptOrLegacy(value: string | null | undefined): string | null
isEncrypted(value: string | null | undefined): boolean
```

Les 4 services touchant les colonnes appellent `encryptIfPlain` au write
et `decryptOrLegacy` au read. Pas de magic Prisma extension (sources
fréquentes de bugs subtils — un projection `select` qui exclut le champ
casse silencieusement).

### 4. MASTER_KEY absente : fail-soft + warning

Au boot, si `XCH_MASTER_KEY` n'est pas définie, le `CryptoService` log
`MASTER_KEY missing — secret read/write will fail-soft`. Les writes
ignorent silencieusement les colonnes chiffrables (le payload reste
sans la valeur, à charge du caller de gérer). Les reads retournent
`null` et logent un warning. **Pas de crash backend** — l'app continue
de tourner pour les fonctionnalités qui n'en dépendent pas.

Cette tolérance est explicite pour ne pas bloquer un démarrage en dev
oublié. **Bloquer le boot est trop violent** vu la diversité des envs
(CI, dev local, smoke prod, etc.). Un check `/health` enrichi (S5 ou
plus tard) pourra exposer un statut "secrets disabled".

### 5. Périmètre exact (4 cibles)

#### 5.1 `TenantSsoConfig.clientSecret`
- WRITE : [`tenants.service.ts:296`](backend/src/modules/tenants/tenants.service.ts) (upsert).
- READ : [`tenants.service.ts:256`](backend/src/modules/tenants/tenants.service.ts) (assembleSafeConfigShape).
- Note : la lecture côté `oidc.strategy.ts` est aujourd'hui faite via
  env var `OIDC_CLIENT_SECRET`. La colonne DB est l'évolution future.
  Le chiffrement protège le stockage indépendamment.

#### 5.2 `TenantIntegrationConfig.netboxToken`
- WRITE : [`integrations.service.ts:87-91`](backend/src/modules/integrations/integrations.service.ts) (upsert).
- READ : [`integrations.service.ts:31-35`](backend/src/modules/integrations/integrations.service.ts) (config retrieval) puis passé à `netboxProvider.reconfigure()`.

#### 5.3 `User.totpSecret`
- WRITE : [`auth.controller.ts:273-276`](backend/src/modules/auth/auth.controller.ts) (setup) + clears à `:429-435` et `:451-456`.
- READ : [`auth.controller.ts:289-297`](backend/src/modules/auth/auth.controller.ts) (verify-setup) + `:336-346` (verify-login).

#### 5.4 `NotificationConfig.channels.teams.webhookUrl` (JSON sub-field)
- WRITE : [`notification-config.service.ts:74-90`](backend/src/modules/notifications/notification-config.service.ts) (create/update).
- READ : `notification-config.service.ts:119-128` (resolveConfig) +
  [`teams.channel.ts:26`](backend/src/modules/notifications/channels/teams.channel.ts) (send).
- Stratégie : `walkAndEncryptSubfields(channels, ['teams.webhookUrl'])`
  au write, `walkAndDecryptSubfields(...)` au read. Le reste du JSON
  reste en clair (pas de coût de chiffrement sur les champs non
  sensibles).
- **Confirmation audit** : `email.smtp.password` n'est PAS en DB
  (provient de l'env var `SMTP_PASS`), donc hors scope.

### 6. Bonus : hash SHA-256 des tokens (pas du chiffrement)

`User.inviteToken` et `User.resetToken` ont un problème distinct :
ce sont des **secrets d'authentification éphémères** (le user reçoit le
token en clair par email, le présente lors du flow). Le chiffrement
n'est pas adapté (rotation de clé casserait les tokens en cours de
validité). Le standard est le **hash one-way** :

- WRITE : on génère le token en clair (uuid), on calcule
  `sha256(token)`, on stocke le hash. Le clair part par email.
- READ (lookup) : on calcule `sha256(received)` et on compare au hash
  stocké via `where: { resetToken: sha256(received), ... }`.

Pas de breaking côté API :
- `auth.service.ts:274` (fallback retour token clair si SMTP fail) reste
  inchangé — on retourne le clair au caller, pas le hash.
- Les tokens existants en clair en DB **expirent en 24h** (invitations)
  ou 1h (reset) → reset+seed les efface, pas de migration.

Implémenté dans la même PR pour grouper le mindset "sécu colonne
sensible". `HashService` minimaliste à côté de `CryptoService`.

## Conséquences

### Positives
- Dump pg_dump compromis ne donne plus accès aux 4 secrets ni aux tokens.
- Rotation `XCH_MASTER_KEY` possible sans data loss (versionning intégré).
- Préserve la queryabilité (tokens : lookup par hash exact ; secrets :
  pas de filter sur ces colonnes — vérifié par audit).
- Pas de breaking côté API (chiffrement opaque).

### Négatives
- Une nouvelle ENV var critique à gérer (`XCH_MASTER_KEY`). Ajoutée à
  `rotate-secrets.sh` (S1) avec consignes de génération.
- Si `XCH_MASTER_KEY` est perdue **sans backup**, les secrets DB sont
  irrécupérables. Documenté dans `INSTALL_PROD.md` + `README.md`.
- Coût CPU négligeable : AES-GCM sur des secrets <1KB, ≤4 colonnes par
  request → microseconds.

### Forward dependency : Session 3 (NotificationConfig refacto)

⚠️ La Session 3 du plan finalization v2 (refacto NotificationConfig en
`NotificationChannel` + `NotificationRule` + `NotificationDigest`,
ADR-020) DEVRA continuer à chiffrer les credentials de channels
sensibles dans la nouvelle structure. Concrètement :

- Si la nouvelle table `NotificationChannel` a une colonne `config` JSON
  (probable), le chiffrement des sous-champs sensibles s'applique
  toujours via le même `CryptoService`.
- Si `NotificationChannel.webhookUrl` devient une colonne string scalaire
  dédiée (cleaner), c'est encore plus simple : `encryptIfPlain` au
  write, `decryptOrLegacy` au read, comme les 3 autres cibles.

Le flag `// TODO encrypted-at-rest` est à reproduire dans le schéma
post-Session 3 sur les colonnes équivalentes pour mémoire.

### Hors scope
- KMS externe (HSM, Vault, AWS/GCP/Azure KMS) — phase pilote ne le
  justifie pas. v2.0+.
- Chiffrement du `User.passwordHash` — déjà sécurisé (bcrypt, hash
  one-way + salt).
- Chiffrement complet de la base (TDE, pgcrypto column) — orthogonal,
  ferait double-emploi.

## Alternatives considérées

1. **Wrapper Prisma transparent (extension `$extends`)** — Rejeté.
   Élégant en théorie, mais une projection `select: { clientSecret: true }`
   incomplète casse silencieusement. Magic > debug clarity. 4 sites de
   chiffrement, géré explicitement, pas un problème.

2. **pgcrypto column-level (`ENCRYPT()` en SQL)** — Rejeté. La clé est
   alors stockée côté DB ou injectée à chaque requête → on transfère
   le problème. Le chiffrement applicatif garde la clé hors PostgreSQL,
   ce qui est l'intention.

3. **Chiffrement de toute la colonne `channels` JSON (cible 4)** —
   Rejeté. Perd la queryabilité (filter par delegation, count, etc. —
   peu utilisée mais possible) ET force un decrypt à chaque read même
   pour les sous-champs non sensibles. Le walker sub-field est plus
   chirurgical et coûte ~10 lignes de plus.

4. **AES-CBC + HMAC séparé** — Rejeté. GCM combine les deux nativement
   (auth tag), moins de risques d'erreur (pas d'oubli HMAC).

5. **Bloquer le boot si MASTER_KEY absente** — Rejeté pour la fail-soft.
   Trop violent en dev, gêne le smoke. Un endpoint `/health` enrichi
   exposera l'état.

## Plan d'exécution

1. `CryptoService` + `HashService` + `CryptoModule` global.
2. Câblage 4 cibles + 2 tokens.
3. Tests Jest (round-trip, tampering rejection, legacy fallback,
   sub-field walker, hash collisions trivial).
4. Génération `XCH_MASTER_KEY` ajoutée à `scripts/rotate-secrets.sh`.
5. Doc README + INSTALL_PROD.
6. Commit + tag v1.6.2 + smoke prod (reset+seed sur xch-deploy avec
   `XCH_MASTER_KEY` provisionnée → vérifier que les secrets en DB sont
   préfixés `v1:`).
