# XCH — Deployment modes matrix (Option C mixte) — Track E.3 Pass 4

> **Scope** : tableau croisé des 4 modes de déploiement XCH avec leurs contraintes, pré-requis et livrables associés. **Air-gap strict** est le seul mode exécuté+validé empiriquement (Track E.3 Pass 1+2 sur xch-deploy). Les 3 autres modes sont des **templates dry-run** (validation réelle laissée à Track G future quand un 2e client réel se présente).
> **Placeholders Option C** : `<DEPLOY_DOMAIN>`, `<VM_IP>`, `<DNS_INTERNE>`, `<ORG_NAME>`, `<ADMIN_EMAIL>`, `<SSO_ENDPOINT>`, `<SMTP_RELAY>`, `<NTP_SOURCE>`, `<CA_BUNDLE>`.

---

## 1. Vue d'ensemble — 4 modes

| Mode | Cible | Réseau | TLS / cert | DNS | SSO | Monitoring | Backup offsite |
|---|---|---|---|---|---|---|---|
| **A. Cloud public** | SaaS multi-tenant futur | Internet ouvert | Let's Encrypt auto | Public (Cloudflare, Route53, etc.) | Entra ID / Google / Okta | Datadog ou Grafana SaaS optionnel | S3 cross-region |
| **B. Cloud privé client** | Datacenter client, VPS dédié | Privé client + sortie limitée | CA interne client OR Let's Encrypt si DNS public | Interne `.local` ou public | LDAP/AD si dispo | Grafana self-hosted | NFS share interne client |
| **C. Air-gap strict** | **Pilote employeur référence** | Aucun internet (whitelist UDP/TCP minimum) | Self-signed local OR CA interne | `.lan` / `.local` interne | LDAP/AD on-prem si dispo, sinon local-only durable | **Grafana + GlitchTip self-hosted obligatoires** | **USB chiffré LUKS rotatif hebdo** |
| **D. VPS basique** | Single-node simple petit client | Internet ouvert | Let's Encrypt | Public (registrar standard) | Local-only J1, LDAP J+N optionnel | Minimal (uniquement `/api/health` + Grafana hôte) | rsync offsite simple |

---

## 2. Décisions opérationnelles par mode

### 2.1 Tableau D-décisions (Track E parent §20 décisions)

| Décision | A. Cloud public | B. Cloud privé | **C. Air-gap (référence)** | D. VPS basique |
|---|---|---|---|---|
| **D2.1 SMTP** | Mailgun / SES API | Postfix relay client | **Postfix interne `<SMTP_RELAY>`** | Postfix sur l'hôte |
| **D2.2 Monitoring** | Grafana SaaS optionnel | Grafana self-hosted | **Grafana SQL panels reuse (D2.2 Track E.2)** | Grafana host minimal |
| **D2.3 Offsite backup** | S3 cross-region | NFS share client | **USB chiffré LUKS hebdo (D2.3)** | rsync vers VPS secondaire |
| **D2.4 SIEM** | Splunk Cloud optionnel | ELK self-hosted optionnel | **Pas de SIEM J1 (syslog local, D2.4)** | Pas de SIEM |
| **D3.1bis Infra** | AWS/GCP/Azure | vSphere / OpenStack / Proxmox | **VM interne employeur (vSphere/Proxmox/Hyper-V à confirmer)** | OVH/Hetzner/DigitalOcean VPS |
| **D3.2 DNS** | route53 / cloudflare | DNS interne client | **`<DNS_INTERNE>.lan` interne employeur** | Registrar standard |
| **D3.3 SSO** | Entra ID / Google | LDAP/AD si dispo | **Local-only durable J1, LDAP J+1mois si AD ouvert** | Local-only J1, LDAP J+N optionnel |
| **D3.4 Secrets** | AWS Secrets Manager / Vault | Vault interne | **`.env` chmod 600 + UFW pilote, Docker secrets v3.8 si scope étend** | `.env` chmod 600 |
| **D3.5 Admin 2e** | Nommé via SSO directory | Nommé via SSO ou local | **À nommer pendant E.3 (RSI propose, employeur valide)** | Solo opérateur J1 |
| **D3.6 Feature flag** | feature-management.io / launchdarkly | tenant_feature_flags table | **tenant_feature_flags table (déjà en place)** | Idem mode C |
| **D3.7 Swagger** | OFF prod | OFF prod | **OFF prod par défaut (`NODE_ENV=production`)** | OFF prod |
| **D3.8 Image distribution** | docker pull cloud registry | docker pull registry client | **`docker save/load` tarball USB chiffré** | docker pull docker hub |
| **D3.9 OS updates** | unattended-upgrades auto | mirror APT interne client | **Snapshots VM IT employeur + import `.deb` manuel cadencé** | unattended-upgrades auto |
| **D3.10 Certs** | Let's Encrypt auto | CA interne client OR Let's Encrypt | **Self-signed local si pas de CA employeur, sinon CA interne** | Let's Encrypt auto |
| **D3.11 NTP** | AWS time sync / pool.ntp.org | NTP interne client | **NTP interne employeur (fail-fast si pas configuré) — V4** | pool.ntp.org |
| **D3.12 Admin access** | SSH via VPN + MFA | VPN client + SSH | **SSH via VPN employeur (à confirmer modalités)** | SSH direct + fail2ban |
| **D4.1 Load test** | k6 + cloud runners | k6 + runners internes | **k6 lightweight (CI-friendly)** | k6 manuel |
| **D4.2 A11y** | Lighthouse CI + axe + plombier UX | Lighthouse + axe-core | **Lighthouse CI + axe-core combo** | Lighthouse manuel |
| **D4.3 Audit log retention** | S3 lifecycle 7 ans | DB partitioning + archive client | **1 an + purge cron mensuelle** | 90 jours |
| **D4.4 DR drill** | Trimestriel automatisé | Trimestriel manuel | **Trimestriel manuel (4 sessions/an)** | Annuel |

