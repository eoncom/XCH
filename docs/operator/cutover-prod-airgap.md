# XCH — Cutover prod air-gap pilote — Track E.3 Pass 6

> ⚠️ **EXEMPLE — toute mention de `xch.eoncom.io` est un exemple historique RSI banc de test. Pour un cutover client, substituer par le placeholder `<DEPLOY_DOMAIN>` (typiquement `xch.<client>.lan` ou `xch.<client>.local`).** Idem `xch-deploy` = hostname banc de test RSI, à remplacer par `<DEPLOY_HOST>` dans le contexte client.

> **Scope** : checklist de cutover XCH vers VM pilote employeur air-gap, synthèse de tous les runbooks Track E.2 + E.3.
> Mode C (cf. [deployment-modes.md §3.3](deployment-modes.md#33-air-gap-strict-mode-c--pilote-employeur-référence)).
> **Statut empirique** : validé sur `xch-deploy` comme banc de test (Track E.3 Pass 1+2 — 2 cycles wipe + bootstrap reproductibles).
> **Vigilance V3 (SSO LDAP) + V4 (NTP)** documentées §V3 + §V4 ci-dessous.

---

## 1. Checklist pré-cutover (J-7 à J-1)

### 1.1 Coordination IT employeur

- [ ] VM provisionnée : 8 vCPU / 32 GB RAM / 500 GB SSD min (vSphere / Proxmox / Hyper-V à confirmer)
- [ ] OS : Ubuntu Server 22.04 LTS minimum
- [ ] Réseau : air-gap strict OU proxy/whitelist limité (cf. [docs/audit/track-e1-egress-whitelist.md](../audit/track-e1-egress-whitelist.md))
- [ ] DNS interne : `<DEPLOY_DOMAIN>` résoluble depuis le VPN admin (et seulement le VPN admin si air-gap strict)
- [ ] Cert : CA interne employeur dispo (`<CA_BUNDLE>`) OR auto self-signed local
- [ ] SMTP : Postfix interne employeur (`<SMTP_RELAY>`) — V1 acquittée si test swaks PASS
- [ ] NTP : `<NTP_SOURCE>` interne fonctionnel — **V4 BLOQUEUR CUTOVER** (cf. §V4)
- [ ] SSH access via VPN employeur — modalités confirmées
- [ ] Stockage offsite USB : 2 clés USB ≥ 32 GB pré-formatées LUKS (cf. [offsite-backup.md §2.2](offsite-backup.md#22-formatage-initial-root-requis-à-exécuter-une-fois-par-clé))
- [ ] Vault opérateur prêt pour stocker passphrase LUKS + secrets `.env`

### 1.2 Pré-bootstrap

- [ ] Tarball XCH packaged sur USB : `bash scripts/package-release.sh` produit `xch-release-v2.3.4.tar.gz` + images Docker `images/*.tar`
- [ ] Tarball GlitchTip stack inclus (avec son propre `docker-compose.glitchtip.yml` + `glitchtip/scripts/gen-dsn.sh`)
- [ ] Repository git mirror interne configuré OR `.git` packaged dans tarball
- [ ] check-secrets.sh passé sur le tarball (0 secret leaked)
- [ ] audit-egress.sh code-grep (assertion 4) PASS dans la branche source

---

## 2. Bootstrap J-day (≤ 1h)

Suivre **[bootstrap-runbook.md](bootstrap-runbook.md)** §0-7 intégralement. Adaptations cutover prod :

### 2.1 Différences vs xch-deploy banc de test

| Item | xch-deploy (banc de test) | Prod pilote employeur |
|---|---|---|
| Images Docker | déjà cachées local | `docker load -i images/*.tar` (depuis tarball USB) |
| Cert TLS | NPM externe (Let's Encrypt) | NPM interne avec CA employeur OR self-signed local |
| DNS | `xch.eoncom.io` public | `<DEPLOY_DOMAIN>` interne (`.lan` / `.local`) |
| SMTP | Mailpit mock (Track E.2 Pass 4) | `<SMTP_RELAY>` interne employeur (V1) |
| GlitchTip | déjà recovered isolé `xch-glitchtip` | bootstrap from scratch avec project name isolé |
| UFW | non-applicable (dev) | **OBLIGATOIRE** post-cutover (cf. §4 et `scripts/ufw-enforce.sh`) |
| Setup wizard | `loadDemoData: true` (cycle 1) | `loadDemoData: false` (prod réelle) |
| Backup auto cron | absent | absent J1 (on-demand uniquement, cron différé Track D.3) |

### 2.2 Sequence bootstrap

```bash
# 0. (Optional) On-premise initial setup (root)
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git cryptsetup openssl curl

# 1. Charger images depuis USB
cd /opt/xch-pilot
for tar in images/*.tar; do docker load -i "$tar"; done

# 2. Démarrer GlitchTip ISOLÉ (project name xch-glitchtip — cf. MCP XCH_CO_HOSTED_DOCKER_PROJECTS_DISCIPLINE)
docker compose -f docker-compose.glitchtip.yml -p xch-glitchtip --env-file glitchtip/.env up -d
until docker inspect glitchtip-postgres -f '{{.State.Health.Status}}' | grep -q healthy; do sleep 3; done

# 3. Générer DSNs GlitchTip
bash glitchtip/scripts/gen-dsn.sh \
  --internal-host http://glitchtip-web:8000 \
  --public-host https://glitch.<DEPLOY_DOMAIN>

# 4. Suivre bootstrap-runbook.md §2 secrets generation puis §4 docker compose up
#    (avec loadDemoData=false pour prod réelle)

# 5. NPM reload (CRITICAL gotcha)
docker exec <NPM_CONTAINER> sh -c 'nginx -s reload'

# 6. Smoke 6/6 + setup wizard
bash scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>
```

---

## 3. V1 SMTP `<SMTP_RELAY>` validation

Acquittée pré-cutover via `swaks` (cf. [alerting.md §4.4](alerting.md#44-real-smtp-test-prod-employeur-différé-track-e3)) :

```bash
swaks --to <ADMIN_EMAIL> \
  --from noreply@<DEPLOY_DOMAIN> \
  --server <SMTP_RELAY> \
  --port 587 \
  --auth-user <SMTP_USER> \
  --auth-password <SMTP_PASS> \
  --header 'Subject: XCH SMTP smoke (Track E.3 cutover)' \
  --body 'XCH installation completed. Reply OK if received.'
```

→ Si l'email arrive : configurer `backend/.env` `SMTP_HOST=<SMTP_RELAY>` + `SMTP_PORT=587` + `SMTP_USER/PASS/FROM` + restart backend + worker (force-recreate, cf. Track E.2 Pass 4 gotcha env_file).

---

## 4. UFW enforce post-bootstrap (OBLIGATOIRE)

```bash
sudo SMTP_RELAY=<SMTP_RELAY> NTP_SOURCE=<NTP_SOURCE> \
  bash scripts/ufw-enforce.sh
```

Le script :
- Default deny in/out
- Allow inbound : 22 (SSH key only), 80, 443
- Allow outbound : 53 DNS, 123 NTP, 587 vers `<SMTP_RELAY>`, 123 vers `<NTP_SOURCE>`
- Loopback in/out

Post-exec, valider que :
- `audit-egress.sh --strict` retourne PASS 4/4
- SSH reste accessible (DNS, NPM serve toujours xch.<DOMAIN>)
- `<SMTP_RELAY>` toujours joignable (test swaks ré-exécuté)

---

## 5. V3 SSO LDAP J+1mois — checklist activation différée

> **Vigilance V3** (cf. plan Track E parent) : risque dérive « local-only éternel » si l'employeur a un AD utilisable. Ticket suivi cron mensuel obligatoire.

### 5.1 Prérequis IT employeur

- [ ] LDAP/AD endpoint : `<LDAP_HOST>:636` (LDAPS recommandé) ou `<LDAP_HOST>:389` (LDAP+STARTTLS)
- [ ] Service account read-only : DN + password — stocké vault opérateur
- [ ] DN base utilisateurs : ex. `ou=users,dc=employeur,dc=local`
- [ ] Filtre user : ex. `(&(objectClass=user)(mail={email}))`
- [ ] CA cert LDAP/AD (`<LDAP_CA_BUNDLE>`) si CA interne employeur

### 5.2 Migration users local → LDAP-linked

```bash
# 1. Activer SSO LDAP dans backend/.env
SSO_PROVIDER=ldap
SSO_LDAP_URL=ldaps://<LDAP_HOST>:636
SSO_LDAP_BIND_DN=<SVC_DN>
SSO_LDAP_BIND_PASSWORD=<SVC_PASS>
SSO_LDAP_USER_BASE_DN=ou=users,dc=employeur,dc=local
SSO_LDAP_USER_FILTER=(&(objectClass=user)(mail={email}))

# 2. Restart backend + worker (force-recreate pour env_file reload)
docker compose up -d --force-recreate backend backend-worker

# 3. Premier login via UI : user entre email + password LDAP
#    → backend match email avec DB local user existant → link
#    → futurs logins via LDAP password (DB hash devient stale, garde fallback)

# 4. Suivi : audit log entry pour chaque LDAP-linked event
```

### 5.3 Risque dérive J+N

Ticket cron mensuel (calendar reminder opérateur) :
- M1 : LDAP activé ? Si non, ouvrir conversation IT employeur
- M2 : LDAP activé ? Si non, escaler RSI + business
- M3 : LDAP activé ? Si non, ADR-029 « LDAP migration durably deferred » accepté par stakeholders

> Code-side : si module SSO LDAP n'est pas dispo dans le codebase actuel, **ADR-029** sera créé Pass 8 Track E.3 pour figec la décision « parking Track F ».

---

## 6. V4 NTP fail-fast — BLOQUEUR cutover

> **Vigilance V4** (cf. plan Track E parent) : drift NTP → JWT exp invalides + TLS cert validation fail + audit log timestamps faux.

### 6.1 Pré-flight NTP

```bash
# Sur la VM pilote
chronyc tracking 2>/dev/null || timedatectl status

# Vérifier que la source NTP est <NTP_SOURCE> employeur (PAS pool.ntp.org en air-gap strict)
chronyc sources -v | head -10
```

Attendu : `Reference ID : <NTP_SOURCE>`, `System time : within ±50 ms of NTP time`.

### 6.2 Configuration chrony air-gap

Si chrony pointe vers internet par défaut, override :

```bash
sudo tee /etc/chrony/chrony.conf > /dev/null <<EOF
# Track E.3 cutover air-gap NTP source interne
server <NTP_SOURCE> iburst prefer
makestep 1.0 3
rtcsync
driftfile /var/lib/chrony/chrony.drift
logdir /var/log/chrony
EOF
sudo systemctl restart chronyd
sudo chronyc makestep   # force initial sync
```

### 6.3 Tolérance + bloqueur

| Drift host vs NTP | Action |
|---|---|
| ≤ 50 ms | ✅ OK |
| 50 ms – 5 s | ⚠️ Investiguer (network jitter) |
| 5 s – 5 min | ❌ **BLOQUEUR CUTOVER** — JWT et audit log impactés |
| > 5 min | 🛑 **Refuser cutover** : TLS cert validation va échouer, JWT exp aberrante |

Si pas de NTP interne employeur disponible :
- **OPTION A** (préférée) : escalation IT employeur — déployer NTP interne (ntpd ou chrony) sur un host employeur disponible
- **OPTION B** (fallback fragile) : autoriser pool.ntp.org via proxy/whitelist outbound 123/udp — air-gap strict compromis
- **OPTION C** (dernier recours) : RTC sync manuel + monitoring drift via Grafana panel custom — fragile, à éviter

→ Cutover NE DOIT PAS être déclaré « done » sans NTP V4 résolu.

---

## 7. Activation GlitchTip pilote employeur

### 7.1 Pré-flight

- [ ] Stack GlitchTip démarré avec project name isolé `xch-glitchtip`
- [ ] 5 containers up : admin-seed (Exited 0 nominal), web, worker, postgres, redis
- [ ] Network `xch-glitchtip_glitchtip-internal` créé
- [ ] Volumes `xch-glitchtip_glitchtip_postgres_data` + `xch-glitchtip_glitchtip_redis_data` présents
- [ ] NPM proxy route `glitch.<DEPLOY_DOMAIN>` → `glitchtip-web:8000` configurée (admin only)

### 7.2 Générer DSNs

```bash
cd /opt/xch-pilot
bash glitchtip/scripts/gen-dsn.sh \
  --internal-host http://glitchtip-web:8000 \
  --public-host https://glitch.<DEPLOY_DOMAIN>
# → JSON avec 3 DSNs (xch-backend / xch-worker / xch-frontend)
```

### 7.3 Injecter dans .env

```bash
# backend/.env
GLITCHTIP_DSN_BACKEND=http://<KEY>@glitchtip-web:8000/1
GLITCHTIP_DSN_WORKER=http://<KEY>@glitchtip-web:8000/2
GLITCHTIP_ENVIRONMENT=production

# .env (root, pour build frontend NEXT_PUBLIC_*)
NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND=https://<KEY>@glitch.<DEPLOY_DOMAIN>/3
NEXT_PUBLIC_GLITCHTIP_ENVIRONMENT=production
```

### 7.4 Test event end-to-end

Activer temporairement `test-error` endpoints (sera désactivé post-validation) :

```bash
# backend/.env
ENABLE_TEST_ERROR_ENDPOINTS=true

docker compose up -d --force-recreate backend
# Login admin via UI → /api/_test-error/backend (GET)
# Vérifier event apparait dans GlitchTip UI (https://glitch.<DEPLOY_DOMAIN>)

# Désactiver à nouveau
sed -i 's/ENABLE_TEST_ERROR_ENDPOINTS=true/ENABLE_TEST_ERROR_ENDPOINTS=false/' backend/.env
docker compose up -d --force-recreate backend
```

---

## 8. Offsite backup USB initial (J-day +1)

Cf. [offsite-backup.md §3](offsite-backup.md#3-procédure-hebdomadaire--opérateur) :

```bash
# Avec la clé USB pré-formatée LUKS
sudo bash scripts/offsite-backup-luks.sh /dev/sdb1
```

Conserver clé USB en lieu sécurisé offsite (coffre, second site, etc.).

---

## 9. Validation finale cutover

- [ ] Smoke 6/6 PASS
- [ ] `/api/health` retourne 200 ok
- [ ] `audit-egress.sh --strict` retourne PASS 4/4
- [ ] UFW actif + règles correctes (`ufw status verbose`)
- [ ] NPM proxy serve `<DEPLOY_DOMAIN>` avec cert valide (chain + dates)
- [ ] Login admin@<EMPLOYER>.com PASS via UI
- [ ] Email roundtrip via `<SMTP_RELAY>` PASS (test depuis UI Settings > Notifications > Test EMAIL)
- [ ] GlitchTip capture events backend + frontend (1 event test)
- [ ] Backup full encrypted créé (`POST /api/backup/full {encrypt:true}`) — base catalog visible
- [ ] Offsite USB rotation J-day +1 réussi
- [ ] Grafana 4 SQL panels XCH alimentés
- [ ] Documentation handoff : 13 runbooks operator partagés avec 2e admin nommé (D3.5)
- [ ] NTP drift ≤ 50ms vs `<NTP_SOURCE>` (V4)
- [ ] V3 ticket cron mensuel SSO LDAP migration planifié
- [ ] MCP `XCH_TRACK_E3_AIRGAP_BOOTSTRAP_2026_05_XX` closure event_log écrite

---

## 10. Cross-références

- Bootstrap référence : [bootstrap-runbook.md](bootstrap-runbook.md)
- DR drill mesuré : [dr-drill.md](dr-drill.md)
- Alerting (V1 SMTP) : [alerting.md](alerting.md)
- Offsite USB : [offsite-backup.md](offsite-backup.md)
- Recovery : [recovery-runbook.md](recovery-runbook.md)
- Incident response : [incident-response.md](incident-response.md)
- Cert management : [cert-management.md](cert-management.md)
- Server hardening : [server-hardening.md](server-hardening.md)
- Offline updates : [offline-updates.md](offline-updates.md)
- Onboarding user : [onboarding-user.md](onboarding-user.md)
- Secrets rotation : [secrets-rotation.md](secrets-rotation.md)
- Rollback : [rollback.md](rollback.md)
- Catastrophe Pass 1 forensic : [../audit/track-e3-pass1-catastrophe-2026-05-16.md](../audit/track-e3-pass1-catastrophe-2026-05-16.md)
- MCP plan parent : `XCH_TRACK_E_PREPROD_READINESS_2026_05_15`