---

## 3. Pré-requis par mode

### 3.1 Cloud public (Mode A)

- Compte cloud provider (AWS/GCP/Azure)
- DNS public + cert Let's Encrypt
- SMTP provider (Mailgun, SES, etc.)
- Database managed (RDS Postgres) ou Postgres dans VM
- MinIO ou S3 natif
- Redis managed ou conteneur
- SSO Entra ID / Okta / Google
- Monitoring SaaS (Datadog, NewRelic) ou Grafana Cloud
- Budget mensuel (≈ 50-500 €/mois selon volume)

### 3.2 Cloud privé client (Mode B)

- VM(s) provisionnées par IT client (vSphere, OpenStack, Proxmox, Hyper-V)
- Réseau interne avec sortie limitée (proxy/whitelist)
- DNS interne ou DNS public si DNS-over-VPN
- Cert CA interne client OR Let's Encrypt si DNS public
- LDAP/AD client si dispo (mapping email-based)
- Grafana self-hosted
- Storage NFS share interne client
- Pas de coût hosting (couvert par le client)

### 3.3 Air-gap strict (Mode C — **pilote employeur référence**)

- VM interne employeur (8 vCPU / 32 GB / 500 GB SSD min recommandé)
- Réseau air-gap strict OU proxy/whitelist limité (à confirmer IT employeur)
- Self-signed local OR CA interne employeur (pas Let's Encrypt)
- DNS interne `.lan` / `.local`
- LDAP/AD on-prem si dispo, sinon local-only durable
- GlitchTip + Grafana + Postfix interne tous self-hosted
- USB chiffré LUKS pour offsite rotation
- Mirror APT interne ou snapshots VM pour patches OS
- Coût hosting ≈ 0 € (employeur paie VM)

### 3.4 VPS basique (Mode D)

- VPS provider (OVH, Hetzner, Scaleway, DigitalOcean) — 4 vCPU / 8 GB / 80 GB SSD min
- DNS public via registrar standard
- Cert Let's Encrypt auto (certbot OR Caddy)
- Postfix sur l'hôte ou relay externe
- Backup rsync vers VPS secondaire ou storage Object S3-compatible
- Coût hosting ≈ 10-30 €/mois

---

## 4. Livrables par mode

### 4.1 Procédures de cutover

| Mode | Document de cutover principal | Templates auxiliaires |
|---|---|---|
| A. Cloud public | [cutover-templates/cutover-cloud-public.md](cutover-templates/cutover-cloud-public.md) | dry-run review |
| B. Cloud privé | [cutover-templates/cutover-cloud-prive.md](cutover-templates/cutover-cloud-prive.md) | dry-run review |
| **C. Air-gap** | **[cutover-prod-airgap.md](cutover-prod-airgap.md)** | **exécuté+validé** |
| D. VPS basique | [cutover-templates/cutover-vps-basique.md](cutover-templates/cutover-vps-basique.md) | dry-run review |

### 4.2 Runbooks communs (tous modes)

- [bootstrap-runbook.md](bootstrap-runbook.md) — bootstrap from scratch (validé air-gap, adaptable autres modes)
- [recovery-runbook.md](recovery-runbook.md) — service-down scenarios
- [incident-response.md](incident-response.md) — playbook 5 phases
- [dr-drill.md](dr-drill.md) — DR drill mesuré (Track E.2 Pass 5)
- [alerting.md](alerting.md) — D2.1 SMTP + D2.2 Grafana + D2.4 syslog
- [offsite-backup.md](offsite-backup.md) — USB LUKS (mode C primaire ; adaptable cloud / NFS pour autres modes)
- [secrets-rotation.md](secrets-rotation.md) — rotation phases A/B/C
- [server-hardening.md](server-hardening.md) — UFW + SSH + fail2ban + journald
- [cert-management.md](cert-management.md) — self-signed / CA interne / Let's Encrypt
- [offline-updates.md](offline-updates.md) — mode C (mirror APT) ; modes A/B/D = unattended-upgrades standard
- [onboarding-user.md](onboarding-user.md) — création tenant + délégation + invite
- [rollback.md](rollback.md) — rollback tag git + restore backup

---

## 5. Risques par mode (matrice synthétique)

| Risque | A. Cloud public | B. Cloud privé | C. Air-gap | D. VPS |
|---|---|---|---|---|
| Compromission cloud (CSP breach) | Élevé | Faible | **N/A** (pas de cloud) | Moyen |
| Insider threat (user compromis) | Faible | Faible | **Élevé** | Faible |
| Supply chain (dépendances npm) | Moyen | Moyen | **Élevé** | Moyen |
| Disponibilité (downtime) | Bas (SLA cloud) | Moyen (selon SLA client) | **Moyen** (single-VM) | Moyen (VPS unique) |
| Coût | Élevé (CapEx → OpEx) | Faible (covered by client) | **Zéro** | Bas |
| Conformité RGPD | Moyen (CSP processor) | Bas (data on-prem) | **Très bas** (data dans infra employeur) | Moyen |
| Maintenance OS / patches | Faible (managed) | Moyen | **Élevé** (mirror manuel) | Faible (auto) |
| Coût opérationnel J+12 mois | Élevé (factures mensuelles) | Faible | **Très bas** | Moyen |

---

## 6. Trigger de basculement entre modes

### 6.1 Mode C → Mode B

Si l'employeur ouvre son réseau (proxy/whitelist permissive) → migrer monitoring + offsite vers les options Mode B. Pattern : cutover progressif (`cutover-prod-airgap.md` reste valable, ajouts incrémentaux).

### 6.2 Mode C → Mode D (rare — séparation de l'employeur)

Si la relation employeur cesse mais l'application doit continuer → déploiement VPS basique avec restore depuis backup USB LUKS (cf. [offsite-backup.md §4](offsite-backup.md#4-restore-depuis-offsite-dr-critique)).

### 6.3 Tout mode → Mode A (productisation multi-tenant)

Track G future (post-2e client). Hors scope J1.

---

## 7. Cross-références

- Plan Track E parent : MCP `XCH_TRACK_E_PREPROD_READINESS_2026_05_15`
- Bootstrap référence : [bootstrap-runbook.md](bootstrap-runbook.md)
- Cutover air-gap pilote : [cutover-prod-airgap.md](cutover-prod-airgap.md)
- DR drill mesuré : [dr-drill.md](dr-drill.md)
- Pattern Docker isolation : MCP `XCH_CO_HOSTED_DOCKER_PROJECTS_DISCIPLINE_2026_05_16`
- Catastrophe Pass 1 fix retex : [docs/audit/track-e3-pass1-catastrophe-2026-05-16.md](../audit/track-e3-pass1-catastrophe-2026-05-16.md)
